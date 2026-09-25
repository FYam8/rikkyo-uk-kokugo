// Retention evidence must follow a passed repair by at least 24 hours.
export const RETENTION_DELAY=24*60*60*1000;
export function pendingRetention(events,sourceYear,now=Date.now()){
 const repairs=(events||[]).filter(e=>e.type==='repair_block_completed'&&e.passed===true&&String(e.sourceExamId??e.sourceYear)===String(sourceYear)).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
 const latest=new Map();
 for(const repair of repairs)for(const skill of repair.skills||[])latest.set(skill,repair);
 const pending=[];
 for(const [skill,repair] of latest){
  const dueAt=Date.parse(repair.createdAt)+RETENTION_DELAY;if(!Number.isFinite(dueAt))continue;
  const evidence=(events||[]).filter(e=>e.type==='drill_practice_answered'&&e.practicePhase==='retention'&&e.retentionRepairId===repair.id&&e.domain===skill&&Date.parse(e.createdAt)>=dueAt&&Date.parse(e.createdAt)<=now).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).at(-1);
  if(evidence?.correct===true)continue;
  pending.push({skill,repairId:repair.id,sourceYear,dueAt,due:now>=dueAt,failed:evidence?.correct===false});
 }
 return pending;
}
