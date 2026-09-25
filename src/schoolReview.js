import {displayAnswer} from './answerUi.js';
import {reviewPriority} from './reviewEngine.js';
const text=value=>Array.isArray(value)?value.map(text).join(' / '):value&&typeof value==='object'?Object.values(value).map(text).join(' / '):String(value??'');
export function schoolModelText(record){
 if(!record)return '';
 if(record.modelAnswer||record.modelSpec)return record.modelAnswer||record.modelSpec;
 const parts=record.parts||record.cells;
 if(parts)return parts.map(p=>`${p.label}: ${text(p.answer??p.modelAnswer??p.model??p.grading)}`).join('\n');
 return text(record.answer);
}
export function schoolRequiredElements(record){
 return [...(record?.rubric?.requiredElements||[]),...(record?.parts||[]).flatMap(p=>(p.rubric?.requiredElements||[p.grading].filter(Boolean)).map(x=>`${p.label} ${x}`))];
}
export function buildSchoolReview({question,result,rule,totalScore,review},profile,targets){
 const loss=Math.max(0,Number(question.points||0)-Number(result.score||0));
 const model=schoolModelText(review),elements=schoolRequiredElements(review);
 const evidence=[review?.sourceEvidence?.contextBrief,...(review?.checks||[]).map(c=>c.detail)].filter((v,i,a)=>v&&a.indexOf(v)===i).join('\n');
 return {id:question.id,loss,priority:reviewPriority(totalScore,loss,profile,targets),profile,type:profile?.type||question.topic,
  focus:profile?.focus||'原本の設問条件と本文の根拠を確認する',requirements:profile?.requirements||[],
  conclusion:model?`答案例（アプリ作成・非公式）：${model}`:'正答は確認中のため採点しません。',
  source:`問題冊子 ${review?.sourceEvidence?.sourcePages?.join('・')||question.page}ページ。${evidence||''}`,
  method:elements.length?'必要要素を本文へ戻して確認し、主語・理由・字数をそろえて答える。':'まず設問の指定を確認し、本文の根拠と答案を照合する。',
  wrong:`自分の答案：${displayAnswer(result.answer,question.answerFormat)||'未回答'}。答案例と根拠を照合する。`,
  errorFix:'誤答だけから原因を断定せず、違っている箇所を本文に戻って確認する。',
  replay:profile?.replay||'解説を閉じて、元の設問をもう一度解く。',
  elementChecks:elements.map((x,i)=>({label:String(i+1),text:x,status:'自己照合'})),officialModel:model,
  note:elements.length?'記述は同じ意味の別表現も認めます。学校公式解答・公式部分点ではありません。':'漢字・抜き出しは指定された表記と照合します。学校公式解答ではありません。',partAnalyses:[],optionAnalyses:[]};
}
