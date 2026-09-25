import {KANJI_CONTENT_SET} from './kanji50.js';
export function repairDraftKey(year,sessionId){return `draft:repair:${String(year)}:${KANJI_CONTENT_SET}:${sessionId}`;}
export function repairSessionPlan(session){
  const ref=item=>({id:item.id,revision:Number(item.revision||1),...(item.key?{key:item.key}:{})});
  return {skills:session.skills,bySkill:Object.fromEntries(session.skills.map(skill=>[skill,{
    basic:session.bySkill[skill].basic.map(ref),transfer:session.bySkill[skill].transfer.map(ref)
  }])),mixedItems:session.mixedItems.map(ref)};
}
export function hydrateRepairSession(draft,items){
  if(draft?.draftType!=='repair-session'||draft.contentSet!==KANJI_CONTENT_SET||!draft.draftId||draft.sourceYear===undefined||draft.sourceYear===null||String(draft.sourceYear)==='')return null;
  const plan=draft.sessionPlan,skills=plan?.skills;
  if(!Array.isArray(skills)||!skills.length||new Set(skills).size!==skills.length||!Array.isArray(draft.allSkills)||skills.some(s=>!draft.allSkills.includes(s)))return null;
  const map=new Map(items.map(item=>[item.id,item])),bySkill={};
  const hydrate=(ref,skill,phase)=>{
    const item=map.get(ref?.id);
    if(!item||Number(item.revision||1)!==Number(ref.revision)||item.sourceSkill!==skill||item.phase!==phase)return null;
    return {...item,skill,key:`${skill}:${item.id}`};
  };
  for(const skill of skills){
    const group=plan.bySkill?.[skill];
    if(!group?.basic?.length||!group?.transfer?.length)return null;
    const basic=group.basic.map(ref=>hydrate(ref,skill,'基本')),transfer=group.transfer.map(ref=>hydrate(ref,skill,'転用'));
    if([...basic,...transfer].some(item=>!item))return null;
    bySkill[skill]={basic,transfer};
  }
  if(!Array.isArray(plan.mixedItems)||plan.mixedItems.length!==skills.length)return null;
  const mixedItems=plan.mixedItems.map((ref,i)=>hydrate(ref,skills[i],'混合確認'));
  if(mixedItems.some(item=>!item))return null;
  const stage=draft.stage||'review';
  if(!['review','basic','transfer','mixed','mixed-self-review','mixed-result','complete'].includes(stage))return null;
  for(const value of [draft.skillIndex??0,draft.itemIndex??0,draft.mixedIndex??0])if(!Number.isInteger(value)||value<0)return null;
  if(['basic','transfer'].includes(stage)&&!bySkill[skills[draft.skillIndex||0]]?.[stage]?.[draft.itemIndex||0])return null;
  if(stage==='mixed'&&!mixedItems[draft.mixedIndex||0])return null;
  return {skills,bySkill,mixedItems,variant:Number(draft.variant||0)};
}

