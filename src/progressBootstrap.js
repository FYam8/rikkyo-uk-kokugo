import { getAllEvents, allDrafts } from './lib/localdb.js';
import { initKokugoProgressSync, getKokugoSyncStatus, reconcileKokugoProgress } from './lib/progressSync.js';
// Missing VITE_PROGRESS_API_BASE keeps this build local-only.
async function report(){const status=await getKokugoSyncStatus();let notice=document.getElementById('cloud-migration-notice');if(status.migrationBlocked){if(!notice){notice=document.createElement('aside');notice.id='cloud-migration-notice';notice.setAttribute('role','status');notice.style.cssText='margin:12px;padding:12px;border:1px solid #b7791f;background:#fff8dc;color:#332500';document.body.prepend(notice);}notice.textContent='Cloud同期を保留しています。以前の登録の接続先、または共有先の登録との競合を確認する必要があります。既存の登録・未送信記録・学習履歴は保持しています。学習は続けられます。';}else notice?.remove();return status;}
setTimeout(async()=>{try{await initKokugoProgressSync({loadExistingEvents:getAllEvents,loadExistingState:async()=>({events:await getAllEvents(),drafts:await allDrafts()})});await report();}catch{}},500);
window.__RIKKYO_KOKUGO_PROGRESS__={sync:async()=>{await reconcileKokugoProgress();return report()},status:getKokugoSyncStatus};
window.addEventListener('online',()=>void report().catch(()=>{}));
