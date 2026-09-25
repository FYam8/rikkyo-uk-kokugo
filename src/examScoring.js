// School-selectable scoring. An excluded authority never becomes a wrong answer.
export function normalizedParentScoring(policy){
  const method=policy?.method;
  if(method==null||method==='point-sum') return false;
  if(method!=='normalized-parent-correctness') throw new Error('Unsupported scoring method');
  return true;
}
export function isScorableQuestion(question,policy){
  return !normalizedParentScoring(policy)||question.answerAuthority==='APP_DERIVED_VERIFIED';
}
export function summarizeExamScore(questions,results,policy){
  if(!normalizedParentScoring(policy)) return {totalScore:results.reduce((sum,q)=>sum+q.score,0),maxScore:100};
  if(new Set(questions.map(q=>q.id)).size!==questions.length) throw new Error('Duplicate parent question ID');
  const eligible=questions.filter(q=>isScorableQuestion(q,policy));
  const excluded=questions.filter(q=>!isScorableQuestion(q,policy));
  if(!eligible.length) throw new Error('No verified parent questions to score');
  const byId=new Map(results.map(q=>[q.id,q]));
  if(byId.size!==results.length||results.length!==eligible.length||results.some(r=>!eligible.some(q=>q.id===r.id))) throw new Error('Score results do not match verified parent questions');
  let earnedParentCredit=0;
  for(const q of eligible){
    const result=byId.get(q.id),max=Number(q.points),score=result?.score;
    if(!Number.isFinite(max)||max<=0||typeof score!=='number'||!Number.isFinite(score)||score<0||score>max) throw new Error(`Invalid parent score: ${q.id}`);
    earnedParentCredit+=score/max;
  }
  return {
    totalScore:Math.round(1000*earnedParentCredit/eligible.length)/10,maxScore:100,
    scoringMethod:'normalized-parent-correctness',officialScoreClaim:false,
    earnedParentCredit,scoredParentCount:eligible.length,visibleParentCount:questions.length,
    excludedQuestions:excluded.map(q=>({id:q.id,answerAuthority:q.answerAuthority||'REVIEW_REQUIRED'}))
  };
}
