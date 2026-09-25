import {UNIT} from './nextExamUnitData.js';
// Evidence is an annotation over immutable learning records, never an exam score edit.
export function answerReference(r){return JSON.stringify([r.itemId,r.revision,r.submittedAt,r.answer,r.evidence]);}
export function examReference(e){return JSON.stringify([e.id,e.contentVersion,e.totalScore,e.elapsedSeconds,(e.questionResults||[]).map(q=>[q.id,q.points,q.score,q.answer]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);}
export function firstExamRecords(events){
 const seen=new Set();return [...events].filter(e=>e?.type==='exam_completed'&&e.attempt==='first').sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))).filter(e=>{const k=String(e.examId??e.year);if(seen.has(k))return false;seen.add(k);return true;});
}
export function latestAnnotation(rows,reference){return [...(rows||[])].reverse().find(r=>r.reference===reference)||null;}
export function acceptedReview(r){return !!r&&['guardian','teacher'].includes(r.role)&&r.result==='confirmed'&&!!r.basis?.trim()&&Number.isFinite(r.recordedAt);}
export function examEvidence(event,annotation,manifest,target){
 const missing=[];const qs=manifest?.years?.[String(event?.examId??event?.year)]?.questions||[];
 const results=event?.questionResults||[],ids=new Set(qs.map(q=>q.id));
 const match=!!event&&!!annotation&&annotation.reference===examReference(event);
 const snapshot=!!event&&event.contentVersion===manifest?.contentVersion&&qs.length>0&&ids.size===qs.length&&results.length===qs.length&&new Set(results.map(q=>q.id)).size===qs.length&&results.every(r=>qs.some(q=>q.id===r.id&&q.points===r.points)&&Number.isFinite(r.score)&&r.score>=0&&r.score<=r.points)&&results.reduce((n,q)=>n+q.score,0)===event.totalScore;
 if(!match)missing.push('今回の答案に結びついた条件記録');
 if(!snapshot)missing.push('教材版・全解答欄・配点・得点の一致');
 const selected=annotation?.selectedIds||[];const chosen=new Set(selected);
 const validPath=snapshot&&chosen.size===selected.length&&selected.length>0&&selected.every(id=>ids.has(id));
 const points=validPath?qs.filter(q=>chosen.has(q.id)).reduce((n,q)=>n+q.points,0):null;
 if(points===null||points<target)missing.push('目標以上の配点を含む得点経路');
 const limit=annotation?.limitSeconds;
 const within=match&&Number.isFinite(event.elapsedSeconds)&&event.elapsedSeconds>0&&Number.isFinite(limit)&&limit>0&&event.elapsedSeconds<=limit&&!!annotation.limitSource?.trim()&&annotation.uninterrupted===true;
 if(!within)missing.push('制限時間の出所・中断条件・実測時間');
 const fresh=match&&annotation.exposure==='unseen'&&annotation.noHelp===true;
 if(!fresh)missing.push('本文・解答の事前露出なし／補助なしの条件');
 if(!acceptedReview(annotation))missing.push('保護者・指導者による採点・残る失点の確認');
 return {missing,points,within,fresh,snapshot,confirmed:missing.length===0};
}
export function verifiedEvidence(state,events,manifest,unit=UNIT){
 const records=state.records||[],reviews=state.answerReviews||[],exams=firstExamRecords(events);
 const exam=exams.find(e=>e.id===state.examEvidence?.eventId);
 const audit=examEvidence(exam,state.examEvidence,manifest,state.target);
 const latest=exam?.id===exams.at(-1)?.id&&!!exam;
 if(!latest)audit.missing.push('最新の初回答案に基づく受験条件・失点の再確認');
 const reviewedRecords=records.map(r=>{
  const item=unit.items.find(i=>i.id===r.itemId&&r.revision===unit.revision);
  const review=latestAnnotation(reviews,answerReference(r));
  const valid=item&&typeof r.answer==='string'&&r.answer.trim()&&typeof r.evidence==='string'&&r.evidence.trim()&&[...r.answer.replace(/\r?\n/g,'')].length<=item.max;
  if(!valid)return {...r,result:'pending'};
  if(acceptedReview(review))return {...r,result:'human-confirmed'};
  if(review&&['teacher','guardian'].includes(review.role))return {...r,result:review.result==='repair'?'needs-repair':'pending'};
  return r;
 });
 const required=reviewedRecords.filter(r=>r.assistance==='none'&&['self-confirmed','human-confirmed'].includes(r.result)&&['reproduction','transfer','mixed','delayed'].includes(r.mode));
 const humanReviewed=required.length>0&&required.every(r=>acceptedReview(latestAnnotation(reviews,answerReference(r))));
 return {examLevel:latest&&audit.snapshot&&audit.fresh&&acceptedReview(state.examEvidence),withinTime:audit.within,pathwayPoints:audit.points,humanReviewed,missing:audit.missing,exam,reviewed:required.filter(r=>acceptedReview(latestAnnotation(reviews,answerReference(r)))).length,required:required.length,reviewedRecords};
}
export function observedOutcomes(events,annotations,target,manifest){
 return firstExamRecords(events).map(e=>{
  const a=latestAnnotation(annotations,examReference(e));
  const valid=examEvidence(e,a,manifest,target).snapshot&&acceptedReview(a)&&a.noHelp===true&&a.exposure==='unseen'&&a.uninterrupted===true&&Number.isFinite(a.limitSeconds)&&a.limitSeconds>0&&!!a.limitSource?.trim()&&Number.isFinite(e.elapsedSeconds)&&e.elapsedSeconds>0&&e.elapsedSeconds<=a.limitSeconds&&Number.isFinite(e.totalScore);
  return {eventId:e.id,year:e.examId??e.year,score:e.totalScore,qualified:valid,result:valid?(e.totalScore>=target?'目標達成':'目標未達'):'条件・採点の確認待ち'};
 });
}

