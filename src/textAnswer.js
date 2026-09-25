// Preserve exact source spelling and punctuation for extraction and kanji answers.
export function parseTextParts(raw,count){
  if(!Number.isInteger(count)||count<1) throw new Error('Invalid text part count');
  let values;
  try{const parsed=JSON.parse(String(raw??''));if(Array.isArray(parsed)&&parsed.every(x=>typeof x==='string'))values=parsed;}catch{}
  if(!values) values=[String(raw??'')];
  return Array.from({length:count},(_,i)=>values[i]??'');
}
export function setTextPart(raw,index,value,count){
  if(!Number.isInteger(index)||index<0||index>=count) throw new Error('Invalid text part index');
  const parts=parseTextParts(raw,count);parts[index]=String(value??'');return JSON.stringify(parts);
}
export function textAnswerState(raw,format){
  const count=Number(format.parts||1),parts=format.kind==='text-parts'?parseTextParts(raw,count):[String(raw??'')];
  const filled=parts.filter(x=>x.trim()).length;
  return filled===parts.length?'done':filled?'partial':'empty';
}
export function gradeTextAnswer(rule,raw){
  if(!['text','text-parts'].includes(rule?.kind)) return null;
  const expected=rule.answers,points=rule.points;
  if(!Array.isArray(expected)||!expected.length||!Array.isArray(points)||points.length!==expected.length||points.some(p=>!Number.isFinite(p)||p<=0)) throw new Error('Invalid text grading rule');
  if(rule.kind==='text'&&expected.length!==1) throw new Error('Single text rule must have one answer');
  const normalize=value=>String(value??'').normalize('NFC').trim();
  const actual=rule.kind==='text'? [String(raw??'')]:parseTextParts(raw,expected.length);
  const matches=expected.map((answer,i)=>{
    const variants=Array.isArray(answer)?answer:[answer];
    if(!variants.length||variants.some(a=>typeof a!=='string'||!normalize(a))) throw new Error('Empty text authority');
    return !!normalize(actual[i])&&variants.some(a=>normalize(a)===normalize(actual[i]));
  });
  return {score:matches.reduce((sum,ok,i)=>sum+(ok?points[i]:0),0),max:points.reduce((a,b)=>a+b,0),correct:matches.every(Boolean),tokens:actual,partCorrect:matches};
}
