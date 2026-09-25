// A failed delayed check starts a new 24-hour delay; immediate corrected answers do not certify retention.
export const RETENTION_DELAY=24*60*60*1000;
export function pendingRetention(events,sourceYear,now=Date.now()){
 const repairs=(events||[]).filter(e=>e.type==='repair_block_completed'&&e.passed===true&&String(e.sourceExamId??e.sourceYear)===String(sourceYear)).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
 const latest=new Map();for(const repair of repairs)for(const skill of repair.skills||[])latest.set(skill,repair);
 const pending=[];
 for(const [skill,repair] of latest){
  let dueAt=Date.parse(repair.createdAt)+RETENTION_DELAY;if(!Number.isFinite(dueAt))continue;
  let passed=false,failed=false;
  const evidence=(events||[]).filter(e=>e.type==='drill_practice_answered'&&e.practicePhase==='retention'&&e.retentionRepairId===repair.id&&e.domain===skill&&Date.parse(e.createdAt)<=now).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  for(const e of evidence){const at=Date.parse(e.createdAt);if(!Number.isFinite(at)||at<dueAt)continue;if(e.correct===true){passed=true;break;}if(e.correct===false){failed=true;dueAt=at+RETENTION_DELAY;}}
  if(!passed)pending.push({skill,repairId:repair.id,sourceYear,dueAt,due:now>=dueAt,failed});
 }
 return pending;
}
