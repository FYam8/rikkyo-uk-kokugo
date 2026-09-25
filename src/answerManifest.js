// Static hosting can prevent accidental exposure, not deliberate URL inspection.
export function isStrictHoldout(examKey,policy){
  return policy?.strict===true&&(policy.examKeys||[]).some(key=>String(key)===String(examKey));
}
export function canStartHoldout(examKey,policy,guided){
  return !isStrictHoldout(examKey,policy)||(guided?.type==='exam'&&String(guided.year)===String(examKey));
}
export async function fetchExamAnswers({version,examKey,policy,submitted=false,completed=false,fetchJson}){
  const key=String(examKey??'');
  if(!key) throw new Error('Answer loading requires an exam key');
  const strict=isStrictHoldout(key,policy);
  if(strict&&!submitted&&!completed) throw new Error('最終確認の解答は、解答を終了した後に確認できます。');
  const files=version.answerManifests;
  if(!files){
    if(policy?.strict===true) throw new Error('Strict holdout requires separate per-exam answer manifests');
    return fetchJson(`./content/${version.contentVersion}/${version.answerManifest}`);
  }
  const file=files[key];
  if(typeof file!=='string'||!/^[a-zA-Z0-9_-]+\.json$/.test(file)) throw new Error('Missing or invalid per-exam answer manifest');
  const payload=await fetchJson(`./content/${version.contentVersion}/${file}`);
  const keys=Object.keys(payload?.years||{});
  if(keys.length!==1||keys[0]!==key) throw new Error('Per-exam answer payload contains unexpected exams');
  return payload;
}
