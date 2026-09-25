import React,{useEffect,useRef,useState} from 'react';
import {allDrafts,saveDraft,clearDraft,putEvents} from './lib/localdb.js';
import {KOBUN_SETS,KOBUN_ANSWERS,KOBUN_CONTENT_SET,kobunItemId,gradeKobun,kobunEvents} from './kobun100.js';

export default function KobunPractice({events,deviceId,appVersion,onSaved,onClose}){
  const [session,setSession]=useState(null),[drafts,setDrafts]=useState([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const queue=useRef(Promise.resolve()),submission=useRef(false);
  const refresh=async()=>{const rows=await allDrafts();setDrafts(rows.filter(d=>d.draftType==='kobun-set'&&d.contentSet===KOBUN_CONTENT_SET));};
  useEffect(()=>{refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  const persist=next=>{
    queue.current=queue.current.catch(()=>{}).then(()=>saveDraft(next.year,{...next,savedAt:new Date().toISOString()}));
    queue.current.catch(e=>setError(`途中保存エラー：${e.message}`));
    return queue.current;
  };
  async function open(setId,draft=null){
    setBusy(true);setError('');
    try{
      // A resumed tab gets its own draft identity, preserving the original backup
      // and avoiding one tab overwriting another tab's answers.
      const id=crypto.randomUUID();
      const next={draftType:'kobun-set',contentSet:KOBUN_CONTENT_SET,year:`draft:kobun:${id}`,sessionId:id,setId,
        answers:{...(draft?.answers||{})},index:Number(draft?.index||0),stage:'answer',resumedFrom:draft?.year||null};
      await persist(next);setSession(next);window.scrollTo?.({top:0});
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  function change(next){setSession(next);persist(next);}
  async function leave(){
    setBusy(true);try{await queue.current;if(session?.stage!=='result'&&session)await persist(session);setSession(null);await refresh();}
    catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function submit(){
    if(submission.current)return;submission.current=true;setBusy(true);setError('');
    try{
      await queue.current;
      const next={...session,submittedAt:session.submittedAt||new Date().toISOString(),stage:'result'};
      const rows=kobunEvents(next,deviceId,appVersion);
      await putEvents(rows);onSaved(rows);setSession(next);
      // Delete only this new practice's draft. Old and other-tab drafts survive.
      try{await clearDraft(next.year)}catch(e){setError(`回答は保存済みです。途中保存の整理エラー：${e.message}`)}
      window.scrollTo?.({top:0});
    }catch(e){setError(`採点・保存エラー：${e.message}`)}finally{submission.current=false;setBusy(false)}
  }
  const seen=new Set(events.filter(e=>e.contentSet===KOBUN_CONTENT_SET).map(e=>e.itemId));
  const completedSessions=new Set(events.filter(e=>e.contentSet===KOBUN_CONTENT_SET&&e.sessionId).map(e=>e.sessionId));
  const completedSets=new Set(events.filter(e=>e.contentSet===KOBUN_CONTENT_SET&&e.setId&&e.sessionId).map(e=>e.setId));
  const superseded=new Set([...drafts.map(d=>d.resumedFrom),...events.filter(e=>e.contentSet===KOBUN_CONTENT_SET).map(e=>e.resumedFrom)].filter(Boolean));
  const availableDrafts=drafts.filter(d=>!completedSessions.has(d.sessionId)&&!superseded.has(d.year));
  function showLatest(setId){
    const rows=events.filter(e=>e.contentSet===KOBUN_CONTENT_SET&&e.setId===setId&&e.sessionId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    if(!rows.length)return;
    const latest=rows.filter(e=>e.sessionId===rows[0].sessionId);
    setSession({setId,stage:'result',answers:Object.fromEntries(latest.map(e=>[e.itemId.replace('kobun100:',''),e.answerText])),sessionId:rows[0].sessionId});
    window.scrollTo?.({top:0});
  }
  const set=KOBUN_SETS.find(s=>s.id===session?.setId),q=set?.questions[session?.index||0];
  const result=session?.stage==='result';
  const ready=set?.questions.every(q=>typeof session.answers[q.id]==='string'&&session.answers[q.id].trim());
  return <main className="shell kobunPractice">
    <header className="topbar"><div><h1>古文練習100問</h1><p>20本文・各5問／基礎から標準へ</p></div>
      <button type="button" disabled={busy} onClick={session?leave:onClose}>{session?'← セット一覧':'← ホーム'}</button></header>
    {error&&<p role="alert">{error}</p>}
    {!session?<>
      <section className="card"><p>学習済み {seen.size} / 100問。短い創作古文で技能を練習します。長文・時間配分は未見の過去問で確認してください。</p><p>5問を解いてからまとめて採点します。練習結果は保存し、過去問の得点や初見判定には影響しません。</p></section>
      {loading&&<p>途中保存を確認中…</p>}
      {availableDrafts.length>0&&<section className="card"><h2>途中から再開</h2>{availableDrafts.sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt))).map(d=><button type="button" key={d.year} disabled={busy} onClick={()=>open(d.setId,d)}>{d.setId}・問{d.index+1}から再開</button>)}</section>}
      <section className="kobunSetGrid">{KOBUN_SETS.map(s=><article className="card" key={s.id}><h2>{s.id} {s.title}</h2><p>{seenCount(s,seen)} / 5問を学習</p><button type="button" disabled={busy||loading} onClick={()=>open(s.id)}>{s.id}を始める</button>{completedSets.has(s.id)&&<button type="button" disabled={busy} onClick={()=>showLatest(s.id)}>{s.id}の前回結果</button>}</article>)}</section>
    </>:<>
      <h2>{set.id} {set.title}</h2>
      <article className="card passagePanel"><small>学習用の創作本文</small><p>{set.passage}</p>
        {(set.poems||[]).filter(w=>!set.passage.includes(w.text)).map(w=><p key={w.id}>{w.text}</p>)}
        {!!set.notes?.length&&<><h3>注</h3>{set.notes.map((n,i)=><p key={i}>{n.term}：{n.explanation}</p>)}</>}
      </article>
      {!result?<article className="card">
        <p>問{session.index+1} / 5・{q.category}</p><h3>{q.prompt}</h3>
        {q.format==='single_select'?<div className="kobunChoices">{q.choices.map(c=><button type="button" key={c.id} disabled={busy} aria-pressed={session.answers[q.id]===c.id} onClick={()=>change({...session,answers:{...session.answers,[q.id]:c.id}})}>{c.id}　{c.text}</button>)}</div>
          :<label>回答<input aria-label="回答" value={session.answers[q.id]||''} disabled={busy} autoComplete="off" onChange={e=>change({...session,answers:{...session.answers,[q.id]:e.target.value}})}/></label>}
        <p>回答は途中保存します。解答・解説は5問の採点後に表示します。</p>
        <div className="kobunActions">
          <button type="button" disabled={busy||session.index===0} onClick={()=>change({...session,index:session.index-1})}>前の問題</button>
          {session.index<4?<button type="button" disabled={busy||!session.answers[q.id]?.trim()} onClick={()=>change({...session,index:session.index+1})}>次の問題</button>
            :<button type="button" className="primary" disabled={busy||!ready} onClick={submit}>{busy?'保存中…':'5問を採点して保存'}</button>}
        </div>
      </article>:<section className="kobunResults">
        <article className="card"><h2>結果：{set.questions.filter(q=>gradeKobun(q.id,session.answers[q.id])).length} / 5問正解</h2><p>練習点 {set.questions.reduce((n,q)=>n+(gradeKobun(q.id,session.answers[q.id])?q.practice_points:0),0)} / {set.questions.reduce((n,q)=>n+q.practice_points,0)}点（入試得点への換算はしません）</p></article>
        {set.questions.map((q,i)=>{const a=KOBUN_ANSWERS[q.id];return <article className="card" key={q.id}><h3>問{i+1}：{gradeKobun(q.id,session.answers[q.id])?'正解':'不正解'}</h3><p>{q.prompt}</p><p>あなたの回答：{session.answers[q.id]}</p><p>正解：{a.answer}{a.correct_choice_text?`　${a.correct_choice_text}`:''}</p><p>{a.explanation}</p>{a.evidence.map((e,i)=><p key={i}>本文根拠：「{e.quote}」</p>)}<p>次の1問で：{a.reproduction_tip}</p>{a.choice_explanations&&<details><summary>選択肢ごとの解説</summary>{a.choice_explanations.map(c=><p key={c.id}>{c.id}：{c.reason}</p>)}</details>}</article>})}
        <div className="kobunActions"><button type="button" disabled={busy} onClick={leave}>セット一覧へ</button>{KOBUN_SETS[KOBUN_SETS.indexOf(set)+1]&&<button type="button" disabled={busy} onClick={()=>open(KOBUN_SETS[KOBUN_SETS.indexOf(set)+1].id)}>次のセットへ</button>}</div>
      </section>}
    </>}
  </main>;
}
function seenCount(set,seen){return set.questions.filter(q=>seen.has(kobunItemId(q.id))).length;}

