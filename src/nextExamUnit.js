import {UNIT} from './nextExamUnitData.js';
export {UNIT};
export const UNIT_KEY=`draft:unit:${UNIT.unitId}:r${UNIT.revision}`;
export const DAY=86400000;
export function unitKey(unit=UNIT){return `draft:unit:${unit.unitId}:r${unit.revision}`;}
export function newUnitState(now=Date.now(),unit=UNIT){
 const UNIT=unit,UNIT_KEY=unitKey(unit);
 return {year:UNIT_KEY,draftId:UNIT_KEY,draftType:'learning-unit',unitId:UNIT.unitId,revision:UNIT.revision,generation:0,step:0,answer:'',evidence:'',assessment:{},records:[],target:60,startedAt:now};
}
export function formalCheck(answer,item){return {nonempty:!!answer.trim(),length:[...answer.replace(/\r?\n/g,'')].length,within:[...answer.replace(/\r?\n/g,'')].length<=item.max};}
export function gradeSelf(answer,evidence,item,assessment){
 const f=formalCheck(answer,item);
 if(!f.nonempty||!evidence.trim()||!f.within)return 'needs-repair';
 const values=[...item.criteria.map((_,i)=>assessment[i]),assessment.grounding];
 if(values.some(x=>!x||x==='uncertain'))return 'pending';
 return values.every(x=>x==='yes')?'self-confirmed':'needs-repair';
}
export function eligibleRecords(state){return (state.records||[]).filter(r=>['self-confirmed','human-confirmed'].includes(r.result)&&r.assistance==='none'&&r.firstExposure===true);}
export function readiness(state, verified={},unit=UNIT){
 const evidenceState={...state,records:verified.reviewedRecords||state.records};
 const rows=eligibleRecords(evidenceState), texts=new Set(rows.filter(r=>r.mode==='transfer').map(r=>r.passageId));
 const delayed=rows.some(r=>r.mode==='delayed'&&r.submittedAt-state.delayStartedAt>=DAY);
 const reasons=[];
 if(texts.size<2)reasons.push('異なる2本文で補助なしの確認');
 if(!delayed)reasons.push('24時間以上空けた未使用問題の確認');
 if(!(evidenceState.records||[]).some(r=>r.mode==='reproduction'&&['self-confirmed','human-confirmed'].includes(r.result)&&r.assistance==='none'))reasons.push('ヒントなしの自力再現');
 if(!unit.items.filter(i=>i.mode==='mixed').every(item=>rows.some(r=>r.itemId===item.id)))reasons.push('解き方を自分で選ぶ混合確認');
 if(verified.examLevel!==true||verified.withinTime!==true||verified.pathwayPoints<state.target||!Number.isFinite(verified.pathwayPoints))reasons.push('入試相当の長文・時間配分・得点経路の確認');
 if(verified.humanReviewed!==true)reasons.push('記述の保護者・指導者による内容確認');
 for(const reason of verified.missing||[])if(!reasons.includes(reason))reasons.push(reason);
 return {label:reasons.length?'確認待ち／条件付き受験':'次年度受験を勧める',reasons,transferTexts:texts.size,delayed,examAllowed:true};
}
export function preparation(events,target,nextExamKey){
 const first=new Map();
 for(const e of [...events].sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))))
  if(e.type==='exam_completed'&&e.attempt==='first'&&!first.has(String(e.examId??e.year)))first.set(String(e.examId??e.year),e);
 const exams=[...first.values()],latest=exams.at(-1);
 const measured=latest&&typeof latest.totalScore==='number'&&Number.isFinite(latest.totalScore);
 const rows=(latest?.questionResults||[]).map(q=>({id:q.id,points:q.points,score:q.score,cause:q.reason||'原因未確定',loss:typeof q.score==='number'&&typeof q.points==='number'?Math.max(0,q.points-q.score):null}));
 const causes=new Map();for(const row of rows)if(row.loss>0)causes.set(row.cause,(causes.get(row.cause)||0)+row.loss);
 return {target,nextExamKey:nextExamKey??null,diagnostic:latest??null,score:measured?latest.totalScore:null,gap:measured?Math.max(0,target-latest.totalScore):null,rows,priorities:[...causes].sort((a,b)=>b[1]-a[1]).slice(0,3),allCauses:[...causes],status:measured?(latest.totalScore>=target?'今回の選択目標は達成。安定性は別途確認。':'目標未達。失点原因から再補強。'):'本人データ未提供／個人別診断未実施',exposure:'旧履歴の初回タグだけでは未見・補助なしを認定しません。条件と採点根拠の確認が必要です。'};
}
export function replan(cause,unit=UNIT){
 if(unit.unitId!==UNIT.unitId){const action={basic:unit.lesson?.[0],transfer:unit.lesson?.[1],delay:"解き方を見ずに説明し、未使用の別本文で後日確かめる。",time:"保留する問題に印を付け、長文の小セットで戻る順序を練習する。",form:"内容と字数・文末を分けて確認する。",scoring:"答案の各要素を基準と照合し、保護者・指導者に確認する。"};return action[cause]||action.basic;}
 const routes={transfer:'根拠を二列に分ける練習へ戻り、異なる話題でも同じ観点を探す。',delay:'解き方を思い出して説明し、次回は別の未使用確認問題を用意する。',time:'根拠を先に二つ選び、保留して戻る時間配分を練習する。',form:'内容を保ち、字数・文末を仕上げチェックする。',scoring:'答案と基準を保護者・指導者と照合する。',basic:'例題で二者と比較する観点を確認し、支援付き練習へ戻る。'};
 return routes[cause]||routes.basic;
}

