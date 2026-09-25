import NextExamEvidence from './NextExamEvidence.jsx';
import {verifiedEvidence} from './nextExamEvidence.js';
import React,{useEffect,useRef,useState} from 'react';
import {loadDraft,saveRepairDraft} from './lib/localdb.js';
import {UNIT,unitKey,DAY,newUnitState,formalCheck,gradeSelf,readiness,preparation,replan} from './nextExamUnit.js';

export default function NextExamLearning({events,nextExamKey,problemManifest,onClose,unit=UNIT,onChoose,probe}){
 const UNIT=unit,UNIT_KEY=unitKey(unit);
 const [state,setState]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[conflict,setConflict]=useState(false),[saved,setSaved]=useState('');
 const [cause,setCause]=useState(null);const lock=useRef(false),latest=useRef(null),dirty=useRef(false);
 useEffect(()=>{let active=true;loadDraft(UNIT_KEY).then(d=>{if(active){const s=d||newUnitState(Date.now(),UNIT);latest.current=s;setState(s);}}).catch(e=>setError(e.message));return()=>{active=false;};},[]);
 async function persist(next){
  if(lock.current||conflict)return false;lock.current=true;setBusy(true);setError('');setSaved('');
  try{const result=await saveRepairDraft(UNIT_KEY,{...next,savedAt:new Date().toISOString()},latest.current.generation||0);
   if(result.conflict){setConflict(true);setError('別タブと保存が競合しました。両方の答案を保持しました。バックアップを保存し、再読み込みして確認してください。');return false;}
   if(!result.saved)throw Error('保存できませんでした。答案をコピーして保全してください。');
   latest.current=result.record;dirty.current=false;setState(result.record);setSaved('端末に保存しました。');return true;
  }catch(e){setError('保存失敗：'+e.message);return false;}finally{lock.current=false;setBusy(false);}
 }
 function edit(patch){setSaved('');if(('answer' in patch&&patch.answer!==latest.current.answer)||('evidence' in patch&&patch.evidence!==latest.current.evidence)||('evidenceDraft' in patch))dirty.current=true;const s={...latest.current,...patch};latest.current=s;setState(s);}
 useEffect(()=>{if(!state||busy||conflict)return;const guard=e=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[state,busy,conflict]);
 useEffect(()=>{if(!state||conflict||!dirty.current)return;const t=setTimeout(()=>{if(!lock.current)persist(latest.current);},650);return()=>clearTimeout(t);},[state?.answer,state?.evidence,state?.evidenceDraft]);
 if(!state)return <main className="shell"><p>{error||'学習の続きを読み込み中…'}</p></main>;
 const item=UNIT.items[state.step-1],sheet=preparation(events,state.target,nextExamKey),ready=readiness(state,verifiedEvidence(state,events,problemManifest,UNIT),UNIT);
 const delayed=item?.mode==='delayed',wait=delayed&&(!state.delayStartedAt||Date.now()<state.delayStartedAt+DAY);
 const submitted=state.submission;
 const last=state.records.at(-1);const suggested=last?.result==='pending'?'scoring':last?.mode==='transfer'?'transfer':last?.mode==='delayed'?'delay':'basic';const repairCause=cause||suggested;
 async function submit(){
  if(!item||wait||submitted||!state.answer.trim()||!state.evidence.trim())return;
  await persist({...latest.current,submission:{answer:state.answer,evidence:state.evidence,submittedAt:Date.now(),elapsedSeconds:Math.max(0,Math.round((Date.now()-state.startedAt)/1000))}});
 }
 async function confirm(){
  if(!submitted||!item)return;
  const result=gradeSelf(submitted.answer,submitted.evidence,item,state.assessment);
  const record={...submitted,itemId:item.id,passageId:item.passageId,revision:UNIT.revision,mode:item.mode,result,assessment:{...state.assessment},assessor:'self',assistance:item.mode==='guided'||state.supportUsed?'guided':'none',firstExposure:!['guided','reproduction'].includes(item.mode)&&!state.records.some(r=>r.passageId===item.passageId)};
  const next={...latest.current,records:[...state.records,record],submission:null,answer:'',evidence:'',assessment:{},supportUsed:false,step:state.step+1,startedAt:Date.now()};
  if(UNIT.items[state.step]?.mode==='delayed')next.delayStartedAt=Date.now();
  await persist(next);
 }
 return <main className="shell nextExamLearning">
  <header className="homeHeader"><h1>次の文章でも解けるように</h1><button disabled={busy||conflict} onClick={async()=>{if(await persist(latest.current))onClose();}}>保存してホームへ</button></header>
  {error&&<p role="alert">{error}</p>}<p role="status">{busy?'保存中…':saved}</p>
  <section className="card">{onChoose&&<button disabled={busy||conflict} onClick={async()=>{if(await persist(latest.current))onChoose();}}>教材と補強順を選ぶ</button>}<h2>次年度準備シート</h2>
   <label>今回の目標 <select aria-label="今回の目標" disabled={busy||conflict} value={state.target} onChange={e=>persist({...latest.current,target:Number(e.target.value)})}>{[60,70,75].map(n=><option key={n} value={n}>{n}点</option>)}</select></label>
   <p>{sheet.status}</p><p>診断得点：{sheet.score??'未測定'}／目標との差：{sheet.gap??'未測定'}。次の候補：{nextExamKey?`${nextExamKey}年度（未見条件は要確認）`:'履歴・学習ルートから要確認'}</p>
   <p>{sheet.exposure}</p><p>今回の候補教材：{UNIT.title}。{UNIT.outcome}</p>
   {!!sheet.rows.length&&<details><summary>解答欄ごとの失点・原因と補強順</summary><ul>{sheet.rows.map((r,i)=><li key={i}>{r.id}：{r.score??'未確定'}／{r.points??'配点未確認'}点、原因：{r.cause}（推定を含む）</li>)}</ul><p>優先候補：{sheet.priorities.map(([c])=>c).join('、')||'採点・原因を確認してください'}</p><p>実際の配点合計と得点経路は要照合。この差を次年度の増点予測に使いません。</p></details>}
  </section>
  <section className="card"><h2>今日やること</h2><p>{UNIT.outcome}</p><p>まず途中の答案を再開。今日は「小セットで確認②」までが必須分です。約{UNIT.minutes}分は見積りで、途中保存して分けて進められます。難しければ下の再補強案を確認してください。</p>
   <p>学習用オリジナル／{UNIT.difficulty}</p><p>{UNIT.source}</p>
   <h3>{UNIT.stages[state.step]||'今日の練習と後日の確認を記録しました'}</h3>
   {state.step===0&&<>{probe&&<section><h3>短い問題で確かめる</h3><p>{probe.text}</p><p>{probe.question}</p>{probe.options.map((o,i)=><button key={o} disabled={busy||conflict||state.probeAnswer!==undefined} onClick={()=>persist({...latest.current,probeAnswer:i,probeAt:Date.now()})}>{o}</button>)}{state.probeAnswer!==undefined&&<p>{state.probeAnswer===probe.correct?'この確認問題では正答です。説明を確認して、自力の答案へ進みましょう。':probe.repair} {probe.explanation} この一問で失点原因全体は断定しません。</p>}</section>}<p>{UNIT.diagnosis}</p><ol>{UNIT.lesson.map(t=><li key={t}>{t}</li>)}</ol><p>{UNIT.items[0].text}</p><p>解答例：{UNIT.items[0].model}</p><button disabled={busy||conflict} onClick={()=>persist({...latest.current,step:1,startedAt:Date.now()})}>手助け付き練習へ</button></>}
   {wait&&<><p>今日の必須分は終了です。後日の問題はまだ開きません。</p><p>確認予定：{new Date(state.delayStartedAt+DAY).toLocaleString()} 以降（24〜72時間後が目安）。経過しただけでは確認済みになりません。</p><button onClick={()=>setState({...latest.current})}>確認可能な時刻になったか確認</button></>}
   {item&&!wait&&<>
    <p className="unitPassage">{item.text}</p><p><b>{item.question}</b></p>
    {item.mode==='guided'&&<p>手助け：{item.hint}</p>}
    {item.mode==='reproduction'&&<p>同じ本文の再現練習です。独立した未見確認には数えません。</p>}
    <label>本文の根拠 <textarea aria-label="本文の根拠" disabled={!!submitted||busy||conflict} value={state.evidence} onChange={e=>edit({evidence:e.target.value})}/></label>
    <label>あなたの答案 <textarea aria-label="あなたの答案" disabled={!!submitted||busy||conflict} value={state.answer} onChange={e=>edit({answer:e.target.value})}/></label>
    <p>{formalCheck(state.answer,item).length}／{item.max}字（改行を除く形式確認。内容の正しさは別に評価）</p>
    {!submitted&&<button disabled={busy||conflict||!state.answer.trim()||!state.evidence.trim()} onClick={submit}>初回答案を保存して比較する</button>}
    {submitted&&<><p>初回答案を保存済み。内容は自己評価で確認します。</p><p>学習用解答例：{item.model}</p><p>言い換えでも、必要な内容・関係・根拠が合えば構いません。語句の一致だけで判断しません。</p>
     {[...item.criteria,'本文外の理由や逆の関係を足していない'].map((c,i)=>{const k=i===item.criteria.length?'grounding':i;return <label className="unitCriterion" key={k}>{c}<select aria-label={c} disabled={busy||conflict} value={state.assessment[k]||''} onChange={e=>{const s={...latest.current,assessment:{...latest.current.assessment,[k]:e.target.value}};edit(s);persist(s);}}><option value="">未確認</option><option value="yes">できた</option><option value="no">不足・誤りがある</option><option value="uncertain">判断に迷う</option></select></label>})}
     <p>不足・判断に迷う・未確認は、習得成功へ加算しません。保存して先へ進み、保護者・指導者に確認できます。</p><button disabled={busy||conflict} onClick={confirm}>自己評価を保存して次へ</button></>}
   </>}
   {state.step>7&&<p>任意課題：答案の根拠と説明の組み立てを、解答例を見ずに紙で説明してみましょう。同じ確認問題の再使用を未見確認へ加算しません。</p>}
   <button disabled={busy||conflict} onClick={()=>persist(latest.current)}>途中保存</button>
  </section>
  <NextExamEvidence state={state} events={events} manifest={problemManifest} onSave={persist} onEdit={edit} busy={busy||conflict} unit={UNIT}/>
  <section className="card"><h2>次年度の準備：{ready.label}</h2><ul>{ready.reasons.map(r=><li key={r}>{r}</li>)}</ul><p>別本文の自己確認：{ready.transferTexts}本文。後日の確認：{ready.delayed?'自己評価で記録あり':'未確認'}。自由受験はホームからいつでも選べます。練習完了は合格保証ではありません。</p>
   <h3>未達・再発したら勉強を変える</h3><p>保存した確認段階と評価から補強案を選んでいます。必要な場合だけ別の案も見られます。原因の自己申告は必須ではありません。</p><select aria-label="再補強の原因" value={repairCause} onChange={e=>setCause(e.target.value)}><option value="basic">練習中からできない</option><option value="transfer">別本文でできない</option><option value="delay">後日できない</option><option value="time">時間切れ</option><option value="form">字数・形式で失点</option><option value="scoring">他者の採点と違う</option></select><p>{replan(repairCause,UNIT)}</p>
   <details key={state.step} onToggle={e=>{if(e.currentTarget.open&&item&&!wait&&!submitted&&!state.supportUsed){edit({supportUsed:true});persist(latest.current);}}}><summary>教え方をもう一度確認する（確認問題の答えは含みません）</summary><ol>{UNIT.lesson.map(t=><li key={t}>{t}</li>)}</ol><p>確認中にこの説明を開いた答案は、支援ありとして記録します。</p></details>
   <button disabled={busy||conflict} onClick={()=>persist({...latest.current,archivedDrafts:[...(latest.current.archivedDrafts||[]),{answer:state.answer,evidence:state.evidence,submission:state.submission,assessment:state.assessment,step:state.step,at:Date.now()}],step:0,answer:'',evidence:'',assessment:{},submission:null,supportUsed:false,startedAt:Date.now()})}>初回答案を残して教え直しへ戻る</button><p>再使用した本文は未見確認に数えません。未使用の確認問題が尽きた場合は、別教材の追加が必要です。</p>
   <details><summary>保存した初回答案・自己評価 {state.records.length}件</summary>{state.records.map((r,i)=><div key={i}><p>{r.itemId}／経過{r.elapsedSeconds}秒（離席を含む）／{r.result==='self-confirmed'?'自己評価で確認':r.result==='pending'?'採点保留':'再補強が必要'}</p><p>答案：{r.answer}</p><p>根拠：{r.evidence}</p></div>)}</details>
  </section>
 </main>;
}

