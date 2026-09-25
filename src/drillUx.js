const KANA=['ア','イ','ウ','エ','オ','カ','キ','ク','ケ','コ'];

export function getVisiblePracticeItems(items=[]){
  return items.filter(item=>item?.libraryHidden!==true);
}

export function buildPracticeStats(events=[],items=[]){
  const map=new Map();
  const revisions=new Map((items||[]).map(item=>[String(item.id),Number(item.revision||1)]));
  for(const event of (events||[]).filter(e=>e?.type==='drill_practice_answered').sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)))){
    const key=String(event.itemId||'');
    if(!key) continue;
    const currentRevision=revisions.get(key);
    if(currentRevision!==undefined&&Number(event.itemRevision||1)!==currentRevision) continue;
    const current=map.get(key)||{attempts:0,correct:0,latest:null};
    current.attempts++;
    if(event.correct===true) current.correct++;
    current.latest=event;
    map.set(key,current);
  }
  return map;
}

export function buildLifetimePracticeStats(events=[],items=[],retainLifetimeIds=[]){
  const current=buildPracticeStats(events,items);
  const all=buildPracticeStats(events);
  const retained=new Set(retainLifetimeIds||[]);
  for(const item of items) if(retained.has(item.id)&&all.has(item.id)) current.set(item.id,all.get(item.id));
  return current;
}

export function usedPracticeRefs(events=[],items=[],legacyExcludedIds=[]){
  const current=new Map((items||[]).map(item=>[item.id,Number(item.revision||1)]));
  const excluded=new Set(legacyExcludedIds||[]);
  return (events||[]).filter(e=>e?.type==='repair_block_completed').flatMap(e=>{
    if(Array.isArray(e.drillItemRefs)) return e.drillItemRefs.filter(ref=>current.get(ref.id)===Number(ref.revision)).map(ref=>ref.id);
    return (e.drillItemIds||[]).filter(id=>!excluded.has(id));
  });
}

export function selectPracticeItems(items=[],stats=new Map(),mode='recommended'){
  const unseen=items.filter(item=>!stats.has(item.id));
  const wrong=items.filter(item=>stats.get(item.id)?.latest?.correct===false);
  const correct=items.filter(item=>stats.get(item.id)?.latest?.correct===true);
  if(mode==='unseen') return unseen;
  if(mode==='wrong') return wrong;
  if(mode==='all') return [...items];
  return [...unseen,...wrong,...correct];
}

function normalizeRepairSkills(bank,skills=[]){
  const available=Object.keys(bank||{}),out=[];
  for(const s of skills) if(available.includes(s)&&!out.includes(s)) out.push(s);
  return out;
}
function rotate(items,offset=0){
  if(!items.length) return [];
  const n=((offset%items.length)+items.length)%items.length;
  return [...items.slice(n),...items.slice(0,n)];
}
function unseenFirst(items,usedIds=new Set()){
  const fresh=[],seen=[];
  for(const item of items) (usedIds.has(item.id)?seen:fresh).push(item);
  return [...fresh,...seen];
}

export function buildDrillSession(bank,skills=[],variant=0,usedItemIds=[]){
  const selected=normalizeRepairSkills(bank,skills);
  const usedIds=new Set(usedItemIds||[]);
  const bySkill={};
  for(const skill of selected){
    const all=bank?.[skill]||[];
    bySkill[skill]={
      basic:unseenFirst(rotate(all.filter(x=>x.phase==='基本'),variant),usedIds),
      transfer:unseenFirst(rotate(all.filter(x=>x.phase==='転用'),variant+1),usedIds),
      mixed:unseenFirst(rotate(all.filter(x=>x.phase==='混合確認'),variant+2),usedIds)
    };
  }
  return {
    skills:selected,
    variant,
    bySkill,
    mixedItems:selected.map(skill=>({...bySkill[skill].mixed[0],skill,key:`${skill}:${bySkill[skill].mixed[0]?.id}`})).filter(x=>x.id)
  };
}

export function basicPassed(outcomes=[]){
  if(outcomes.length<2) return false;
  const last=outcomes.slice(-2);
  return last.every(x=>x.correct===true&&x.stable!==false);
}
export function currentTransferRound(outcomes=[],itemIndex=0){
  const answeredInRound=Math.min(3,Math.max(0,Number(itemIndex)+1));
  return outcomes.slice(-answeredInRound);
}
export function transferResult(outcomes=[]){
  const latest=outcomes.slice(-3);
  const correct=latest.filter(x=>x.correct).length;
  const traps=latest.filter(x=>!x.correct&&x.trap).map(x=>x.trap);
  const repeatedTrap=traps.some((t,i)=>traps.indexOf(t)!==i);
  return {passed:latest.length===3&&correct>=2&&!repeatedTrap,correct,total:latest.length,repeatedTrap};
}

export function writtenAnswerChecks(item,response){
  const raw=String(response??'').normalize('NFKC').replace(/[\s　]/g,'');
  const rules=item?.writingRules||{};
  const length=[...raw].length;
  const lengthMet=!!length&&(!rules.min||length>=rules.min)&&(!rules.max||length<=rules.max);
  const startsWithMet=!rules.startsWith||raw.startsWith(rules.startsWith);
  const endsWithMet=!rules.endsWith||raw.endsWith(rules.endsWith);
  const groupChecks=(rules.requiredGroups||[]).map(group=>({terms:[...(group||[])],met:(group||[]).some(term=>raw.includes(term))}));
  const requiredGroupsMet=groupChecks.every(group=>group.met);
  return {length,lengthMet,startsWithMet,endsWithMet,requiredGroupsMet,groupChecks,
    criteriaMet:lengthMet&&startsWithMet&&endsWithMet&&requiredGroupsMet};
}
export function writtenSelfAssessmentResult(item,checks,assessment={}){
  const required=item?.selfAssessment?.required||[];
  const elementAssessments=assessment?.elementAssessments||{};
  const allElementsAnswered=required.length>0&&required.every(element=>['met','missing','unsure'].includes(elementAssessments[element.id]));
  const allRequiredElementsMet=allElementsAnswered&&required.every(element=>elementAssessments[element.id]==='met');
  const unsupportedContentConfirmedAbsent=assessment?.unsupportedContent==='absent';
  const completed=allElementsAnswered&&['absent','possible'].includes(assessment?.unsupportedContent);
  const eligible=!!checks?.criteriaMet&&completed&&allRequiredElementsMet&&unsupportedContentConfirmedAbsent;
  const selfCorrect=eligible&&assessment?.outcome==='self-pass';
  const outcome=selfCorrect?'self-pass':assessment?.outcome==='learned-not-mastered'?'learned-not-mastered':'rewrite';
  return {completed,allElementsAnswered,allRequiredElementsMet,unsupportedContentConfirmedAbsent,eligible,selfCorrect,outcome};
}

export function mixedResult(items=[],answers={},writtenAssessments={},answerChecker){
  if(typeof answerChecker!=='function') throw new Error('mixedResult requires answerChecker');
  const results=items.map(item=>{
    const criteriaMet=answerChecker(item,answers[item.key]);
    const writtenResult=item.responseType==='written'
      ?writtenSelfAssessmentResult(item,writtenAnswerChecks(item,answers[item.key]),writtenAssessments[item.key])
      :null;
    return {skill:item.skill,id:item.id,revision:Number(item.revision||1),criteriaMet,selfAssessed:item.responseType==='written',
      correct:item.responseType==='written'?writtenResult.selfCorrect:criteriaMet};
  });
  const failedSkills=[...new Set(results.filter(x=>!x.correct).map(x=>x.skill))];
  return {passed:results.length>0&&failedSkills.length===0,results,failedSkills,correct:results.filter(x=>x.correct).length,total:results.length};
}
export function optionLabel(i){return KANA[i]||String(i+1);}

