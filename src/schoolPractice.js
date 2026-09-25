import {writtenAnswerChecks} from './drillUx.js';
// A data adapter shared by schools; all STEP/history behavior stays in drillUx.
export function createSchoolPractice(data,unitSkills){
 const phases={basic:'基本',transfer:'転用',mixed:'混合確認',retention:'翌日確認'};
 const bank={},items=[];
 for(const unit of data.units){
  const unitSkill=unitSkills[unit.id];if(!unitSkill)throw new Error(`Missing repair skill: ${unit.id}`);
  for(const source of unit.items){
   const skill=source.repairSkill||unitSkill;bank[skill]||=[];
   const options=source.options||[],index=id=>options.findIndex(x=>x.id===id);
   const item={...source,q:source.prompt,why:source.explanation,phase:phases[source.phase],
    sourcePhase:source.phase,unitId:unit.id,skill,sourceSkill:skill,domain:skill,practiceType:phases[source.phase],
    passage:{id:unit.id+':'+source.phase,genre:{kanji:'漢字・語彙',literary:'文学',expository:'説明文'}[unit.domain],text:source.passage},
    responseType:['extraction'].includes(source.responseType)?'text':source.responseType==='true-false'?'single':source.responseType,
    options:options.map(x=>x.text),libraryHidden:source.phase==='retention',
    acceptedAnswers:source.acceptableAnswers||[source.modelAnswer??source.answer],strictText:['text','extraction'].includes(source.responseType),
    trap:skill,writingRules:{min:source.rubric?.minCharacters,max:source.rubric?.maxCharacters},
    selfAssessment:{required:(source.rubric?.requiredElements||[]).map((label,i)=>({id:`element-${i+1}`,label}))}};
   if(item.responseType==='single')item.answer=index(source.answer);
   if(item.responseType==='multi')item.correctAnswers=source.answer.map(index);
   if(item.responseType==='order')item.correctOrder=source.answer.map(index);
   if(['single','multi','order'].includes(item.responseType)&&[item.answer,...(item.correctAnswers||[]),...(item.correctOrder||[])].filter(x=>x!==undefined).some(x=>x<0))throw new Error('Unknown practice option');
   items.push(item);if(source.phase!=='retention')bank[skill].push(item);
  }
 }
 const domains=Object.keys(bank).map(key=>({key,label:key,group:'skill',description:key}));
 return {bank,items,domains};
}
export function isSchoolDrillAnswerCorrect(item,response){
 if(response===null||response===undefined||response==='')return false;
 if(item.responseType==='written')return writtenAnswerChecks(item,response).criteriaMet;
 if(item.responseType==='text'){
  const normalize=s=>String(s??'').normalize('NFC').trim();
  return (item.acceptedAnswers||[]).some(answer=>normalize(response)===normalize(answer));
 }
 if(item.responseType==='multi'||item.responseType==='order'){
  if(!Array.isArray(response)||response.some(x=>!Number.isInteger(x)))return false;
  const actual=[...response],expected=[...(item.responseType==='multi'?item.correctAnswers:item.correctOrder)];
  if(new Set(actual).size!==actual.length)return false;
  if(item.responseType==='multi'){actual.sort((a,b)=>a-b);expected.sort((a,b)=>a-b);}
  return actual.length===expected.length&&actual.every((x,i)=>x===expected[i]);
 }
 return Number.isInteger(response)&&response===item.answer;
}
