import { LEARNING_PATH_CONFIG } from '../schoolLearningConfig.js';
import { weaknessLedger } from '../learningPath.js';
import { pendingRetention } from '../retention.js';

export const CLOUD_EXAMS=LEARNING_PATH_CONFIG.examKeys.map(key=>({key,id:key.replace('-',''),year:'20'+key.slice(2,4),session:key.at(-1)}));
const iso=value=>typeof value==='string'&&Date.parse(value)>0?new Date(value).toISOString():null;
export function learningTime(row){return [row?.completedAt,row?.finishedAt,row?.createdAt,row?.timestamp,row?.at,row?.savedAt,row?.updatedAt,row?.startedAt].map(iso).filter(Boolean).sort().at(-1)||null;}
const identity=row=>String(row?.examId??row?.year??row?.sourceExamId??row?.sourceYear??'').replace('-','');
export function referenceResult(event){
 const rows=(event?.questionResults||[]).filter(q=>Number(q.points)>0&&Number.isFinite(q.score)&&q.score>=0&&q.score<=Number(q.points));
 if(!rows.length)return {};
 const correct=rows.filter(q=>q.score===Number(q.points)).length,total=rows.length;
 return {correct,total,referenceAccuracy:correct/total*100};
}
export function summarizeOutgoingEvent(event,legacy){
 const payload={...legacy};delete payload.score;delete payload.maxScore;
 const exam=CLOUD_EXAMS.find(x=>x.id===identity(event));
 if(exam){payload.year=exam.year;payload.progressVersion=2;payload.examId=exam.id;payload.session=exam.session;}
 if(exam&&event?.type==='exam_completed')Object.assign(payload,referenceResult(event),{completed:true,examStatus:'done'});
 return payload;
}
export function outgoingBaseline(summary){
 const years={};for(const [key,count] of Object.entries(summary.eventsByYear||{})){const exam=CLOUD_EXAMS.find(x=>x.id===key.replace('-',''));const year=exam?.year||(/^20\d{2}$/.test(key)?key:null);if(year)years[year]=(years[year]||0)+Number(count||0);}
 // Historical normalized scores are not official points. Keep the stored baseline
 // and its fingerprints unchanged; only project its allowed outgoing summary.
 return {...summary,eventsByYear:years,scoredEventCount:0,scoreTotal:0};
}
export function buildStateRecords({events=[],drafts=[]}={}){
 const now=new Date().toISOString(),last=[...events,...drafts].map(learningTime).filter(Boolean).sort().at(-1);
 const ledger=weaknessLedger(events),mastered=ledger.filter(x=>x.status==='定着済み').length;
 const payload={progressVersion:2,total:events.length+drafts.length,completed:false,weaknessCount:ledger.length-mastered,masteredCount:mastered,practiceCount:events.filter(x=>x.type==='drill_practice_answered').length,retentionPending:CLOUD_EXAMS.reduce((n,x)=>n+pendingRetention(events,x.key).length,0),...(last?{lastLearningAt:last}:{})};
 const records=[{sourceRecordId:'state:summary',eventType:'progress_state',occurredAt:now,payload}];
 for(const exam of CLOUD_EXAMS){
  const related=events.filter(x=>identity(x)===exam.id),completed=related.some(x=>x.type==='exam_completed'),started=related.length>0||drafts.some(x=>identity(x)===exam.id);
  const holdout=LEARNING_PATH_CONFIG.holdoutPolicy?.strict&&LEARNING_PATH_CONFIG.holdoutPolicy.examKeys.includes(exam.key);
  records.push({sourceRecordId:'state:exam:'+exam.id,eventType:'exam_state',occurredAt:now,payload:{progressVersion:2,examId:exam.id,year:exam.year,session:exam.session,examStatus:completed?'done':started?'started':holdout?'holdout':'notstarted',completed}});
 }
 const latest=events.filter(x=>x.type==='exam_completed'&&CLOUD_EXAMS.some(e=>e.id===identity(x))).sort((a,b)=>String(learningTime(b)||'').localeCompare(String(learningTime(a)||'')))[0];
 const exam=CLOUD_EXAMS.find(x=>x.id===identity(latest)),result=referenceResult(latest),at=learningTime(latest);
 records.push({sourceRecordId:'state:latest-exam',eventType:result.total?'exam_completed':'exam_state',occurredAt:at||(latest?'1970-01-01T00:00:00.000Z':now),payload:exam&&result.total?{progressVersion:2,examId:exam.id,year:exam.year,session:exam.session,...result,completed:true,...(at?{lastLearningAt:at}:{clockUnknown:true})}:{completed:false}});
 return records;
}
