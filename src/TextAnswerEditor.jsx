import React from 'react';
import {parseTextParts,setTextPart} from './textAnswer.js';
export default function TextAnswerEditor({format,value,onChange}){
  const parts=format.kind==='text-parts'?parseTextParts(value,Number(format.parts||1)):[String(value??'')];
  return <div className="textAnswerParts">{parts.map((part,i)=><label className="writtenAnswer" key={i}>
    <span>{format.labels?.[i]||(parts.length===1?'解答':`解答 ${i+1}`)}</span>
    <input type="text" aria-label={format.labels?.[i]||(parts.length===1?'解答':`解答 ${i+1}`)} autoComplete="off" value={part} onChange={e=>onChange(format.kind==='text-parts'?setTextPart(value,i,e.target.value,parts.length):e.target.value)}/>
    <small>{[...part].length}字入力{format.hints?.[i]?`・${format.hints[i]}`:''}</small>
  </label>)}</div>;
}
