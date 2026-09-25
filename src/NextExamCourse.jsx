import React,{useEffect,useState} from 'react';
import NextExamLearning from './NextExamLearning.jsx';
import NextExamBridge from './NextExamBridge.jsx';
import {COURSE_UNITS,COURSE_PROBES} from './nextExamCourseData.js';
import {BRIDGE_SETS} from './nextExamBridgeData.js';
import {unitKey} from './nextExamUnit.js';
import {coursePlan} from './nextExamCourse.js';
import {loadDraft} from './lib/localdb.js';
export default function NextExamCourse(props){
 const [selected,setSelected]=useState(null),[drafts,setDrafts]=useState(null),[menu,setMenu]=useState(false),[error,setError]=useState('');
 async function refresh(show){try{const all=await Promise.all(COURSE_UNITS.map(async u=>[unitKey(u),await loadDraft(unitKey(u))]));const bridges=await Promise.all(BRIDGE_SETS.map(async b=>[`draft:unit:${b.id}:r${b.revision}`,await loadDraft(`draft:unit:${b.id}:r${b.revision}`)]));const d=Object.fromEntries([...all,...bridges]);setDrafts(d);if(show)setMenu(true);else{const plan=coursePlan(props.events,d);const pending=BRIDGE_SETS.find(b=>{const s=d[`draft:unit:${b.id}:r${b.revision}`];return s&&!s.submission;});setSelected(plan.rows[0]?.rank===0?plan.rows[0].unit:pending||plan.rows[0]?.unit);}}catch(e){setError('学習記録を読み込めません：'+e.message);}}
 useEffect(()=>{refresh(false);},[]);
 if(error)return <main className="shell"><p role="alert">{error}</p><button onClick={props.onClose}>ホームへ</button></main>;
 if(!drafts||!selected)return <main className="shell">教材を読み込み中…</main>;
 if(!menu&&selected.questions)return <NextExamBridge key={selected.id} set={selected} onClose={()=>refresh(true)} onRepair={skill=>{setSelected(COURSE_UNITS.find(u=>u.skill===skill)||COURSE_UNITS[0]);setMenu(false);}}/>;
 if(!menu)return <NextExamLearning key={selected.unitId} {...props} unit={selected} probe={COURSE_PROBES[selected.skill]} onChoose={()=>refresh(true)}/>;
 const plan=coursePlan(props.events,drafts);
 return <main className="shell nextExamCourse"><header className="homeHeader"><h1>教材と補強順</h1><button onClick={props.onClose}>ホームへ</button></header><section className="card"><h2>今日の優先順</h2><p>まず途中答案、次に期限の来た確認。その後は失点に応じた教材へ進みます。今日は選んだ1単元の小セットまで。残りは別の日に分けられます。</p><p>原因を自分で分類する必要はありません。答案・設問・確認問題の結果から補強候補を選び、分からない原因は断定しません。</p>{plan.rows.map(r=><article key={r.unit.unitId}><h3>{r.unit.title}</h3><p>{r.action}：{r.why}</p><p>{r.unit.outcome}</p><button onClick={()=>{setSelected(r.unit);setMenu(false);}}>この教材を開く：{r.unit.title}</button></article>)}{plan.uncovered.length>0&&<p>既存の弱点別類題で補う分野：{plan.uncovered.map(([c,n])=>`${c}（失点${n}点）`).join('、')}。ホームの弱点別類題から取り組めます。ここにない弱点も記録から削除しません。</p>}</section><section className="card"><h2>長文・時間配分へ進む</h2><p>学習用オリジナルの複数段落を読み、3問をまとめて提出します。先に1問の解説を見て残りを解くことはありません。12分は練習用の目安で、入試の制限時間や予測点数ではありません。</p>{BRIDGE_SETS.map(s=><button key={s.id} onClick={()=>{setSelected(s);setMenu(false);}}>{s.title}を開く</button>)}<p>短文・長文練習の後はホームから次の過去問へ。自由受験は常に可能です。2025・2026は仕上げ用として温存し、既に見た場合は未見と扱いません。</p></section></main>;
}

