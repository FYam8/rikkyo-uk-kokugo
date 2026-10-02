import { buildStateRecords, summarizeOutgoingEvent, outgoingBaseline } from './progressProjection.js';
import './shared-progress-transport.js';
const SYNC_DB='rikkyo-uk-progress-sync';
const SYNC_DB_VERSION=7;
const APP_ID='rikkyo-uk-kokugo';
const MAX_BATCH=10;
const FLUSH_DELAY_MS=5000;
const RECONCILE_INTERVAL_MS=5*60*1000;
const REQUEST_TIMEOUT_MS=15000;
const MAX_BACKOFF_MS=60000;
const UNKNOWN_OCCURRED_AT='1970-01-01T00:00:00.000Z';
const te=new TextEncoder();
let stateProvider=null;
let initPromise=null,baselineProvider=null,scannerStarted=false,flushTimer=null,flushInFlight=null,flushAgain=false,flushBackoff=1000;

function apiBase(){const env=typeof import.meta!=='undefined'?import.meta.env?.VITE_PROGRESS_API_BASE:'';const win=typeof window!=='undefined'?window.__RIKKYO_UK_KOKUGO_PROGRESS_API__ : '';if(typeof location!=='undefined'&&location.origin!=='https://fyam8.github.io'&&!win)return '';return String(env||win||'').replace(/\/+$/,'');}
let sharedHistory;
function historyTransport(){
  if(!sharedHistory)sharedHistory=globalThis.SHARED_PROGRESS_TRANSPORT.createTransport({schoolId:'rikkyo-uk',legacyDatabases:[{name:'rikkyo-uk-kokugo-progress-sync',schoolId:'rikkyo-uk',appIds:[APP_ID]}],appId:APP_ID,dbName:SYNC_DB,dbVersion:SYNC_DB_VERSION,endpoint:apiBase}).history;
  return sharedHistory;
}
function canonicalize(v){if(Array.isArray(v))return v.map(canonicalize);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonicalize(v[k])]));return v;}
const canonicalJson=v=>JSON.stringify(canonicalize(v));
async function sha256Hex(v){const d=await crypto.subtle.digest('SHA-256',te.encode(String(v)));return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');}
function openDb(){return historyTransport().openDb();}
function txDone(tx){return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error('transaction aborted'));});}
async function requestValue(req){return new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});}
async function getControl(key){return historyTransport().getControl(key);}
async function setControl(key,value){return historyTransport().setControl(key,value);}
function sourceKey(id){return `${APP_ID}:${String(id)}`;}
function enrollmentTokenFromHash(){return typeof location==='undefined'?'':new URLSearchParams(location.hash.replace(/^#/,'')).get('enroll')||'';}
function clearEnrollmentHash(){if(typeof history==='undefined'||typeof location==='undefined')return;const p=new URLSearchParams(location.hash.replace(/^#/,''));p.delete('enroll');history.replaceState(null,'',`${location.pathname}${location.search}${p.toString()?`#${p}`:''}`);}
async function persistEnrollmentTokenFromHash(){const token=enrollmentTokenFromHash();if(!token)return await getControl('pendingEnrollmentToken');let pending=await getControl('pendingEnrollmentToken');if(!pending?.token||pending.token!==token){pending={token,storedAt:new Date().toISOString()};await setControl('pendingEnrollmentToken',pending);}clearEnrollmentHash();return pending;}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:undefined;}
function stableOccurredAt(e){for(const v of[e?.completedAt,e?.finishedAt,e?.createdAt,e?.timestamp,e?.at,e?.savedAt]){const t=Date.parse(String(v||''));if(Number.isFinite(t))return{value:new Date(t).toISOString(),unknown:false};}return{value:UNKNOWN_OCCURRED_AT,unknown:true};}
function summarizeEvent(e){const p={};const put=(k,v)=>{if(v!==undefined&&v!==null&&v!=='')p[k]=v};put('year',e?.year!=null?String(e.year):undefined);put('mode',typeof e?.mode==='string'?e.mode:undefined);put('kind',typeof e?.kind==='string'?e.kind:undefined);put('type',typeof e?.type==='string'?e.type:undefined);put('score',finite(e?.score??e?.totalScore));put('maxScore',finite(e?.maxScore??e?.possibleScore));put('correct',finite(e?.correct??e?.correctCount));put('total',finite(e?.total??e?.questionCount));put('draftId',typeof e?.draftId==='string'?e.draftId:undefined);put('questionId',typeof e?.questionId==='string'?e.questionId:undefined);put('contentVersion',typeof e?.contentVersion==='string'?e.contentVersion:undefined);return p;}
async function eventBase(e){const sourceRecordId=String(e.id),eventType=String(e?.type||e?.kind||e?.mode||'learning-event').slice(0,80),occurred=stableOccurredAt(e),payload=summarizeEvent(e);if(occurred.unknown)payload.clockUnknown=true;const fingerprint=await sha256Hex(canonicalJson({appId:APP_ID,sourceRecordId,eventType,occurredAt:occurred.value,payload}));return{sourceRecordId,sourceHash:await sha256Hex(sourceRecordId),eventType,occurredAt:occurred.value,payload:summarizeOutgoingEvent(e,payload),fingerprint};}
function summarizeBaseline(events=[]){let scored=0,scoreTotal=0;const years={};for(const e of events){if(e?.year!=null)years[String(e.year)]=(years[String(e.year)]||0)+1;const s=finite(e?.score??e?.totalScore);if(s!==undefined){scored++;scoreTotal+=s;}}return{baseline:true,eventCount:events.length,scoredEventCount:scored,scoreTotal,eventsByYear:years,capturedAt:new Date().toISOString()};}
async function captureBaseline(events=[]){const fingerprints=[];for(const e of events){if(!e?.id)continue;const b=await eventBase(e);fingerprints.push({sourceRecordId:b.sourceRecordId,fingerprint:b.fingerprint});}return{summary:summarizeBaseline(events),fingerprints};}
async function createOrGetPendingStub(){const seed=await historyTransport().getOrCreateRegistrationSeed();return seed.registration||seed.pending;}
async function finalizePendingBaseline(pending){if(pending?.baselineFinalized&&pending?.baseline)return pending;const existing=typeof baselineProvider==='function'?(await baselineProvider())||[]:[];const baseline=await captureBaseline(existing);const db=await openDb();try{const tx=db.transaction('control','readwrite'),store=tx.objectStore('control'),current=(await requestValue(store.get('pendingRegistration')))?.value;if(!current||current.registrationId!==pending.registrationId){await txDone(tx);return current||pending;}if(!current.baselineFinalized){const next={...current,baseline,baselineFinalized:true};store.put({key:'pendingRegistration',value:next});await txDone(tx);return next;}await txDone(tx);return current;}finally{db.close();}}
async function ensurePendingRegistration(){if(!(await ensureKokugoScope()))return null;const reg=await getControl('registration');if(reg?.credential)return reg;if(await getControl('syncRevoked'))return null;const stub=await createOrGetPendingStub();return finalizePendingBaseline(stub);}
function baselineContains(pending,base){return Boolean(pending?.baselineFinalized&&pending?.baseline?.fingerprints?.some(row=>String(row.sourceRecordId)===base.sourceRecordId&&row.fingerprint===base.fingerprint));}
async function markBaselineSeen(fingerprints=[]){const db=await openDb();try{const tx=db.transaction('seen_v2','readwrite'),s=tx.objectStore('seen_v2'),at=new Date().toISOString();for(const row of fingerprints){const key=sourceKey(row.sourceRecordId),current=await requestValue(s.get(key));if(!current)s.put({sourceKey:key,appId:APP_ID,sourceRecordId:row.sourceRecordId,state:'baseline',revision:0,fingerprint:row.fingerprint,at});}await txDone(tx);}finally{db.close();}}
async function promoteWithEnrollment(reg){const pendingToken=await persistEnrollmentTokenFromHash();const token=pendingToken?.token;if(!reg?.credential||!token)return false;const d=await historyTransport().enroll(reg,token);if(!d.ok){if([400,409].includes(d.httpStatus))await setControl('pendingEnrollmentToken',null);return false;}await setControl('registration',{...reg,status:'production',deviceCode:d.deviceCode||reg.deviceCode||null,enrolledAt:new Date().toISOString()});await setControl('pendingEnrollmentToken',null);await setControl('syncRevoked',null);return true;}
async function registerSilently(){if(!apiBase()||await getControl('syncRevoked')||!(await historyTransport().ensureScope()))return false;await persistEnrollmentTokenFromHash();let reg=await getControl('registration');if(reg?.credential)return (await getControl('pendingEnrollmentToken'))?.token?promoteWithEnrollment(reg):true;const pending=await ensurePendingRegistration();if(!pending)return false;if((await getControl('pendingEnrollmentToken'))?.token)return promoteWithEnrollment(pending);return Boolean(await historyTransport().ensureRegistration());}
async function queueEvent(base){return historyTransport().queueRecord(base);}
export async function notifyKokugoEventSaved(event){try{if(!event?.id||!apiBase())return{queued:false,reason:'local_only'};if(await getControl('syncRevoked'))return{queued:false,reason:'revoked'};if(await getControl('collectionDisabled'))return{queued:false,reason:'ignored'};const pending=await ensurePendingRegistration();const base=await eventBase(event);if(baselineContains(pending,base))return{queued:false,reason:'baseline'};const queued=await queueEvent(base);if(queued)scheduleFlush();return{queued};}catch{return{queued:false,reason:'queue_failed'};}}
async function prepareRegisteredBaseline(reg){
  // Another subject may finish registration while Kokugo is still opening.
  // Freeze this subject's baseline even in that interleaving; preserve conflicts.
  const db=await openDb();let pending;
  try{
    const tx=db.transaction('control','readwrite'),store=tx.objectStore('control');
    pending=(await requestValue(store.get('pendingRegistration')))?.value;
    if(pending?.registrationId&&pending.registrationId!==reg.registrationId){await txDone(tx);return null;}
    if(pending?.baselineAppId&&pending.baselineAppId!==APP_ID){await txDone(tx);return null;}
    if(!pending){pending={...reg,baseline:null,baselineFinalized:false,baselineAppId:APP_ID};store.put({key:'pendingRegistration',value:pending});}
    await txDone(tx);
  }finally{db.close();}
  return finalizePendingBaseline(pending);
}
async function uploadBaselineIfNeeded(){const reg=await getControl('registration');if(!reg?.credential)return false;const key=`${APP_ID}:baselineSent:${reg.registrationId}`;if(await getControl(key))return true;const pending=await prepareRegisteredBaseline(reg);if(!pending?.baselineFinalized||!pending.baseline)return false;const baseline=pending.baseline;if(!(await historyTransport().uploadSnapshot(reg,outgoingBaseline(baseline.summary))))return false;await markBaselineSeen(baseline.fingerprints||[]);await setControl(key,{at:new Date().toISOString()});return true;}
async function refreshControl(){return historyTransport().refreshControl(await getControl('registration'),true);}
async function flushOnce(){if(await getControl('syncRevoked'))return true;let reg=await getControl('registration');if(!reg?.credential){if(!(await registerSilently()))return false;reg=await getControl('registration');}if(!reg?.credential||navigator.onLine===false)return false;if(await getControl('collectionDisabled'))return true;if(!(await uploadBaselineIfNeeded()))return false;return historyTransport().flushAvailable(reg);}
export function flushProgressSync(){if(flushInFlight){flushAgain=true;return flushInFlight;}flushInFlight=(async()=>{try{const ok=await flushOnce();if(ok)flushBackoff=1000;else scheduleRetry();return ok;}catch{scheduleRetry();return false;}finally{flushInFlight=null;if(flushAgain){flushAgain=false;scheduleFlush();}}})();return flushInFlight;}
function scheduleFlush(){if(!flushTimer)flushTimer=setTimeout(()=>{flushTimer=null;void flushProgressSync();},FLUSH_DELAY_MS);}
function scheduleRetry(){if(flushTimer)return;const wait=flushBackoff+Math.floor(Math.random()*Math.max(250,flushBackoff*.25));flushBackoff=Math.min(MAX_BACKOFF_MS,flushBackoff*2);flushTimer=setTimeout(()=>{flushTimer=null;void syncCycle();},wait);}
async function reconcile(){if(typeof baselineProvider!=='function')return;for(const e of(await baselineProvider())||[]){if(!e?.id)continue;const base=await eventBase(e),pending=await getControl('pendingRegistration');if(baselineContains(pending,base))continue;await queueEvent(base);}}
async function syncCycle(){if(!apiBase()||await getControl('syncRevoked'))return;if(!(await registerSilently()))return;if(!(await refreshControl()))return;if(await getControl('collectionDisabled'))return;if(!(await uploadBaselineIfNeeded()))return;await reconcile();if(stateProvider)for(const record of buildStateRecords(await stateProvider()))await queueEvent(record);scheduleFlush();}
function startScanner(){if(scannerStarted)return;scannerStarted=true;window.setInterval(()=>void syncCycle(),RECONCILE_INTERVAL_MS);void syncCycle();}
export function initKokugoProgressSync({loadExistingEvents,loadExistingState}={}){if(loadExistingState)stateProvider=loadExistingState;if(loadExistingEvents)baselineProvider=loadExistingEvents;if(initPromise)return initPromise;initPromise=(async()=>{if(!apiBase())return{mode:'local-only'};if(!(await ensureKokugoScope()))return{mode:'cloud-blocked'};try{await persistEnrollmentTokenFromHash();await ensurePendingRegistration();await registerSilently();startScanner();window.addEventListener('online',()=>void syncCycle());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void syncCycle();});const reg=await getControl('registration');return{mode:reg?.credential?'cloud':'cloud-pending',status:reg?.status||'unclassified',deviceCode:reg?.deviceCode||null};}catch{startScanner();return{mode:'cloud-degraded'};}})();return initPromise;}

export async function ensureKokugoScope(){return Boolean(apiBase())&&await historyTransport().ensureScope();}
export async function getKokugoSyncStatus(){if(!apiBase())return{mode:'local-only'};const reg=await getControl('registration');return{migrationBlocked:await getControl('migrationBlocked'),deviceCode:reg?.deviceCode||null};}
export async function reconcileKokugoProgress(){await syncCycle();return flushProgressSync();}
