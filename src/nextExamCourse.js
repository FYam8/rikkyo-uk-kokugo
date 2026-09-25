import {COURSE_UNITS} from './nextExamCourseData.js';
import {unitKey,DAY} from './nextExamUnit.js';
import {firstExamRecords,verifiedEvidence} from './nextExamEvidence.js';
import {inferCause} from './learningPath.js';
export function routeSkill(cause){if(/古文/.test(cause))return '古文の主語・人物関係';if(/記述|形式/.test(cause))return '記述要素不足';if(/本文|論理|選択肢|設問|心情/.test(cause))return '本文根拠不足';return null;}
export function coursePlan(events,drafts={},now=Date.now(),units=COURSE_UNITS){
 const exams=firstExamRecords(events),latest=exams.at(-1),losses=new Map(),uncovered=new Map();
 for(const q of latest?.questionResults||[]){if(!Number.isFinite(q.points)||!Number.isFinite(q.score)||q.score<0||q.score>q.points)continue;const loss=q.points-q.score;if(loss<=0)continue;const cause=inferCause(q),skill=routeSkill(cause),map=skill?losses:uncovered,key=skill||cause;map.set(key,(map.get(key)||0)+loss);}
 const rows=units.map((unit,index)=>{
  const s=drafts[unitKey(unit)],records=s?.records||[],last=records.at(-1);
  const unfinished=!!s&&(!!s.answer||!!s.evidence||!!s.submission||s.step>0&&s.step<7);
  const due=s?.step===7&&Number.isFinite(s.delayStartedAt)&&now>=s.delayStartedAt+DAY;
  const effective=s?verifiedEvidence(s,events,{},unit).reviewedRecords:[];
  const latestByItem=[...new Map(effective.map(r=>[r.itemId,r])).values()];
  const failure=latestByItem.filter(r=>r.mode!=='guided'&&!['self-confirmed','human-confirmed'].includes(r.result)).at(-1);
  const failed=!!failure;
  const completed=s?.step>=8;
  const newExam=latest&&Date.parse(latest.createdAt)>Number(last?.submittedAt||0);
  const loss=losses.get(unit.skill)||0;
  const recurrence=loss>0&&completed&&newExam;
  let action='学ぶ',why=latest?'今回の失点が少ない分野は任意の維持練習です。':'本人データ未提供。代表的な基礎教材から選べます。';
  if(loss)why=`最新の初回受験で関連する失点${loss}点。原因は設問形式等からの推定です。次年度の増点予測ではありません。`;
  if(completed&&!recurrence){action='維持・長文へ';why='一通りの確認を記録済み。全問の正しさや入試到達を保証しません。新しい本文や長文へ進みます。';}
  if(failed){action='教え方を確認';why=failure.result==='pending'?'評価が保留です。答案と基準を照合し、不明なら他者に確認します。':`${failure.mode==='delayed'?'後日':failure.mode==='transfer'?'別本文':'練習'}で不足の記録があります。説明を変え、根拠を整理します。`;}
  if(recurrence){action='再補強';why+=' 学習後にも失点があるため、以前の完了だけでは済ませず長文で使い方を確かめます。';}
  if(due){action='後日の確認';why='24時間以上空きました。未使用の確認問題を解きます。';}
  if(unfinished){action='途中から再開';why='途中答案を最優先で保持します。新しい推薦で上書きしません。';}
  return {unit,action,why,loss,recurrence,completed,rank:unfinished?0:due?1:recurrence?2:failed?3:loss&&!completed?4:completed?6:5,index};
 }).sort((a,b)=>a.rank-b.rank||b.loss-a.loss||a.index-b.index);
 return {rows,active:rows.slice(0,3),uncovered:[...uncovered],latest};
}
export function bridgeFeedback(set,state){return set.questions.map(q=>{const a=state.submission?.answers?.[q.id];if(q.kind==='choice')return {id:q.id,skill:q.cause,status:a===undefined||a===''?'未回答':Number(a)===q.correct?'正答':'根拠を確認',reason:q.explanation};const f=state.assessments?.[q.id]||{};const status=!String(a||'').trim()?'未回答':[...String(a)].length>q.max?'字数超過':q.criteria.some((_,i)=>f[i]==='no')?'内容を再補強':q.criteria.every((_,i)=>f[i]==='yes')?'自己評価で確認':'採点保留';return {id:q.id,skill:q.cause,status,reason:q.explanation};});}

