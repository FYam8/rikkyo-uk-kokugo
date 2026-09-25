import { notifyKokugoEventSaved } from './progressSync.js';

const DB_NAME = 'rikkyo-uk-kokugo';
// Persistence contract:
// - Keep DB_NAME stable for the lifetime of this app.
// - Schema upgrades are additive only. Never delete/clear learning stores during app updates.
// - Bump DB_VERSION only when a migration is required.
const DB_VERSION = 2;
const BACKUP_V1 = 'rikkyo-uk-kokugo-local-backup-v1';
const BACKUP_V2 = 'rikkyo-uk-kokugo-local-backup-v2';

function reqResult(req){
  return new Promise((resolve,reject)=>{
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=(event)=>{
      const db=req.result;
      // IMPORTANT: additive migrations only. Existing events/drafts must survive upgrades.
      if(!db.objectStoreNames.contains('events')) db.createObjectStore('events',{keyPath:'id'});
      if(!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts',{keyPath:'year'});
      if(!db.objectStoreNames.contains('meta')) db.createObjectStore('meta',{keyPath:'key'});
      const meta=req.transaction.objectStore('meta');
      meta.put({
        key:'schema',
        version:DB_VERSION,
        upgradedFrom:Number(event.oldVersion||0),
        upgradedAt:new Date().toISOString()
      });
    };
    req.onsuccess=()=>{
      const db=req.result;
      db.onversionchange=()=>db.close();
      resolve(db);
    };
    req.onblocked=()=>reject(new Error('別のタブで旧バージョンが開かれています。ほかのタブを閉じて再読み込みしてください。'));
    req.onerror=()=>reject(req.error);
  });
}
function txDone(tx){
  return new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

function plainObject(v){
  return !!v && typeof v==='object' && !Array.isArray(v);
}
function canonicalize(v){
  if(Array.isArray(v)) return v.map(canonicalize);
  if(plainObject(v)){
    const out={};
    for(const k of Object.keys(v).sort()) out[k]=canonicalize(v[k]);
    return out;
  }
  return v;
}
function canonicalJson(v){ return JSON.stringify(canonicalize(v)); }
async function sha256Hex(text){
  const bytes=new TextEncoder().encode(text);
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function validIsoTime(v){
  const n=Date.parse(String(v||''));
  return Number.isFinite(n)?n:null;
}

export async function getAllEvents(){
  const db=await openDb();
  try{
    const tx=db.transaction('events','readonly');
    const done=txDone(tx);
    const out=await reqResult(tx.objectStore('events').getAll());
    await done;
    return out||[];
  }finally{ db.close(); }
}
export async function putEvent(event){
  if(!event?.id) throw new Error('event.id がありません。');
  const db=await openDb();
  try{
    const tx=db.transaction('events','readwrite');
    tx.objectStore('events').put(event);
    await txDone(tx);
    void notifyKokugoEventSaved(event);
    return event;
  }finally{ db.close(); }
}
export async function putEvents(events){
  if(!events?.length) return 0;
  for(const e of events) if(!e?.id) throw new Error('event.id がない履歴が含まれています。');
  const db=await openDb();
  try{
    const tx=db.transaction('events','readwrite');
    const store=tx.objectStore('events');
    for(const e of events) store.put(e);
    await txDone(tx);
    for(const e of events) void notifyKokugoEventSaved(e);
    return events.length;
  }finally{ db.close(); }
}
export async function saveDraft(year,draft){
  const db=await openDb();
  try{
    const tx=db.transaction('drafts','readwrite');
    tx.objectStore('drafts').put({...draft,year:String(year)});
    await txDone(tx);
  }finally{ db.close(); }
}
// Compare-and-save in one transaction. A completed session can never be resurrected
// by an already scheduled autosave; conflicting tabs retain both snapshots.
export async function saveRepairDraft(year,draft,expectedGeneration=0){
  const record={...draft,year:String(year),generation:Number(expectedGeneration)+1};
  const fingerprint=await sha256Hex(canonicalJson(record));
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['events','drafts'],'readwrite'),store=tx.objectStore('drafts');
    const dr=store.get(record.year),er=tx.objectStore('events').getAll();
    let current,events,ready=0,result={saved:false,conflict:false};
    function write(){
      if(++ready!==2)return;
      if(events.some(e=>e.draftId===record.draftId))return;
      if(Number(current?.generation||0)!==Number(expectedGeneration)){
        const archived={...record,year:`${record.year}:conflict:${fingerprint}`,draftType:'repair-conflict',originalYear:record.year};
        store.put(archived);result={saved:false,conflict:true,record:archived};return;
      }
      store.put(record);result={saved:true,conflict:false,record};
    }
    dr.onsuccess=()=>{current=dr.result;write();};er.onsuccess=()=>{events=er.result||[];write();};
    dr.onerror=er.onerror=()=>tx.abort();
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||new Error('途中保存が中断されました。'));};
  });
}
export async function finishRepairDraft(year,event){
  if(!event?.id||!event.draftId)throw new Error('完了する練習のIDがありません。');
  const db=await openDb();
  try{
    const tx=db.transaction(['events','drafts'],'readwrite');
    const done=txDone(tx);
    tx.objectStore('events').put(event);
    tx.objectStore('drafts').delete(String(year));
    await done;
    void notifyKokugoEventSaved(event);
  }finally{db.close();}
}

export async function loadDraft(year){
  const db=await openDb();
  try{
    const tx=db.transaction('drafts','readonly');
    const done=txDone(tx);
    const out=await reqResult(tx.objectStore('drafts').get(String(year)));
    await done;
    return out||null;
  }finally{ db.close(); }
}
export async function allDrafts(){
  const db=await openDb();
  try{
    const tx=db.transaction('drafts','readonly');
    const done=txDone(tx);
    const out=await reqResult(tx.objectStore('drafts').getAll());
    await done;
    return out||[];
  }finally{ db.close(); }
}
export async function clearDraft(year){
  // Only the explicitly completed/resolved year's draft is removed.
  // Never use objectStore.clear() here; upgrades must not erase unrelated learning data.
  const db=await openDb();
  try{
    const tx=db.transaction('drafts','readwrite');
    tx.objectStore('drafts').delete(String(year));
    await txDone(tx);
  }finally{ db.close(); }
}

export async function storagePersistenceStatus(){
  try{
    if(!navigator.storage) return {supported:false,persisted:null};
    const persisted=typeof navigator.storage.persisted==='function'
      ? await navigator.storage.persisted()
      : null;
    let granted=persisted;
    if(persisted===false && typeof navigator.storage.persist==='function'){
      granted=await navigator.storage.persist();
    }
    const estimate=typeof navigator.storage.estimate==='function'
      ? await navigator.storage.estimate()
      : null;
    return {
      supported:true,
      persisted:granted===true,
      usage:Number(estimate?.usage||0),
      quota:Number(estimate?.quota||0)
    };
  }catch{
    return {supported:true,persisted:false};
  }
}

async function readBackupData(){
  const db=await openDb();
  try{
    const tx=db.transaction(['events','drafts'],'readonly');
    const done=txDone(tx);
    const [events,drafts]=await Promise.all([
      reqResult(tx.objectStore('events').getAll()),
      reqResult(tx.objectStore('drafts').getAll())
    ]);
    await done;
    return {events:events||[],drafts:drafts||[]};
  }finally{ db.close(); }
}

export async function exportLocalData(appVersion='unknown'){
  // One readonly transaction gives a consistent point-in-time snapshot.
  const data=await readBackupData();
  const checksum=await sha256Hex(canonicalJson(data));
  return {
    format:BACKUP_V2,
    schemaVersion:DB_VERSION,
    appVersion:String(appVersion||'unknown'),
    exportedAt:new Date().toISOString(),
    data,
    integrity:{algorithm:'SHA-256',sha256:checksum},
    summary:{events:data.events.length,drafts:data.drafts.length}
  };
}

async function normalizeBackupPayload(payload){
  if(!plainObject(payload)) throw new Error('バックアップJSONの形式が不正です。');

  if(payload.format===BACKUP_V1){
    return {
      sourceFormat:BACKUP_V1,
      events:Array.isArray(payload.events)?payload.events:[],
      drafts:Array.isArray(payload.drafts)?payload.drafts:[]
    };
  }

  if(payload.format!==BACKUP_V2) throw new Error('対応していないバックアップ形式です。');
  if(!plainObject(payload.data) || !Array.isArray(payload.data.events) || !Array.isArray(payload.data.drafts)){
    throw new Error('バックアップ内のdataが不正です。');
  }
  if(payload.integrity?.algorithm!=='SHA-256' || typeof payload.integrity?.sha256!=='string'){
    throw new Error('バックアップの整合性情報がありません。');
  }
  const actual=await sha256Hex(canonicalJson(payload.data));
  if(actual.toLowerCase()!==payload.integrity.sha256.toLowerCase()){
    throw new Error('バックアップの整合性チェックに失敗しました。ファイルが破損または変更されています。');
  }
  return {
    sourceFormat:BACKUP_V2,
    events:payload.data.events,
    drafts:payload.data.drafts
  };
}

function validateImportRows(events,drafts){
  const seen=new Set();
  for(const e of events){
    if(!plainObject(e) || typeof e.id!=='string' || !e.id.trim()) throw new Error('event.id が不正な履歴が含まれています。');
    if(seen.has(e.id)) throw new Error(`同じevent.idがバックアップ内で重複しています: ${e.id}`);
    seen.add(e.id);
  }
  const seenDraftYears=new Set();
  for(const d of drafts){
    if(!plainObject(d) || (typeof d.year!=='string' && typeof d.year!=='number') || !String(d.year).trim()){
      throw new Error('year が不正な下書きが含まれています。');
    }
    const y=String(d.year);
    if(seenDraftYears.has(y)) throw new Error(`同じyearの下書きがバックアップ内で重複しています: ${y}`);
    seenDraftYears.add(y);
  }
}

export async function importLocalData(payload){
  const normalized=await normalizeBackupPayload(payload);
  validateImportRows(normalized.events,normalized.drafts);

  // Hash before opening a transaction; awaiting WebCrypto inside IDB would close it.
  const draftFingerprints=new Map(await Promise.all(normalized.drafts.map(async d=>[String(d.year),await sha256Hex(canonicalJson({...d,year:String(d.year)}))])));
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['events','drafts','meta'],'readwrite');
    const eventStore=tx.objectStore('events');
    const draftStore=tx.objectStore('drafts');
    const metaStore=tx.objectStore('meta');
    const eventReq=eventStore.getAll();
    const draftReq=draftStore.getAll();
    let existingEvents=null,existingDrafts=null;
    const result={
      sourceFormat:normalized.sourceFormat,
      addedEvents:0,
      duplicateEvents:0,
      conflictingEvents:0,
      draftsAdded:0,
      draftsUpdated:0,
      draftsKept:0
    };

    function mergeWhenReady(){
      if(existingEvents===null || existingDrafts===null) return;

      const eventMap=new Map((existingEvents||[]).map(e=>[String(e.id),e]));
      for(const incoming of normalized.events){
        const current=eventMap.get(String(incoming.id));
        if(!current){
          eventStore.put(incoming);
          result.addedEvents++;
        }else if(canonicalJson(current)===canonicalJson(incoming)){
          result.duplicateEvents++;
        }else{
          // Event logs are immutable. Never overwrite a local event with a conflicting backup row.
          result.conflictingEvents++;
        }
      }

      const draftMap=new Map((existingDrafts||[]).map(d=>[String(d.year),d]));
      for(const incomingRaw of normalized.drafts){
        const incoming={...incomingRaw,year:String(incomingRaw.year)};
        const current=draftMap.get(incoming.year);
        if(!current){
          draftStore.put(incoming);
          result.draftsAdded++;
          continue;
        }
        if(canonicalJson(current)===canonicalJson(incoming)){result.draftsKept++;continue;}
        if(incoming.year.startsWith('draft:repair:')||incoming.year.startsWith('draft:unit:')||current.draftType==='repair-session'){
          const archiveKey=`${incoming.year}:conflict:${draftFingerprints.get(incoming.year)}`;
          if(!draftMap.has(archiveKey)){
            const archive={...incoming,year:archiveKey,draftType:'repair-conflict',originalYear:incoming.year};
            draftStore.put(archive);draftMap.set(archiveKey,archive);result.draftsAdded++;
          }else result.draftsKept++;
          continue;
        }
        const incomingTime=validIsoTime(incoming.savedAt);
        const currentTime=validIsoTime(current.savedAt);
        if(incomingTime!==null && (currentTime===null || incomingTime>currentTime)){
          draftStore.put(incoming);
          result.draftsUpdated++;
        }else{
          // Protect a newer (or indeterminately dated) local draft from an older import.
          result.draftsKept++;
        }
      }

      metaStore.put({
        key:'lastImport',
        at:new Date().toISOString(),
        sourceFormat:normalized.sourceFormat,
        ...result
      });
    }

    eventReq.onsuccess=()=>{ existingEvents=eventReq.result||[]; mergeWhenReady(); };
    draftReq.onsuccess=()=>{ existingDrafts=draftReq.result||[]; mergeWhenReady(); };
    eventReq.onerror=()=>tx.abort();
    draftReq.onerror=()=>tx.abort();
    tx.oncomplete=()=>{ db.close(); resolve(result); };
    tx.onerror=()=>{ const err=tx.error||new Error('インポートに失敗しました。'); db.close(); reject(err); };
    tx.onabort=()=>{ const err=tx.error||new Error('インポート処理が中断されました。'); db.close(); reject(err); };
  });
}

export function getDeviceId(){
  const k='rikkyo-uk.device.public';
  let v=localStorage.getItem(k);
  if(!v){ v=crypto.randomUUID(); localStorage.setItem(k,v); }
  return v;
}


// Explicit user action only. Clear all learning stores atomically, leaving other apps untouched.
export async function resetLocalLearningData({confirmed=false}={}){
 if(confirmed!==true)throw new Error('Explicit reset confirmation required');
 const db=await openDb();
 return new Promise((resolve,reject)=>{const tx=db.transaction(['events','drafts','meta'],'readwrite');for(const name of ['events','drafts','meta'])tx.objectStore(name).clear();tx.oncomplete=()=>{db.close();resolve();};tx.onerror=tx.onabort=()=>{const error=tx.error||new Error('Reset failed');db.close();reject(error);};});
}
