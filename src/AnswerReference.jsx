import React from 'react';
import {schoolModelText,schoolRequiredElements} from './schoolReview.js';
export default function AnswerReference({question,record}){
 if(!record||record.state!=='APP_DERIVED_VERIFIED')return <p>この問題の正答は確認中です。採点対象には含めません。</p>;
 const elements=schoolRequiredElements(record);
 return <article className="card"><h3>大問{question.section} 問{question.question}</h3>
 <p><b>答案例（アプリ作成・非公式）</b></p><p style={{whiteSpace:'pre-wrap'}}>{schoolModelText(record)}</p>
 {elements.length>0&&<><b>必須要素を自己照合</b><ul>{elements.map((x,i)=><li key={i}>{x}</li>)}</ul><p>意味・本文の根拠が合う別表現も認めます。答案例との完全一致は必要ありません。</p></>}
 {!!record.rubric?.acceptableVariants?.length&&<p>許容する表現：{record.rubric.acceptableVariants.join('／')}</p>}
 {record.checks?.[1]?.detail&&<p>根拠の照合：{record.checks[1].detail}</p>}
 <p>本文根拠：{record.sourceEvidence?.contextBrief||record.checks?.[0]?.detail}</p>
 </article>;
}
