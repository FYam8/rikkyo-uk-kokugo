export function normalizeKobunAnswer(value){
  return typeof value==='string'?value.normalize('NFC').replace(/\s/gu,''):null;
}

export function gradeExactKobun(answers,id,response){
  const key=answers?.[id];
  if(!key) throw new Error('Unknown kobun question');
  const actual=normalizeKobunAnswer(response);
  return !!actual&&actual===normalizeKobunAnswer(key.answer);
}

export function buildKobunEvents({sets,answers,contentSet,itemId},session,deviceId,appVersion){
  const set=(sets||[]).find(s=>s.id===session.setId);
  if(!set) throw new Error('Unknown kobun set');
  return set.questions.map(q=>({
    id:`practice:kobun:${session.sessionId}:${q.id}`,type:'drill_practice_answered',
    itemId:itemId(q.id),itemRevision:1,contentSet,
    setId:set.id,sessionId:session.sessionId,resumedFrom:session.resumedFrom||null,answerText:session.answers[q.id]||'',
    correct:gradeExactKobun(answers,q.id,session.answers[q.id]),gradingMode:'kobun-exact',
    practicePoints:q.practice_points,domain:['現代仮名遣い','古語・語句の文脈判断'].includes(q.category)?'古文・語彙・仮名遣い':'古文・内容・主語',
    deviceId,appVersion,createdAt:session.submittedAt
  }));
}

