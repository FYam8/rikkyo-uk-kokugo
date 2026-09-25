import React,{useState} from 'react';
import TextAnswerEditor from './TextAnswerEditor.jsx';
import AnswerReference from './AnswerReference.jsx';
export default function SourceReplay({question,record,rule,value={},onChange,grade,ChoiceEditor,imageSrc}){
 const [partIndex,setPartIndex]=useState(0);
 const answer=value.answer||'',checked=value.checked===true;
 const result=checked&&rule?grade(rule,answer):null;
 const update=answer=>onChange({answer,checked:false,confirmed:false});
 const format=question.answerFormat;
 return <section className="card sourceReplay"><h3>元問題を解き直す：大問{question.section} 問{question.question}</h3>
 <p>解説を閉じ、本文の根拠から自分でもう一度答えてください。</p>
 <details><summary>元の問題ページを見る</summary><img style={{width:'100%'}} src={imageSrc} alt="元問題のページ"/></details>
 {!format?<textarea aria-label="解き直しの答案" value={answer} onChange={e=>update(e.target.value)}/>:['text','text-parts'].includes(format.kind)?<TextAnswerEditor format={format} value={answer} onChange={update}/>:<ChoiceEditor format={format} value={answer} onChange={update} partIndex={partIndex} onPartIndex={setPartIndex}/>}
 <button disabled={!answer.trim()} onClick={()=>onChange({...value,answer,checked:true,confirmed:!!rule&&grade(rule,answer)?.correct===true})}>解き直しを照合する</button>
 {checked&&<><AnswerReference question={question} record={record}/>{rule?<p>{result?.correct?'正答と一致しました。':'違う部分を根拠から確かめ、もう一度答えてください。'}</p>:<label><input type="checkbox" checked={!!value.confirmed} onChange={e=>onChange({...value,confirmed:e.target.checked})}/>必須要素・本文根拠・設問条件を満たしていることを自己照合した</label>}</>}
 </section>;
}
