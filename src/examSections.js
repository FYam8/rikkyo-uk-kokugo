// Sections come from visible questions, never from assumed booklet completeness.
export function examSectionIds(exam){
  const ids=[...new Set((exam?.questions||[]).map(q=>Number(q.section)))];
  if(ids.some(id=>!Number.isInteger(id)||id<1)) throw new Error('Invalid exam section');
  return ids.sort((a,b)=>a-b);
}
export function initialExamPosition(exam){
  const sections=examSectionIds(exam);
  if(!sections.length) throw new Error('No available questions');
  const section=sections[0];
  const first=exam.questions.find(q=>Number(q.section)===section);
  return {section,page:Number(first.page||exam.sectionStarts?.[String(section)]||1),sectionSeconds:Object.fromEntries(sections.map(s=>[s,0]))};
}
export function adjacentSection(exam,current,direction){
  const sections=examSectionIds(exam),i=sections.indexOf(Number(current));
  return i<0?null:sections[i+(direction>0?1:-1)]??null;
}
