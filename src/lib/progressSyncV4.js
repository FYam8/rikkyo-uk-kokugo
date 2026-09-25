import * as v3 from './progressSyncV3.js';

const SYNC_DB='rikkyo-uk-kokugo-progress-sync';
const SYNC_DB_VERSION=7;
const APP_ID='rikkyo-uk-kokugo';
const UNKNOWN_OCCURRED_AT='1970-01-01T00:00:00.000Z';
const te=new TextEncoder();

function canonicalize(v){if(Array.isArray(v))return v.map(canonicalize);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonicalize(v[k])]));return v;}
const canonicalJson=v=>JSON.stringify(canonicalize(v));
async function sha256Hex(v){const d=await crypto.subtle.digest('SHA-256',te.encode(String(v)));return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:undefined;}
function stableOccurredAt(e){for(const v of[e?.completedAt,e?.finishedAt,e?.createdAt,e?.timestamp,e?.at,e?.savedAt]){const t=Date.parse(String(v||''));if(Number.isFinite(t))return{value:new Date(t).toISOString(),unknown:false};}return{value:UNKNOWN_OCCURRED_AT,unknown:true};}
function summarizeEvent(e){const p={};const put=(k,v)=>{if(v!==undefined&&v!==null&&v!=='')p[k]=v};put('year',e?.year!=null?String(e.year):undefined);put('mode',typeof e?.mode==='string'?e.mode:undefined);put('kind',typeof e?.kind==='string'?e.kind:undefined);put('type',typeof e?.type==='string'?e.type:undefined);put('score',finite(e?.score??e?.totalScore));put('maxScore',finite(e?.maxScore??e?.possibleScore));put('correct',finite(e?.correct??e?.correctCount));put('total',finite(e?.total??e?.questionCount));put('draftId',typeof e?.draftId==='string'?e.draftId:undefined);put('questionId',typeof e?.questionId==='string'?e.questionId:undefined);put('contentVersion',typeof e?.contentVersion==='string'?e.contentVersion:undefined);return p;}
async function eventFingerprint(e){const sourceRecordId=String(e.id),eventType=String(e?.type||e?.kind||e?.mode||'learning-event').slice(0,80),occurred=stableOccurredAt(e),payload=summarizeEvent(e);if(occurred.unknown)payload.clockUnknown=true;return{sourceRecordId,fingerprint:await sha256Hex(canonicalJson({appId:APP_ID,sourceRecordId,eventType,occurredAt:occurred.value,payload}))};}
function summarizeBaseline(events=[]){let scored=0,scoreTotal=0;const years={};for(const e of events){if(e?.year!=null)years[String(e.year)]=(years[String(e.year)]||0)+1;const s=finite(e?.score??e?.totalScore);if(s!==undefined){scored++;scoreTotal+=s;}}return{baseline:true,eventCount:events.length,scoredEventCount:scored,scoreTotal,eventsByYear:years,capturedAt:new Date().toISOString()};}
async function captureBaseline(events=[]){const fingerprints=[];for(const e of events){if(!e?.id)continue;fingerprints.push(await eventFingerprint(e));}return{summary:summarizeBaseline(events),fingerprints};}
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(SYNC_DB,SYNC_DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('control'))db.createObjectStore('control',{keyPath:'key'});if(!db.objectStoreNames.contains('outbox'))db.createObjectStore('outbox',{keyPath:'eventId'});if(!db.objectStoreNames.contains('deadletter'))db.createObjectStore('deadletter',{keyPath:'eventId'});if(!db.objectStoreNames.contains('seen_v2'))db.createObjectStore('seen_v2',{keyPath:'sourceKey'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('progress sync database blocked'));});}
function reqValue(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('transaction aborted'));});}
function putPendingBaseline(db,reg,baseline){return new Promise((resolve,reject)=>{const tx=db.transaction('control','readwrite'),store=tx.objectStore('control'),req=store.get('pendingRegistration');let compatible=true;req.onsuccess=()=>{const current=req.result?.value;if(current?.registrationId&&current.registrationId!==reg.registrationId){compatible=false;return;}store.put({key:'pendingRegistration',value:{...(current||{}),registrationId:reg.registrationId,credential:reg.credential,createdAt:current?.createdAt||reg.enrolledAt||new Date().toISOString(),baseline,baselineFinalized:true,baselineAppId:APP_ID}});};req.onerror=()=>reject(req.error);tx.oncomplete=()=>resolve(compatible);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('transaction aborted'));});}

async function prepareKokugoBaseline(loadExistingEvents){
  if(typeof indexedDB==='undefined'||typeof loadExistingEvents!=='function')return;
  const db=await openDb();
  try{
    let tx=db.transaction('control','readonly'),store=tx.objectStore('control');
    const regReq=store.get('registration');
    const regRow=await reqValue(regReq);
    await txDone(tx);
    const reg=regRow?.value;
    if(!reg?.registrationId||!reg?.credential)return;

    tx=db.transaction('control','readonly');store=tx.objectStore('control');
    const sentReq=store.get(`${APP_ID}:baselineSent:${reg.registrationId}`),pendingReq=store.get('pendingRegistration');
    const [sentRow,pendingRow]=await Promise.all([reqValue(sentReq),reqValue(pendingReq)]);
    await txDone(tx);
    if(sentRow?.value)return;
    const pending=pendingRow?.value;
    if(pending?.registrationId===reg.registrationId&&pending?.baselineFinalized&&pending?.baseline)return;
    if(pending?.registrationId&&pending.registrationId!==reg.registrationId)return;

    const events=(await loadExistingEvents())||[];
    const baseline=await captureBaseline(Array.isArray(events)?events:[]);
    await putPendingBaseline(db,reg,baseline);
  }finally{db.close();}
}

export async function initKokugoProgressSync(options={}){
  try{await prepareKokugoBaseline(options.loadExistingEvents);}catch{}
  return v3.initKokugoProgressSync(options);
}
export const notifyKokugoEventSaved=v3.notifyKokugoEventSaved;
export const flushProgressSync=v3.flushProgressSync;

