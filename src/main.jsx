import PracticePassage from './PracticePassage.jsx';
import SourceReplay from './SourceReplay.jsx';
import {pendingRetention} from './retention.js';
import AnswerReference from './AnswerReference.jsx';
import TextAnswerEditor from './TextAnswerEditor.jsx';
import {textAnswerState,gradeTextAnswer} from './textAnswer.js';
import {fetchExamAnswers,canStartHoldout} from './answerManifest.js';
import {normalizedParentScoring,isScorableQuestion,summarizeExamScore} from './examScoring.js';
import {examSectionIds,initialExamPosition,adjacentSection} from './examSections.js';
import NextExamLearning from './NextExamCourse.jsx';
import KobunPractice from './KobunPractice.jsx';
import {KANJI_CONTENT_SET} from './kanji50.js';
import {KOBUN_CONTENT_SET} from './kobun100.js';
import {repairDraftKey,repairSessionPlan,hydrateRepairSession} from './repairSession.js';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {b64ToBytes, dec, unlockKeyring, deriveSyncKey, decryptPacked} from './lib/crypto.js';
import {ghGetFile, ghListEventPaths} from './lib/github.js';
import {getGuidedStep, courseProgress, courseRouteLabels, repairSkillsForYear, repairedSkillsForYear, pendingRepairSkillsForYear, nextRepairSkillsForYear, repairPlanForYear, passedRepair, weaknessLedger, reviewPrioritiesForEvents, inferCause} from './learningPath.js';
import {
  DRILL_BANK,DRILL_LIBRARY_DOMAINS,DRILL_LIBRARY_STRATEGY,PRACTICE_POLICY,
  getDrillLibraryItems,drillLibraryTargetForWeakness,KANJI_HISTORY,isDrillAnswerCorrect
} from './drills.js';
import {
  getVisiblePracticeItems,buildPracticeStats,buildLifetimePracticeStats,usedPracticeRefs,selectPracticeItems,
  buildDrillSession,basicPassed,currentTransferRound,transferResult,mixedResult,optionLabel,writtenAnswerChecks,writtenSelfAssessmentResult
} from './drillUx.js';
import {
  KANA_OPTIONS,kanaTokens,answerTokens,choiceOptions,parsePartAnswer,setPartAnswer,toggleSetAnswer,
  appendOrderAnswer,undoOrderAnswer,displayAnswer,isChoiceIndexSelected
} from './answerUi.js';
import {
  getAllEvents, putEvent, putEvents, saveRepairDraft, finishRepairDraft, saveDraft, loadDraft, allDrafts, clearDraft,
  exportLocalData, importLocalData, resetLocalLearningData, getDeviceId, storagePersistenceStatus
} from './lib/localdb.js';
import {buildReviewExplanation} from './reviewExplanations.js';
import {getReviewProfile} from './reviewProfiles.js';
import {LEARNING_PATH_CONFIG} from './schoolLearningConfig.js';
import {requireScoreTargets} from './scoreStrategy.js';
import './style.css';

const APP_VERSION='1.1.9-kobun100';
const PRIORITY_RANK={A:0,B:1,C:2,D:3};
const DRILL_DRAFT_PREFIX='draft:drill:';
const REPAIR_DRAFT_PREFIX='draft:repair:';
const [TARGET_MIN,TARGET_STABLE,TARGET_STRETCH]=requireScoreTargets(LEARNING_PATH_CONFIG.scoreTargets);
const HOLDOUT_POLICY=LEARNING_PATH_CONFIG.holdoutPolicy;
const SCORING_POLICY=LEARNING_PATH_CONFIG.scoringPolicy;
const NORMALIZED_SCORING=normalizedParentScoring(SCORING_POLICY);
const FINAL_EXAM_KEY=LEARNING_PATH_CONFIG.route?.finalExamKey;
const RESERVED_EXAM_KEYS=LEARNING_PATH_CONFIG.reserveExamKeys||[];
function sameExamKey(a,b){return String(a??'')===String(b??'');}
function canonicalExamKey(key){return (LEARNING_PATH_CONFIG.examKeys||[]).find(x=>sameExamKey(x,key))??key;}
function eventExamKey(e){return e?.examId??e?.year;}
function examLabel(key){return LEARNING_PATH_CONFIG.examLabels?.[String(key)]||(String(key)+'年度');}
function examKeyForStorage(key){return canonicalExamKey(key);}
function isReservedExam(key){return RESERVED_EXAM_KEYS.some(x=>sameExamKey(x,key));}
function isFinalExam(key){return sameExamKey(FINAL_EXAM_KEY,key);}
function sortExamKeys(keys){const order=LEARNING_PATH_CONFIG.examKeys||[];return [...keys].sort((a,b)=>order.findIndex(x=>sameExamKey(x,a))-order.findIndex(x=>sameExamKey(x,b)));}
function examVariant(key){let h=0;for(const ch of String(key??''))h=(h*31+ch.codePointAt(0))>>>0;return h%11;}

function drillDraftKey(item){ return `${DRILL_DRAFT_PREFIX}${item.id}:r${Number(item.revision||1)}`; }


function drillDomainDefinition(key){
  return DRILL_LIBRARY_DOMAINS.find(x=>x.key===key)||null;
}
function drillDomainLabel(key){
  if(key===DRILL_LIBRARY_STRATEGY) return '解答戦略';
  return drillDomainDefinition(key)?.label||key||'評論・内容理解';
}
function weaknessDomainKey(skill){
  return drillLibraryTargetForWeakness(skill)?.domain||'評論・内容理解';
}

function WrittenAssessmentPanel({item,answer,checks,assessment,onChange,onRewrite,onLearn,onConfirm,busy=false}){
  const current=assessment||{elementAssessments:{},unsupportedContent:null};
  const result=writtenSelfAssessmentResult(item,checks,current);
  const updateElement=(id,value)=>onChange({...current,elementAssessments:{...(current.elementAssessments||{}),[id]:value},outcome:null});
  return <div className="writtenAssessmentPanel">
    <div className="writtenComparison">
      <section><b>自分の答案</b><p>{String(answer??'')}</p></section>
      <section><b>解答例</b><p>{item.acceptedAnswers?.[0]||''}</p></section>
    </div>
    <p className="writtenExplanation">{item.why}</p>
    <small>機械確認：{checks?.criteriaMet?'字数・指定形式・必要語句は満たしています。':'字数・指定形式・必要語句に不足があります。'} 内容は自分で一つずつ確かめます。</small>
    <fieldset className="elementAssessment"><legend>必要な内容を確認</legend>
      {(item.selfAssessment?.required||[]).map(element=><div className="elementAssessmentRow" key={element.id}>
        <b>{element.label}</b><div role="group" aria-label={element.label}>
          {[['met','含まれている'],['missing','足りない'],['unsure','判断に迷う']].map(([value,label])=><button type="button" key={value}
            className={current.elementAssessments?.[element.id]===value?'selected':''} onClick={()=>updateElement(element.id,value)}>{label}</button>)}
        </div>
      </div>)}
    </fieldset>
    <fieldset className="unsupportedAssessment"><legend>本文外の内容を確認</legend>
      <p>解答例と比べて、本文から確認できない理由や気持ちを付け足していませんか？</p>
      <div role="group" aria-label="本文外の内容">
        {[['absent','付け足していない'],['possible','付け足したかもしれない']].map(([value,label])=><button type="button" key={value}
          className={current.unsupportedContent===value?'selected':''} onClick={()=>onChange({...current,unsupportedContent:value,outcome:null})}>{label}</button>)}
      </div>
    </fieldset>
    {result.completed&&!result.eligible&&<p className="assessmentGuidance">不足または迷う項目があります。本文と解説を確認して書き直してください。</p>}
    <div className="focusedDrillFooter writtenAssessmentActions">
      <button type="button" disabled={busy} onClick={onRewrite}>書き直す</button>
      <button type="button" disabled={busy} onClick={onLearn}>今回は解答例を学んで終了</button>
      <button type="button" className="primary" disabled={busy||!result.eligible} onClick={onConfirm}>自己採点で合格</button>
    </div>
  </div>;
}
function aggregateDomainPriorities(rows=[]){
  const map=new Map();
  for(const row of rows){
    const key=weaknessDomainKey(row.key||row.skill);
    if(key===DRILL_LIBRARY_STRATEGY) continue;
    const current=map.get(key);
    const next={...row,key,sourceSkills:[row.key||row.skill].filter(Boolean)};
    if(!current){ map.set(key,next); continue; }
    current.sourceSkills.push(row.key||row.skill);
    current.misses=Number(current.misses||0)+Number(row.misses||0);
    current.lostPoints=Number(current.lostPoints||0)+Number(row.lostPoints||0);
    if(PRIORITY_RANK[row.priority]<PRIORITY_RANK[current.priority]){
      current.priority=row.priority; current.why=row.why;
    }
  }
  return [...map.values()].sort((a,b)=>PRIORITY_RANK[a.priority]-PRIORITY_RANK[b.priority]||Number(b.lostPoints||0)-Number(a.lostPoints||0));
}
function priorityForResult(plan,result,fallback='B'){
  const cause=inferCause(result);
  return plan?.all?.find(row=>row.key===cause)?.priority||fallback;
}
function PriorityStrategyLegend(){
  return <p className="muted priorityStrategyLegend">A＝次回{TARGET_MIN}点確保に必須、B＝{TARGET_STABLE}点への上積み、C＝{TARGET_STABLE}〜{TARGET_STRETCH}点への任意上積み、D＝現段階では後回し。これは学校公式の分類・合格基準ではなく、学習戦略上の目安です。</p>;
}
function aggregateDomainLedger(rows=[]){
  const statusRank={'再補強':0,'未補強':1,'定着確認中':2,'定着済み':3};
  const map=new Map();
  for(const row of rows){
    const key=weaknessDomainKey(row.skill);
    if(key===DRILL_LIBRARY_STRATEGY) continue;
    const current=map.get(key)||{key,misses:0,lostPoints:0,years:[],status:row.status,clearYears:row.clearYears||0};
    current.misses+=Number(row.misses||0); current.lostPoints+=Number(row.lostPoints||0);
    current.years=[...new Set([...current.years,...(row.years||[])])].sort();
    if((statusRank[row.status]??9)<(statusRank[current.status]??9)) current.status=row.status;
    current.clearYears=Math.max(current.clearYears,Number(row.clearYears||0));
    map.set(key,current);
  }
  return [...map.values()].sort((a,b)=>(statusRank[a.status]??9)-(statusRank[b.status]??9)||b.misses-a.misses);
}

function autoMissReason(qid){
  const profile=getReviewProfile(qid);
  if(profile?.repairSkill)return profile.repairSkill;
  const t=profile?.type||'';
  if(/漢字|語彙|現代仮名遣い|知識・短答/.test(t)) return '知識不足';
  if(t==='古文・主語人物') return '古文の主語・人物関係';
  if(t==='文学・心情') return '心情';
  if(/複数選択|並べ替え/.test(t)) return '選択肢処理';
  return '本文根拠不足';
}

function choiceTokens(raw){ return kanaTokens(raw); }
function gradeChoice(rule,raw){
  if(!rule) return null;
  if(['text','text-parts'].includes(rule.kind)) return gradeTextAnswer(rule,raw);
  const answers=rule.answers||[], points=rule.points||[];
  const tokens=rule.kind==='parts'
    ?parsePartAnswer(raw,answers.length,choiceOptions(rule))
    :answerTokens(raw,choiceOptions(rule));
  const max=points.reduce((a,b)=>a+Number(b||0),0);
  let score=0,correct=false;
  if(rule.kind==='single'){
    correct=tokens.length===1&&tokens[0]===answers[0]; score=correct?max:0;
  }else if(rule.kind==='parts'){
    score=answers.reduce((s,a,i)=>s+(tokens[i]===a?Number(points[i]||0):0),0);
    correct=tokens.length===answers.length&&tokens.every(Boolean)&&score===max;
  }else if(rule.kind==='order'){
    correct=tokens.length===answers.length&&answers.every((a,i)=>tokens[i]===a); score=correct?max:0;
  }else if(rule.kind==='set'){
    const selected=[...new Set(tokens)], expected=[...new Set(answers)];
    const ok=tokens.length===selected.length&&tokens.length<=expected.length;
    if(ok) score=expected.reduce((s,a,i)=>s+(selected.includes(a)?Number(points[i]||0):0),0);
    correct=ok&&selected.length===expected.length&&expected.every(x=>selected.includes(x));
  }
  return {score,max,correct,tokens};
}
function formatCorrectAnswer(rule){
  if(!rule) return '';
  if(['text','text-parts'].includes(rule.kind)) return rule.answers.map(a=>Array.isArray(a)?a.join(' または '):a).join(' / ');
  if(rule.kind==='order') return rule.answers.join('→');
  if(rule.kind==='set') return rule.answers.join('・')+'（順不同）';
  if(rule.kind==='parts') return rule.answers.join(' / ');
  return rule.answers?.[0]||'';
}
function answerPlaceholder(format){
  if(!format) return '解答を入力';
  if(format.kind==='single') return '例：ア';
  if(format.kind==='order') return '例：ア→イ→ウ';
  if(format.kind==='set') return '例：ア・ウ';
  if(format.kind==='mixed') return '記述部分を入力';
  return `${format.parts}個を順に入力`;
}
function ruleForChoice(rule){ return rule?.kind==='mixed'?rule.choice:rule; }
function fmtElapsed(sec){ const m=Math.floor(sec/60),s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

async function fetchJson(path){
  const r=await fetch(path,{cache:'no-store'});
  if(!r.ok) throw new Error(`${path} の読み込みに失敗しました（${r.status}）`);
  return r.json();
}
function downloadJson(name,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const u=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=u; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
}
function readJsonFile(file){
  return new Promise((resolve,reject)=>{
    const fr=new FileReader();
    fr.onload=()=>{try{resolve(JSON.parse(String(fr.result||'')))}catch(e){reject(e)}};
    fr.onerror=()=>reject(fr.error);
    fr.readAsText(file);
  });
}

function ChoiceAnswerEditor({format,value,onChange,partIndex=0,onPartIndex=()=>{}}){
  const kind=format?.kind;
  const options=choiceOptions(format);
  const selected=answerTokens(value,options);
  const [showMore,setShowMore]=useState(()=>selected.some(x=>options.indexOf(x)>=6));
  const visible=showMore?options:options.slice(0,6);
  if(!kind) return null;

  if(kind==='parts'){
    const count=Math.max(1,Number(format.parts||1));
    const slots=parsePartAnswer(value,count,options);
    const choose=(token)=>{
      const next=setPartAnswer(value,partIndex,token,count,options);
      onChange(next);
      const parsed=parsePartAnswer(next,count,options);
      if(parsed[partIndex]&&partIndex<count-1){
        const nextBlank=parsed.findIndex((v,i)=>i>partIndex&&!v);
        onPartIndex(nextBlank>=0?nextBlank:Math.min(count-1,partIndex+1));
      }
    };
    return <div className="choiceEditor">
      <div className="partSlots" aria-label={`${count}個の解答欄`}>
        {slots.map((token,i)=><button type="button" key={i} className={'partSlot '+(i===partIndex?'active':'')+(token?' filled':'')}
          onClick={()=>onPartIndex(i)}><small>{i+1}</small><b>{token||'—'}</b></button>)}
      </div>
      <div className="kanaPad">
        {visible.map(token=><button type="button" key={token} className={slots[partIndex]===token?'selected':''} onClick={()=>choose(token)}>{token}</button>)}
      </div>
      {!showMore&&options.length>6&&<button type="button" className="moreChoices" onClick={()=>setShowMore(true)}>残りの選択肢を表示</button>}
    </div>;
  }

  if(kind==='order'){
    return <div className="choiceEditor">
      <div className="orderPreview">{selected.length?selected.join(' → '):'順番に選択'}</div>
      <div className="kanaPad">
        {visible.map(token=><button type="button" key={token} className={selected.includes(token)?'selected used':''}
          onClick={()=>onChange(appendOrderAnswer(value,token,options))}>{token}</button>)}
      </div>
      <div className="choiceTools">
        {!showMore&&options.length>6&&<button type="button" onClick={()=>setShowMore(true)}>残りの選択肢</button>}
        <button type="button" disabled={!selected.length} onClick={()=>onChange(undoOrderAnswer(value,options))}>1つ戻す</button>
        <button type="button" disabled={!selected.length} onClick={()=>onChange('')}>クリア</button>
      </div>
    </div>;
  }

  if(kind==='set'){
    return <div className="choiceEditor">
      <div className="selectionPreview">{selected.length?selected.join('・'):'該当するものを選択'}</div>
      <div className="kanaPad">
        {visible.map(token=><button type="button" key={token} className={selected.includes(token)?'selected':''}
          onClick={()=>onChange(toggleSetAnswer(value,token,options))}>{token}</button>)}
      </div>
      <div className="choiceTools">
        {!showMore&&options.length>6&&<button type="button" onClick={()=>setShowMore(true)}>残りの選択肢</button>}
        <button type="button" disabled={!selected.length} onClick={()=>onChange('')}>クリア</button>
      </div>
    </div>;
  }

  return <div className="choiceEditor">
    <div className="kanaPad">
      {visible.map(token=><button type="button" key={token} className={selected[0]===token?'selected':''}
        onClick={()=>onChange(selected[0]===token?'':token)}>{token}</button>)}
    </div>
    {!showMore&&options.length>6&&<button type="button" className="moreChoices" onClick={()=>setShowMore(true)}>残りの選択肢を表示</button>}
  </div>;
}

function answerState(q,answers){
  const f=q.answerFormat;
  if(['text','text-parts'].includes(f?.kind)) return textAnswerState(answers[q.id],f);
  if(f?.kind==='mixed'){
    const hasText=String(answers[q.id]||'').trim().length>0;
    const hasChoice=answerTokens(answers[`${q.id}#choice`]||'',choiceOptions(f.choice)).length>0;
    return hasText&&hasChoice?'done':(hasText||hasChoice?'partial':'empty');
  }
  if(f?.kind==='parts'){
    const parts=parsePartAnswer(answers[q.id]||'',Number(f.parts||1),choiceOptions(f));
    const n=parts.filter(Boolean).length;
    return n===parts.length?'done':(n?'partial':'empty');
  }
  if(f){
    return answerTokens(answers[q.id]||'',choiceOptions(f)).length?'done':'empty';
  }
  return String(answers[q.id]||'').trim()?'done':'empty';
}



function ReviewCard({q,result,rule,review,totalScore,pManifest,version,openByDefault=false,priorityOverride=null}){
  const ex=buildReviewExplanation({question:q,result,rule,totalScore,review});
  const shownPriority=priorityOverride||ex.priority;
  const year=String(result.year||q.examId||q.id?.split('-')?.[0]||'');
  const y=pManifest?.years?.[year];
  const sourcePage=Number(ex.profile?.page||q.page);
  const pageMeta=y?.problemPages?.find(x=>Number(x.page)===sourcePage);
  const pageSrc=pageMeta&&version?`./content/${version.contentVersion}/assets/${pageMeta.asset}`:'';
  return <details className="reviewCard" open={openByDefault||undefined}>
    <summary>
      <span><b>大問{q.section} 問{q.question}</b><small>{ex.type}・{ex.loss}{NORMALIZED_SCORING?'確認単位の不足':'点失点'}</small></span>
      <span className={'priorityBadge p'+shownPriority}>{shownPriority}</span>
    </summary>
    <div className="reviewBody">
      <p className="reviewDisclaimer">{LEARNING_PATH_CONFIG.reviewPresentation?.disclaimer||"正答・模範解答・配点は解答用紙／採点データに基づきます。本文根拠の整理、誤答分類、必要要素の分解は学校公式解説ではなく、問題本文と模範解答から作った学習用解説です。"}</p>
      <div className="reviewFocus"><b>設問要求</b><p>{ex.focus}</p>
        {!!ex.requirements?.length&&<small>形式条件：{ex.requirements.join('／')}</small>}
      </div>
      <div className="reviewSix">
        <section><b>① 結論</b><p>{ex.conclusion}</p></section>
        <section><b>{ex.sourceLabel||"② 本文根拠"}</b><p>{ex.source}</p></section>
        <section><b>③ 解き方</b><p>{ex.method}</p></section>
        <section><b>④ どこがずれたか</b><p>{ex.wrong}</p><small>{ex.errorFix}</small></section>
        <section><b>⑤ {TARGET_MIN}〜{TARGET_STRETCH}点戦略</b><p>優先度 {shownPriority}。今回の不足は {ex.loss}{NORMALIZED_SCORING?'確認単位':'点'}。</p></section>
        <section><b>⑥ 次回の再現ポイント</b><p>{ex.replay}</p></section>
      </div>
      {!!ex.partAnalyses?.length&&<section className="reviewParts"><b>各小問の具体確認（学習用・非公式）</b>
        <div className="partAnalysisList">{ex.partAnalyses.map(part=><div key={part.label} className={'partAnalysis '+(part.correct?'correct':'needs')}>
          <strong>{part.label}　{part.target} → 正解 {part.answer}</strong>
          <span>自分：{part.mine}</span>
          <p>{part.why}</p>
          {!!part.candidates?.length&&<small>{part.candidates.join(' ／ ')}</small>}
        </div>)}</div>
      </section>}
      {!!ex.optionAnalyses?.length&&<section className="reviewOptions"><b>選択肢ごとの確認（学習用・非公式）</b>
        <div className="optionAnalysisList">{ex.optionAnalyses.map(op=><div key={op.token} className={'optionAnalysis '+(op.correct?'correct':'wrong')}>
          <strong>{op.token} {op.answerLabel} {op.contentJudgement}</strong><span>{op.text}</span><small>{op.comment}</small>
        </div>)}</div>
      </section>}
      {!!ex.elementChecks?.length&&<section className="reviewElements"><b>記述の必要要素（学習用・非公式）</b>
        <div className="elementList">{ex.elementChecks.map(el=><div key={el.label} className={'element '+(el.status==='○'?'ok':'needs')}>
          <strong>{el.status} 要素{el.label}</strong><span>{el.text}</span>
        </div>)}</div>
        {ex.officialModel&&<div className="answerExamples">
          <p><b>最小修正の方針：</b>自分の答案を残し、△になった要素だけ本文語に近い形で補い、最後に字数・指定語句・文型を確認する。</p>
          <p><b>高得点答案例（模範解答）：</b>{ex.officialModel}</p>
        </div>}
      </section>}
      <div className="reviewCaution">{ex.note}</div>
      {pageSrc&&<details className="reviewProblemPage"><summary>実際の問題ページで本文根拠を確認</summary><img src={pageSrc} alt={`${examLabel(year)} 大問${q.section} 問${q.question} 掲載ページ`}/></details>}
    </div>
  </details>
}
function App(){
  const [screen,setScreen]=useState('loading');
  const [status,setStatus]=useState('');
  // Backup completion notices belong to the screen where the action occurred.
  useEffect(()=>{setStatus(previous=>/^(取り込み完了|バックアップを書き出しました)/.test(previous)?'':previous);},[screen]);
  const [version,setVersion]=useState(null);
  const [pManifest,setPManifest]=useState(null);
  const [aManifest,setAManifest]=useState(null);
  const [events,setEvents]=useState([]);
  const [resumeDrafts,setResumeDrafts]=useState({});
  const [year,setYear]=useState(null);
  const [mode,setMode]=useState('first');
  const [page,setPage]=useState(1);
  const [answers,setAnswers]=useState({});
  const [scores,setScores]=useState({});
  const [reasons,setReasons]=useState({});
  const [elapsed,setElapsed]=useState(0);
  const [activeSection,setActiveSection]=useState(1);
  const [activeQuestionIndex,setActiveQuestionIndex]=useState(0);
  const [activePartSlots,setActivePartSlots]=useState({});
  const [viewerZoomed,setViewerZoomed]=useState(false);
  const [displayMode,setDisplayMode]=useState(()=>{
    try{
      const saved=localStorage.getItem('rikkyo-uk-kokugo.examDisplayMode');
      return ['screen','paper-focus','paper-overview'].includes(saved)?saved:'screen';
    }catch{return 'screen'}
  });
  const [paperPeekOpen,setPaperPeekOpen]=useState(false);
  const [sectionSeconds,setSectionSeconds]=useState({1:0,2:0,3:0});
  const [answerPage,setAnswerPage]=useState(1);
  const [sessionId,setSessionId]=useState(null);
  const [lastResult,setLastResult]=useState(null);
  const [busy,setBusy]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [storageInfo,setStorageInfo]=useState(null);
  const [legacyOpen,setLegacyOpen]=useState(false);
  const [legacy,setLegacy]=useState({owner:'',repo:'',token:'',passphrase:''});
  const [trainingSourceYear,setTrainingSourceYear]=useState(null);
  const [trainingAllSkills,setTrainingAllSkills]=useState([]);
  const [trainingSession,setTrainingSession]=useState(null);
  const [trainingStage,setTrainingStage]=useState('review');
  const [trainingSkillIndex,setTrainingSkillIndex]=useState(0);
  const [trainingItemIndex,setTrainingItemIndex]=useState(0);
  const [trainingSelection,setTrainingSelection]=useState(null);
  const [trainingFeedback,setTrainingFeedback]=useState(null);
  const [trainingOutcomes,setTrainingOutcomes]=useState({basic:{},transfer:{}});
  const [trainingMixedAnswers,setTrainingMixedAnswers]=useState({});
  const [trainingWrittenAssessments,setTrainingWrittenAssessments]=useState({});
  const [trainingMixedIndex,setTrainingMixedIndex]=useState(0);
  const [trainingChecked,setTrainingChecked]=useState(null);
  const [trainingVariant,setTrainingVariant]=useState(0);
  const [trainingQuestionStartedAt,setTrainingQuestionStartedAt]=useState(()=>Date.now());
  const [trainingAnswerChanges,setTrainingAnswerChanges]=useState(0);
  const [drillLibraryDomain,setDrillLibraryDomain]=useState(null);
  const [drillLibraryMode,setDrillLibraryMode]=useState('recommended');
  const [drillLibraryItemId,setDrillLibraryItemId]=useState(null);
  const [drillLibrarySelection,setDrillLibrarySelection]=useState(null);
  const [drillLibraryFeedback,setDrillLibraryFeedback]=useState(false);
  const [drillLibraryStartedAt,setDrillLibraryStartedAt]=useState(()=>Date.now());
  const timerRef=useRef(null);
  const practiceDraftTimerRef=useRef(null);
  const repairDraftTimerRef=useRef(null);
  const repairIdentityRef=useRef(null);
  const repairSaveNowRef=useRef(null);
  const timingSectionRef=useRef(null);
  const deviceId=useMemo(()=>getDeviceId(),[]);
  const freePracticeItems=useMemo(()=>getDrillLibraryItems(),[]);
  const visiblePracticeItems=useMemo(()=>getVisiblePracticeItems(freePracticeItems),[freePracticeItems]);
  const practiceStats=useMemo(()=>buildPracticeStats(events,freePracticeItems),[events,freePracticeItems]);

  const lifetimePracticeStats=useMemo(()=>buildLifetimePracticeStats(events,freePracticeItems,PRACTICE_POLICY.retainLifetimeIds),[events,freePracticeItems]);

  useEffect(()=>{
    if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
    boot();
    return()=>clearInterval(timerRef.current);
  },[]);

  useEffect(()=>{
    clearTimeout(practiceDraftTimerRef.current);
    if(screen!=='drill-library'||!drillLibraryItemId)return;
    const item=freePracticeItems.find(x=>x.id===drillLibraryItemId);
    if(item?.responseType!=='written'||(drillLibraryFeedback&&!drillLibraryFeedback.pendingSelfAssessment))return;
    const key=drillDraftKey(item);
    practiceDraftTimerRef.current=setTimeout(async()=>{
      const draft={year:key,draftType:'drill-written',draftId:drillLibraryFeedback?.draftId||crypto.randomUUID(),
        itemId:item.id,itemRevision:Number(item.revision||1),domain:item.domain,
        answer:String(drillLibrarySelection??''),stage:drillLibraryFeedback?.pendingSelfAssessment?'assessment':'answer',
        assessment:drillLibraryFeedback?.assessment||null,savedAt:new Date().toISOString()};
      await saveDraft(key,draft);
      setResumeDrafts(prev=>({...prev,[key]:draft}));
    },800);
    return()=>clearTimeout(practiceDraftTimerRef.current);
  },[screen,drillLibraryItemId,drillLibrarySelection,drillLibraryFeedback,freePracticeItems]);

  useEffect(()=>{
    clearTimeout(repairDraftTimerRef.current);
    if(screen!=='training'||!trainingSourceYear||!trainingSession)return;
    const identity=repairIdentityRef.current;
    if(!identity||identity.closed)return;
    const key=identity.key;
    const saveNow=()=>{
      identity.saving=(identity.saving||Promise.resolve()).then(async()=>{
      const phaseKey=trainingStage==='basic'?'basic':trainingStage==='transfer'?'transfer':null;
      const activeSkill=phaseKey?trainingSession.skills?.[trainingSkillIndex]:null;
      const activeItemId=phaseKey
        ?trainingSession.bySkill?.[activeSkill]?.[phaseKey]?.[trainingItemIndex]?.id
        :trainingStage==='mixed'?trainingSession.mixedItems?.[trainingMixedIndex]?.id:null;
      const sessionPlan=repairSessionPlan(trainingSession);
      const draft={year:key,draftType:'repair-session',draftId:identity.id,contentSet:KANJI_CONTENT_SET,
        sourceYear:examKeyForStorage(trainingSourceYear),allSkills:trainingAllSkills,sessionSkills:trainingSession.skills,
        sessionPlan,
        stage:trainingStage,skillIndex:trainingSkillIndex,itemIndex:trainingItemIndex,selection:trainingSelection,
        feedback:trainingFeedback?{itemId:trainingFeedback.item?.id,skill:trainingFeedback.skill,phaseKey:trainingFeedback.phaseKey,
          seconds:trainingFeedback.seconds,selected:trainingFeedback.selected,correct:trainingFeedback.correct,stable:trainingFeedback.stable,
          outcome:trainingFeedback.outcome,outcomesAfter:trainingFeedback.outcomesAfter,
          pendingSelfAssessment:trainingFeedback.pendingSelfAssessment,assessment:trainingFeedback.assessment}:null,
        outcomes:trainingOutcomes,mixedAnswers:trainingMixedAnswers,writtenAssessments:trainingWrittenAssessments,
        mixedIndex:trainingMixedIndex,checked:trainingChecked,variant:trainingVariant,
        activeItemId,answerChanges:trainingAnswerChanges,
        questionElapsedSeconds:Math.max(0,Math.round((Date.now()-trainingQuestionStartedAt)/1000)),savedAt:new Date().toISOString()};
      try{
        if(identity.closed)return;
        const result=await saveRepairDraft(key,draft,identity.generation);
        if(result.conflict){identity.closed=true;const ds=await allDrafts();setResumeDrafts(Object.fromEntries(ds.map(d=>[String(d.year),d])));setStatus('別のタブの途中保存と競合しました。両方の答案を保持しました。ホームから再開してください。');setScreen('home');return;}
        if(result.saved){identity.generation=result.record.generation;setResumeDrafts(prev=>({...prev,[key]:result.record}));}
      }catch(e){setStatus(`途中保存に失敗しました: ${e.message}`);}
      });
      return identity.saving;
    };
    repairSaveNowRef.current=saveNow;
    repairDraftTimerRef.current=setTimeout(saveNow,800);
    return()=>{clearTimeout(repairDraftTimerRef.current);repairSaveNowRef.current=null;};
  },[screen,trainingSourceYear,trainingAllSkills,trainingSession,trainingStage,trainingSkillIndex,trainingItemIndex,
    trainingSelection,trainingFeedback,trainingOutcomes,trainingMixedAnswers,trainingWrittenAssessments,
    trainingMixedIndex,trainingChecked,trainingVariant,trainingAnswerChanges]);

  async function loadVersionMeta(contentVersion=null){
    if(!contentVersion) return fetchJson('./content/current.json');
    return fetchJson(`./content/${contentVersion}/version.json`);
  }
  async function loadProblemManifest(v){
    return fetchJson(`./content/${v.contentVersion}/${v.problemManifest}`);
  }
  async function loadAnswerManifest(v,examKey,{submitted=false}={}){
    const completed=events.some(e=>e.type==='exam_completed'&&sameExamKey(eventExamKey(e),examKey));
    return fetchExamAnswers({version:v,examKey,policy:HOLDOUT_POLICY,submitted,completed,fetchJson});
  }
  async function boot(){
    // Learning history is loaded before network content so an app/content update failure
    // cannot make existing local progress appear to be lost.
    try{
      const [ev,ds,persistence]=await Promise.all([
        getAllEvents(),
        allDrafts(),
        storagePersistenceStatus()
      ]);
      setEvents(ev); setStorageInfo(persistence);
      setResumeDrafts(Object.fromEntries(ds.map(d=>[String(d.year),d])));
    }catch(e){
      setStatus(`端末の学習履歴を読み込めませんでした: ${e.message}`);
    }
    try{
      const v=await loadVersionMeta();
      const pm=await loadProblemManifest(v);
      setVersion(v); setPManifest(pm);
    }catch(e){
      setStatus(prev=>prev||`教材の読み込みエラー: ${e.message}。端末の学習履歴は削除していません。`);
    }finally{
      setScreen('home');
    }
  }
  async function reloadLocal(){
    const ev=await getAllEvents();
    const ds=await allDrafts();
    setEvents(ev); setResumeDrafts(Object.fromEntries(ds.map(d=>[String(d.year),d])));
  }

  function yearStatus(y){
    const ev=events.filter(e=>sameExamKey(eventExamKey(e),y));
    if(ev.some(e=>e.type==='exam_completed'&&e.attempt==='first')) return '初見完了';
    if(ev.some(e=>e.type==='exam_claimed')) return '開始済み';
    return 'この端末では未見';
  }
  function firstScores(){
    return events.filter(e=>e.type==='exam_completed'&&e.attempt==='first'&&Number.isFinite(e.totalScore));
  }
  function reviewPriorities(){
    return reviewPrioritiesForEvents(events);
  }
  function changeDisplayMode(next){
    if(!['screen','paper-focus','paper-overview'].includes(next)) return;
    setDisplayMode(next);
    setPaperPeekOpen(false);
    try{ localStorage.setItem('rikkyo-uk-kokugo.examDisplayMode',next); }catch{}
  }

  function startTimer(){
    clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{
      setElapsed(v=>v+1);
      setSectionSeconds(v=>{
        const s=timingSectionRef.current;
        return s?{...v,[s]:(v[s]||0)+1}:v;
      });
    },1000);
  }
  async function persistDraft(stage='exam'){
    if(!year) return;
    const d={year:String(year),attempt:mode,stage,sessionId,page,answerPage,contentVersion:version?.contentVersion,
      answers,scores,reasons,elapsed,sectionSeconds,activeSection,activeQuestionIndex,viewerZoomed,savedAt:new Date().toISOString()};
    await saveDraft(year,d);
    setResumeDrafts(prev=>({...prev,[String(year)]:d}));
  }

  useEffect(()=>{
    if(!year||!['exam','score'].includes(screen)) return;
    const t=setTimeout(()=>persistDraft(screen==='score'?'score':'exam').catch(()=>{}),250);
    return()=>clearTimeout(t);
  },[screen,year,page,answerPage,answers,scores,reasons,activeSection,activeQuestionIndex,viewerZoomed]);
  useEffect(()=>{
    if(screen!=='exam'||!year||elapsed===0||elapsed%10!==0) return;
    persistDraft('exam').catch(()=>{});
  },[elapsed,screen]);
  useEffect(()=>{
    if(screen!=='exam'||!pManifest||!year) return;
    const starts=pManifest.years[String(year)]?.sectionStarts||{};
    let s=null;
    for(const candidate of examSectionIds(pManifest.years[String(year)])){
      const start=Number(starts[String(candidate)]||0);
      if(start&&page>=start) s=candidate;
    }
    timingSectionRef.current=s;
  },[screen,pManifest,year,page]);

  function startFreeExam(y){
    const guided=getGuidedStep(events);
    const recommended=guided.type==='exam'?guided.year:null;
    if(recommended!==null&&sameExamKey(y,recommended)) return startExam(y,'first');
    const finalNote=isReservedExam(y)?`${examLabel(y)}は後半の確認用として残すことをおすすめします。\n\n`:'';
    const ok=window.confirm(`${finalNote}${examLabel(y)}を今ここで初見として使いますか？\n一度開始すると「この端末では未見」には戻りません。`);
    if(ok) startExam(y,'first');
  }

  async function startExam(y,attempt='first'){
    if(busy) return;
    setStatus('');
    setBusy(true);
    try{
      if(!canStartHoldout(y,HOLDOUT_POLICY,getGuidedStep(events))) throw new Error('最終確認は、前の過去問と弱点補強を終えた後に開始できます。');
      if(isFinalExam(y)&&HOLDOUT_POLICY?.strict===true&&attempt==='first'&&!window.confirm('最終未見確認を開始します。途中の学習用問題には戻せません。準備ができたら開始してください。'))return;
      const st=yearStatus(y);
      if(attempt==='first'&&st!=='この端末では未見') throw new Error('この端末ではすでに開始済みです。');
      const sid=crypto.randomUUID(), now=new Date().toISOString();
      const initial=initialExamPosition(pManifest?.years?.[String(y)]);
      const initialPage=initial.page;
      const d={year:String(y),attempt,stage:'exam',sessionId:sid,page:initialPage,answerPage:1,contentVersion:version.contentVersion,
        answers:{},scores:{},reasons:{},elapsed:0,sectionSeconds:initial.sectionSeconds,activeSection:initial.section,activeQuestionIndex:0,viewerZoomed:false,savedAt:now};
      await saveDraft(y,d);
      if(attempt==='first'){
        const claim={id:crypto.randomUUID(),type:'exam_claimed',year:examKeyForStorage(y),attempt:'first',sessionId:sid,deviceId,
          contentVersion:version.contentVersion,appVersion:APP_VERSION,createdAt:now};
        await putEvent(claim); setEvents(prev=>[...prev,claim]);
      }
      setAManifest(null);
      setYear(examKeyForStorage(y));setMode(attempt);setSessionId(sid);setPage(initialPage);setAnswerPage(1);
      setAnswers({});setScores({});setReasons({});setElapsed(0);setSectionSeconds(initial.sectionSeconds);setActiveSection(initial.section);
      setActiveQuestionIndex(0);setActivePartSlots({});setViewerZoomed(false);
      setResumeDrafts(prev=>({...prev,[String(y)]:d}));
      startTimer();setScreen('exam');
    }catch(e){setStatus(`開始できません: ${e.message}`)}
    finally{setBusy(false)}
  }
  async function resumeExam(y){
    try{
      const d=resumeDrafts[String(y)];
      if(!d) throw new Error('この端末に再開データがありません。');
      let v=version,pm=pManifest;
      if(d.contentVersion&&d.contentVersion!==version.contentVersion){
        v=await loadVersionMeta(d.contentVersion); pm=await loadProblemManifest(v);
        setVersion(v);setPManifest(pm);setAManifest(null);
      }
      setYear(examKeyForStorage(y));setMode(d.attempt||'practice');setSessionId(d.sessionId||null);setPage(d.page||1);setAnswerPage(d.answerPage||1);
      setAnswers(d.answers||{});setScores(d.scores||{});setReasons(d.reasons||{});setElapsed(d.elapsed||0);
      const initial=initialExamPosition(pm.years[String(y)]);
      setSectionSeconds(d.sectionSeconds||initial.sectionSeconds);setActiveSection(examSectionIds(pm.years[String(y)]).includes(d.activeSection)?d.activeSection:initial.section);
      setActiveQuestionIndex(Number.isFinite(d.activeQuestionIndex)?d.activeQuestionIndex:0);setActivePartSlots({});setViewerZoomed(!!d.viewerZoomed);
      if(d.stage==='score'){setAManifest(await loadAnswerManifest(v,y,{submitted:true}));setScreen('score')}
      else{startTimer();setScreen('exam')}
    }catch(e){setStatus(`再開できません: ${e.message}`)}
  }
  function updateAnswer(id,v){setAnswers(p=>({...p,[id]:v}))}
  function updateScore(id,v){setScores(p=>{const n={...p};if(v===''||v===null||Number.isNaN(Number(v)))delete n[id];else n[id]=Number(v);return n})}
  function computeAutoGrades(am,currentAnswers=answers){
    const rules=am?.years?.[String(year)]?.grading||{},fullAutoScores={},mixedAutoScores={},autoReasons={};
    for(const [qid,rule] of Object.entries(rules)){
      const question=pManifest?.years?.[String(year)]?.questions?.find(q=>q.id===qid);
      if(!question||!isScorableQuestion(question,SCORING_POLICY)) continue;
      if(rule.kind==='mixed'){
        const graded=gradeChoice(rule.choice,currentAnswers[`${qid}#choice`]||'');
        if(!graded) continue; mixedAutoScores[qid]=graded.score;if(!graded.correct)autoReasons[qid]=autoMissReason(qid);
      }else{
        const graded=gradeChoice(rule,currentAnswers[qid]||'');
        if(!graded) continue;fullAutoScores[qid]=graded.score;if(!graded.correct)autoReasons[qid]=autoMissReason(qid);
      }
    }
    return {fullAutoScores,mixedAutoScores,autoReasons,rules};
  }
  async function finishExam(){
    if(busy)return;setBusy(true);clearInterval(timerRef.current);
    try{
      const am=aManifest?.years?.[String(year)]?aManifest:await loadAnswerManifest(version,year,{submitted:true});
      const {fullAutoScores,autoReasons}=computeAutoGrades(am,answers);
      const mergedScores={...scores,...fullAutoScores},mergedReasons={...autoReasons,...reasons};
      setAManifest(am);setScores(mergedScores);setReasons(mergedReasons);setAnswerPage(1);
      await saveDraft(year,{year:String(year),attempt:mode,stage:'score',sessionId,page,answerPage:1,contentVersion:version.contentVersion,
        answers,scores:mergedScores,reasons:mergedReasons,elapsed,sectionSeconds,activeSection,activeQuestionIndex,viewerZoomed,savedAt:new Date().toISOString()});
      setScreen('score');
    }catch(e){startTimer();setStatus(`採点準備エラー: ${e.message}`)}
    finally{setBusy(false)}
  }
  function requestFinishExam(){
    const qs=pManifest?.years?.[String(year)]?.questions||[];
    const remaining=qs.filter(q=>answerState(q,answers)!=='done').length;
    const msg=remaining
      ?`未回答または途中の問題が ${remaining} 問あります。\n\nこのまま終了して採点しますか？`
      :'解答を終了して採点しますか？';
    if(window.confirm(msg)) finishExam();
  }

  async function finalizeScore(){
    if(busy)return;setBusy(true);
    try{
      const allQuestions=pManifest.years[String(year)].questions;
      const qs=allQuestions.filter(q=>isScorableQuestion(q,SCORING_POLICY));
      const {fullAutoScores,mixedAutoScores,autoReasons,rules}=computeAutoGrades(aManifest,answers);
      const finalScores={...scores,...fullAutoScores},finalReasons={...autoReasons,...reasons};
      const missing=qs.filter(q=>{
        const r=rules[q.id];
        if(r?.kind==='mixed') return !Object.prototype.hasOwnProperty.call(scores,q.id);
        return !r&&!Object.prototype.hasOwnProperty.call(finalScores,q.id);
      });
      if(missing.length) throw new Error(`手動採点が必要な問題が${missing.length}問残っています。0点も入力してください。`);
      const qResults=qs.map(q=>{
        const r=rules[q.id],mixed=r?.kind==='mixed';
        const manual=mixed?Number(scores[q.id]||0):0,auto=mixed?Number(mixedAutoScores[q.id]||0):0;
        return {...q,answer:answers[q.id]||'',selectionAnswer:mixed?(answers[`${q.id}#choice`]||''):undefined,
          score:mixed?manual+auto:Number(finalScores[q.id]),manualScore:mixed?manual:undefined,autoSelectionScore:mixed?auto:undefined,
          reason:finalReasons[q.id]||'',autoGraded:!!r&&!mixed,mixedAutoGraded:mixed};
      });
      const scoreSummary=summarizeExamScore(allQuestions,qResults,SCORING_POLICY);
      const event={id:crypto.randomUUID(),type:'exam_completed',year,attempt:mode,...scoreSummary,elapsedSeconds:elapsed,
        sectionSeconds,questionResults:qResults,contentVersion:version.contentVersion,problemManifestSha256:version.problemManifestSha256,
        scoringSha256:version.scoringSha256,gradingSha256:version.gradingSha256,appVersion:APP_VERSION,sessionId,deviceId,createdAt:new Date().toISOString()};
      await putEvent(event);await clearDraft(year);
      setEvents(prev=>[...prev,event]);setResumeDrafts(prev=>{const n={...prev};delete n[String(year)];return n});
      setLastResult(event);setStatus('この端末に保存しました。');setScreen('result');
    }catch(e){setStatus(`保存エラー: ${e.message}`)}
    finally{setBusy(false)}
  }
  async function openPastReview(y){
    if(busy)return;setBusy(true);
    try{
      const candidates=[...events].filter(e=>e.type==='exam_completed'&&sameExamKey(eventExamKey(e),y))
        .sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
      const target=candidates.find(e=>e.attempt==='first')||candidates[0];
      if(!target) throw new Error('この年度の採点済み履歴がありません。');
      const am=aManifest?.years?.[String(y)]?aManifest:await loadAnswerManifest(version,y);
      setAManifest(am);setYear(examKeyForStorage(y));setLastResult(target);setScreen('result');
    }catch(e){setStatus(`解説を開けません: ${e.message}`)}
    finally{setBusy(false)}
  }

  async function returnHome(){
    try{
      const v=await loadVersionMeta();const pm=await loadProblemManifest(v);
      setVersion(v);setPManifest(pm);setAManifest(null);await reloadLocal();setScreen('home');
    }catch(e){setStatus(`ホーム復帰エラー: ${e.message}`)}
  }

  function resetTrainingQuestion(){
    setTrainingSelection(null);
    setTrainingFeedback(null);
    setTrainingQuestionStartedAt(Date.now());
    setTrainingAnswerChanges(0);
  }

  function availableDrillLibraryDomains(){
    const keys=[...DRILL_LIBRARY_DOMAINS.map(x=>x.key),DRILL_LIBRARY_STRATEGY];
    return keys.filter(domain=>visiblePracticeItems.some(item=>item.domain===domain));
  }

  function openDrillLibrary(weakness=null){
    const fallbackWeakness=weaknessLedger(events)[0]?.skill||null;
    const target=drillLibraryTargetForWeakness(weakness||fallbackWeakness);
    const available=availableDrillLibraryDomains();
    const domain=available.includes(target.domain)?target.domain:(available[0]||DRILL_LIBRARY_DOMAINS[0]?.key||null);
    setDrillLibraryDomain(domain);
    setDrillLibraryMode(weakness?'recommended':'all');
    setDrillLibraryItemId(null);
    setDrillLibrarySelection(null);
    setDrillLibraryFeedback(false);
    setScreen('drill-library');
    window.scrollTo?.({top:0,behavior:'smooth'});
  }

  function selectDrillLibraryDomain(domain){
    if(!availableDrillLibraryDomains().includes(domain)) return;
    setDrillLibraryDomain(domain);
    setDrillLibraryItemId(null);
    setDrillLibrarySelection(null);
    setDrillLibraryFeedback(false);
  }

  function selectDrillLibraryMode(mode){
    if(!['recommended','unseen','wrong','all'].includes(mode)) return;
    setDrillLibraryMode(mode);
    setDrillLibraryItemId(null);
    setDrillLibrarySelection(null);
    setDrillLibraryFeedback(false);
  }

  function openDrillLibraryItem(id){
    const item=freePracticeItems.find(q=>q.id===id&&q.domain===drillLibraryDomain);
    if(!item) return;
    const draft=item.responseType==='written'?resumeDrafts[drillDraftKey(item)]:null;
    setDrillLibraryItemId(item.id);
    setDrillLibrarySelection(draft?.answer??null);
    setDrillLibraryFeedback(draft?.stage==='assessment'
      ?{pendingSelfAssessment:true,checks:writtenAnswerChecks(item,draft.answer),assessment:draft.assessment||{elementAssessments:{},unsupportedContent:null},draftId:draft.draftId}
      :false);
    setDrillLibraryStartedAt(Date.now());
    window.scrollTo?.({top:0,behavior:'smooth'});
  }

  function resumeDrillDraft(draft){
    const item=freePracticeItems.find(q=>q.id===draft?.itemId&&Number(q.revision||1)===Number(draft?.itemRevision||0));
    if(!item)return;
    setDrillLibraryDomain(item.domain);setDrillLibraryMode('all');setDrillLibraryItemId(item.id);
    setDrillLibrarySelection(draft.answer??null);
    setDrillLibraryFeedback(draft.stage==='assessment'
      ?{pendingSelfAssessment:true,checks:writtenAnswerChecks(item,draft.answer),assessment:draft.assessment||{elementAssessments:{},unsupportedContent:null},draftId:draft.draftId}
      :false);
    setDrillLibraryStartedAt(Date.now());setScreen('drill-library');window.scrollTo?.({top:0,behavior:'smooth'});
  }

  function openRetention(row){
    if(!row.due)return;
    const attempts=id=>events.filter(e=>e.type==='drill_practice_answered'&&e.itemId===id).length;
    const item=freePracticeItems.filter(q=>q.sourcePhase==='retention'&&q.domain===row.skill).sort((a,b)=>attempts(a.id)-attempts(b.id))[0];
    if(!item){setStatus('この分野の定着確認教材は準備中です。');return;}
    setDrillLibraryDomain(item.domain);setDrillLibraryItemId(item.id);setDrillLibrarySelection(null);setDrillLibraryFeedback(false);setDrillLibraryStartedAt(Date.now());setScreen('drill-library');
  }
  async function saveDrillLibraryAssessment(item,correct,extra={}){
    setBusy(true);
    try{
      if(item.sourcePhase==='retention'){
        const pending=(LEARNING_PATH_CONFIG.courseExamKeys||[]).flatMap(y=>pendingRetention(events,y));
        const row=pending.find(x=>x.skill===item.domain&&x.due);if(!row)throw new Error('定着確認は補強後24時間を過ぎてから行います。');
        extra={...extra,practicePhase:'retention',retentionRepairId:row.repairId,sourceYear:row.sourceYear};
      }
      const directAnswer=['text','written'].includes(item?.responseType);
      const structuredAnswer=['multi','order'].includes(item?.responseType);
      const answerPayload=directAnswer
        ?{answerText:String(drillLibrarySelection),gradingMode:item.responseType==='written'?'guided-written-self':item.textGrading==='kobun-exact'?'kobun-exact':'auto-text'}
        :structuredAnswer?{answerIndices:[...drillLibrarySelection],gradingMode:item.responseType==='order'?'auto-order':'auto-multi'}
        :{answerIndex:Number(drillLibrarySelection),gradingMode:'auto'};
      const event={id:`practice:${crypto.randomUUID()}`,type:'drill_practice_answered',itemId:item.id,
        itemRevision:Number(item.revision||1),...answerPayload,correct,...extra,domain:item.domain,
        ...(item.contentSet?{contentSet:item.contentSet}:{}),
        elapsedSeconds:Math.max(0,Math.round((Date.now()-drillLibraryStartedAt)/1000)),
        appVersion:APP_VERSION,deviceId,createdAt:new Date().toISOString()};
      await putEvent(event); setEvents(prev=>[...prev,event]); return true;
    }catch(e){setStatus(`練習履歴の保存エラー: ${e.message}`);return false}
    finally{setBusy(false)}
  }

  async function submitDrillLibraryAnswer(item){
    const directAnswer=['text','written'].includes(item?.responseType);
    const structuredAnswer=['multi','order'].includes(item?.responseType);
    const requiredCount=item?.responseType==='multi'?item.correctAnswers?.length:item?.responseType==='order'?item.options?.length:0;
    const missing=directAnswer?!String(drillLibrarySelection??'').trim():structuredAnswer?(!Array.isArray(drillLibrarySelection)||drillLibrarySelection.length!==requiredCount):drillLibrarySelection===null;
    if(!item||missing||drillLibraryFeedback||busy)return;
    if(item.responseType==='written'){
      setDrillLibraryFeedback({pendingSelfAssessment:true,checks:writtenAnswerChecks(item,drillLibrarySelection),assessment:{elementAssessments:{},unsupportedContent:null},
        draftId:resumeDrafts[drillDraftKey(item)]?.draftId||crypto.randomUUID()});return;
    }
    const correct=isDrillAnswerCorrect(item,drillLibrarySelection);
    if(await saveDrillLibraryAssessment(item,correct))setDrillLibraryFeedback({correct});
  }

  async function assessDrillLibraryWritten(item,outcome){
    if(!drillLibraryFeedback?.pendingSelfAssessment||busy)return;
    const checks=drillLibraryFeedback.checks||writtenAnswerChecks(item,drillLibrarySelection);
    if(outcome==='rewrite'){setDrillLibraryFeedback(false);return;}
    const assessment={...(drillLibraryFeedback.assessment||{}),outcome};
    const result=writtenSelfAssessmentResult(item,checks,assessment);
    if(outcome==='self-pass'&&!result.selfCorrect)return;
    const correct=outcome==='self-pass'&&result.selfCorrect;
    const extra={gradingMode:'guided-written-elements',criteriaMet:checks.criteriaMet,selfAssessed:true,
      elementAssessments:assessment.elementAssessments||{},allRequiredElementsMet:result.allRequiredElementsMet,
      unsupportedContent:assessment.unsupportedContent,unsupportedContentConfirmedAbsent:result.unsupportedContentConfirmedAbsent,
      selfAssessmentCompleted:result.completed,selfCorrect:correct,outcome:correct?'self-pass':'learned-not-mastered',
      draftId:drillLibraryFeedback.draftId||resumeDrafts[drillDraftKey(item)]?.draftId||null};
    if(await saveDrillLibraryAssessment(item,correct,extra)){
      await clearDraft(drillDraftKey(item));
      setResumeDrafts(prev=>{const next={...prev};delete next[drillDraftKey(item)];return next});
      setDrillLibraryFeedback({pendingSelfAssessment:false,checks,correct,assessment:extra});
    }
  }

  function closeDrillLibraryItem(){
    setDrillLibraryItemId(null);
    setDrillLibrarySelection(null);
    setDrillLibraryFeedback(false);
  }

  function closeDrillLibrary(){
    setDrillLibraryItemId(null);
    setDrillLibrarySelection(null);
    setDrillLibraryFeedback(false);
    setDrillLibraryMode('recommended');
    setScreen('home');
    window.scrollTo?.({top:0,behavior:'smooth'});
  }

  async function startRepair(sourceYear,skillsOverride=null){
    try{ if(!aManifest?.years?.[String(sourceYear)]&&version) setAManifest(await loadAnswerManifest(version,sourceYear)); }catch(e){ setStatus(`解説データ読込エラー: ${e.message}`); return; }
    setStatus('');
    const skills=Array.isArray(skillsOverride)&&skillsOverride.length?[...new Set(skillsOverride)]:nextRepairSkillsForYear(events,sourceYear);
    if(!skills.length){ setStatus('現在、補強する弱点はありません。'); return; }
    clearTimeout(repairDraftTimerRef.current);
    if(repairIdentityRef.current)repairIdentityRef.current.closed=true;
    const sessionId=crypto.randomUUID();
    repairIdentityRef.current={id:sessionId,key:repairDraftKey(sourceYear,sessionId),generation:0,closed:false};
    const usedItemIds=usedPracticeRefs(events,freePracticeItems,PRACTICE_POLICY.legacyRepairExcludedIds);
    const variant=examVariant(sourceYear);
    const session=buildDrillSession(DRILL_BANK,skills,variant,usedItemIds);
    setTrainingSourceYear(examKeyForStorage(sourceYear));
    setTrainingAllSkills(skills);
    setTrainingSession(session);
    setTrainingStage('review');
    setTrainingSkillIndex(0);
    setTrainingItemIndex(0);
    setTrainingOutcomes({basic:{},transfer:{}});
    setTrainingMixedAnswers({});
    setTrainingWrittenAssessments({});
    setTrainingMixedIndex(0);
    setTrainingChecked(null);
    setTrainingVariant(variant);
    resetTrainingQuestion();
    setScreen('training');
  }

  function resumeRepair(draft){
    if(!draft||draft.draftType!=='repair-session'||!Array.isArray(draft.allSkills)||!draft.allSkills.length)return;
    const session=hydrateRepairSession(draft,freePracticeItems);
    if(!session){setStatus('保存後に問題内容が更新されたため、この記述練習は自動再開できません。旧答案はバックアップに保持しています。');return;}
    clearTimeout(repairDraftTimerRef.current);
    if(repairIdentityRef.current)repairIdentityRef.current.closed=true;
    repairIdentityRef.current={id:draft.draftId,key:draft.year,generation:Number(draft.generation||0),closed:false};
    const savedFeedback=draft.feedback;
    let feedback=null;
    if(savedFeedback?.itemId){
      const candidates=[...Object.values(session.bySkill||{}).flatMap(group=>[...(group.basic||[]),...(group.transfer||[])]),...(session.mixedItems||[])];
      const item=candidates.find(x=>x.id===savedFeedback.itemId);
      if(item){
        const checks=item.responseType==='written'?writtenAnswerChecks(item,savedFeedback.selected):null;
        feedback={...savedFeedback,item,checks:checks||undefined};
      }
    }
    setTrainingSourceYear(examKeyForStorage(draft.sourceYear));setTrainingAllSkills(draft.allSkills);setTrainingSession(session);
    setTrainingStage(draft.stage||'review');setTrainingSkillIndex(Number(draft.skillIndex||0));setTrainingItemIndex(Number(draft.itemIndex||0));
    setTrainingSelection(draft.selection??null);setTrainingFeedback(feedback);
    setTrainingOutcomes(draft.outcomes||{basic:{},transfer:{}});setTrainingMixedAnswers(draft.mixedAnswers||{});
    setTrainingWrittenAssessments(draft.writtenAssessments||{});setTrainingMixedIndex(Number(draft.mixedIndex||0));
    setTrainingChecked(draft.checked||null);setTrainingVariant(Number(draft.variant||0));
    setTrainingAnswerChanges(Number(draft.answerChanges||0));
    setTrainingQuestionStartedAt(Date.now()-Math.max(0,Number(draft.questionElapsedSeconds||0))*1000);setScreen('training');
  }

  function trainingChooseOption(index){
    setTrainingSelection(prev=>{
      if(prev!==null&&prev!==index) setTrainingAnswerChanges(v=>v+1);
      return index;
    });
  }

  function recordTrainingOutcome(item,skill,phaseKey,correct,seconds,checks=null){
    const stable=trainingAnswerChanges<2&&seconds<=180;
    const outcome={id:item.id,revision:Number(item.revision||1),selected:trainingSelection,correct,stable,seconds,changes:trainingAnswerChanges,trap:correct?'':(item.trap||'誤答'),
      ...(item.responseType==='written'?{gradingMode:'guided-written-elements',criteriaMet:checks?.criteriaMet,selfAssessed:true,
        elementAssessments:checks?.assessment?.elementAssessments||{},unsupportedContent:checks?.assessment?.unsupportedContent,
        selfAssessmentCompleted:checks?.result?.completed===true,allRequiredElementsMet:checks?.result?.allRequiredElementsMet===true,
        selfCorrect:correct,outcome:correct?'self-pass':'learned-not-mastered'}:{})};
    const current=trainingOutcomes[phaseKey]?.[skill]||[],after=[...current,outcome];
    setTrainingOutcomes(prev=>({...prev,[phaseKey]:{...(prev[phaseKey]||{}),[skill]:after}}));
    setTrainingFeedback({item,skill,correct,stable,outcome,outcomesAfter:after,selected:trainingSelection,checks,pendingSelfAssessment:false});
  }

  function submitTrainingAnswer(){
    if(trainingSelection===null||trainingFeedback||!trainingSession)return;
    const phaseKey=trainingStage==='basic'?'basic':'transfer';
    if(!['basic','transfer'].includes(phaseKey))return;
    const skill=trainingSession.skills[trainingSkillIndex];
    const items=trainingSession.bySkill?.[skill]?.[phaseKey]||[],item=items[trainingItemIndex];
    if(!item)return;
    const seconds=Math.max(0,Math.round((Date.now()-trainingQuestionStartedAt)/1000));
    if(item.responseType==='written'){
      setTrainingFeedback({item,skill,phaseKey,seconds,selected:trainingSelection,
        checks:writtenAnswerChecks(item,trainingSelection),assessment:{elementAssessments:{},unsupportedContent:null},pendingSelfAssessment:true});return;
    }
    recordTrainingOutcome(item,skill,phaseKey,isDrillAnswerCorrect(item,trainingSelection),seconds);
  }

  function assessTrainingWritten(outcome){
    if(!trainingFeedback?.pendingSelfAssessment)return;
    const {item,skill,phaseKey,seconds,checks}=trainingFeedback;
    if(outcome==='rewrite'){setTrainingFeedback(null);return;}
    const assessment={...(trainingFeedback.assessment||{}),outcome};
    const result=writtenSelfAssessmentResult(item,checks,assessment);
    if(outcome==='self-pass'&&!result.selfCorrect)return;
    recordTrainingOutcome(item,skill,phaseKey,outcome==='self-pass'&&result.selfCorrect,seconds,{...checks,assessment,result});
  }

  function beginMixed(nextVariant=trainingVariant){
    const session=buildDrillSession(DRILL_BANK,trainingAllSkills,nextVariant);
    setTrainingSession(session);
    setTrainingStage('mixed');
    setTrainingSkillIndex(0);
    setTrainingItemIndex(0);
    setTrainingMixedAnswers({});
    setTrainingWrittenAssessments({});
    setTrainingMixedIndex(0);
    setTrainingChecked(null);
    resetTrainingQuestion();
  }

  function advanceTrainingAfterFeedback(){
    if(!trainingFeedback||!trainingSession) return;
    const skill=trainingFeedback.skill;
    if(trainingStage==='basic'){
      if(basicPassed(trainingFeedback.outcomesAfter)){
        if(trainingSkillIndex<trainingSession.skills.length-1){
          setTrainingSkillIndex(i=>i+1);setTrainingItemIndex(0);resetTrainingQuestion();return;
        }
        setTrainingStage('transfer');setTrainingSkillIndex(0);setTrainingItemIndex(0);resetTrainingQuestion();return;
      }
      const items=trainingSession.bySkill?.[skill]?.basic||[];
      if(trainingItemIndex+1<items.length){
        setTrainingItemIndex(i=>i+1);resetTrainingQuestion();return;
      }
      // 2連続に届かなければ、同じ分野を別順で追加練習。
      const nextVariant=trainingVariant+1;
      setTrainingVariant(nextVariant);
      setTrainingSession(buildDrillSession(DRILL_BANK,trainingSession.skills,nextVariant));
      setTrainingItemIndex(0);resetTrainingQuestion();return;
    }

    if(trainingStage==='transfer'){
      const currentRound=currentTransferRound(trainingFeedback.outcomesAfter,trainingItemIndex);
      if(currentRound.length<3){
        setTrainingItemIndex(i=>i+1);resetTrainingQuestion();return;
      }
      const result=transferResult(currentRound);
      if(result.passed){
        if(trainingSkillIndex<trainingSession.skills.length-1){
          setTrainingSkillIndex(i=>i+1);setTrainingItemIndex(0);resetTrainingQuestion();return;
        }
        // 失敗分野だけSTEP2へ戻った後も、混合確認は元の全弱点で再測定する。
        beginMixed(trainingVariant+1);
        setTrainingVariant(v=>v+1);
        return;
      }
      const nextVariant=trainingVariant+1;
      setTrainingVariant(nextVariant);
      setTrainingSession(buildDrillSession(DRILL_BANK,trainingSession.skills,nextVariant));
      setTrainingItemIndex(0);resetTrainingQuestion();return;
    }
  }

  function chooseMixedOption(index){
    if(!trainingSession) return;
    const item=trainingSession.mixedItems[trainingMixedIndex];
    if(!item) return;
    setTrainingMixedAnswers(prev=>({...prev,[item.key]:index}));
  }

  function finishMixed(writtenAssessments=trainingWrittenAssessments){
    const items=trainingSession?.mixedItems||[],result=mixedResult(items,trainingMixedAnswers,writtenAssessments,isDrillAnswerCorrect),bySkill={};
    for(const r of result.results)bySkill[r.skill]={correct:r.correct?1:0,total:1};
    setTrainingChecked({...result,score:result.correct,total:result.total,bySkill,answers:{...trainingMixedAnswers}});
    setTrainingStage(result.passed?'complete':'mixed-result');
  }

  function advanceMixed(){
    if(!trainingSession)return;
    const items=trainingSession.mixedItems||[],item=items[trainingMixedIndex];
    if(!item||trainingMixedAnswers[item.key]===undefined)return;
    if(trainingMixedIndex<items.length-1){
      setTrainingMixedIndex(i=>i+1);setTrainingQuestionStartedAt(Date.now());setTrainingAnswerChanges(0);return;
    }
    if(items.some(x=>x.responseType==='written')){
      setTrainingWrittenAssessments({});setTrainingStage('mixed-self-review');return;
    }
    finishMixed({});
  }

  function remediateFailedMixed(){
    const failed=trainingChecked?.failedSkills||[];
    if(!failed.length) return;
    const nextVariant=trainingVariant+1;
    setTrainingVariant(nextVariant);
    setTrainingSession(buildDrillSession(DRILL_BANK,failed,nextVariant));
    setTrainingStage('transfer');
    setTrainingSkillIndex(0);
    setTrainingItemIndex(0);
    setTrainingChecked(null);
    resetTrainingQuestion();
  }

  async function saveRepairResult(){
    if(!trainingChecked?.passed||!trainingSourceYear) return;
    const bySkill={};
    for(const skill of trainingAllSkills){
      const basic=trainingOutcomes.basic?.[skill]||[];
      const transfer=trainingOutcomes.transfer?.[skill]||[];
      const mixed=trainingChecked.results?.filter(r=>r.skill===skill)||[];
      bySkill[skill]={
        basicCorrect:basic.filter(x=>x.correct).length,basicTotal:basic.length,
        transferCorrect:transfer.filter(x=>x.correct).length,transferTotal:transfer.length,
        mixedCorrect:mixed.filter(x=>x.correct).length,mixedTotal:mixed.length
      };
    }
    const event={
      id:crypto.randomUUID(),type:'repair_block_completed',sourceYear:examKeyForStorage(trainingSourceYear),
      skills:trainingAllSkills,score:trainingChecked.score,total:trainingChecked.total,
      passed:true,skillScores:bySkill,trainingVersion:'passage-adaptive-v3',
      drillItemIds:[
        ...Object.values(trainingOutcomes.basic||{}).flat().map(x=>x.id),
        ...Object.values(trainingOutcomes.transfer||{}).flat().map(x=>x.id),
        ...(trainingChecked.results||[]).map(x=>x.id)
      ].filter(Boolean),
      appVersion:APP_VERSION,deviceId,createdAt:new Date().toISOString()
    };
    const identity=repairIdentityRef.current;
    if(!identity||identity.closed)return;
    const draftKey=identity.key;
    clearTimeout(repairDraftTimerRef.current);
    identity.closed=true;
    event.draftId=identity.id;
    if(LEARNING_PATH_CONFIG.requireSourceReplay===true)event.sourceReplay=trainingOutcomes.replay||{};
    event.contentSet=KANJI_CONTENT_SET;
    event.drillItemRefs=[...Object.values(trainingOutcomes.basic||{}).flat(),...Object.values(trainingOutcomes.transfer||{}).flat(),...(trainingChecked.results||[])].filter(x=>x.id).map(x=>({id:x.id,revision:Number(x.revision||1)}));
    try{await finishRepairDraft(draftKey,event);}catch(e){identity.closed=false;setStatus(`保存に失敗しました: ${e.message}`);return;}

    setResumeDrafts(prev=>{const next={...prev};delete next[draftKey];return next});
    const nextEvents=[...events,event];
    setEvents(nextEvents);
    const remaining=pendingRepairSkillsForYear(nextEvents,examKeyForStorage(trainingSourceYear));
    const nextPlan=repairPlanForYear(nextEvents,examKeyForStorage(trainingSourceYear));
    setStatus(remaining.length
      ?`今回の弱点トレーニングをクリアしました。残りのA/B ${remaining.length}件から、次の最優先3件が繰り上がります。`
      :nextPlan.pendingOptional.length||nextPlan.pendingDeferred.length
        ?`A/Bの補強が完了しました。未補強のC ${nextPlan.pendingOptional.length}件・D ${nextPlan.pendingDeferred.length}件は記録したまま、次年度で定着と新しい失点を確認します。`
        :'この年度で補強対象の弱点を完了しました。次の未見年度で定着を確認します。');
    setScreen('home');
  }

  function retryRepair(){
    if(!trainingSourceYear) return;
    startRepair(trainingSourceYear);
    setStatus('');
  }

  async function backup(){
    try{downloadJson(`rikkyo-uk-kokugo-backup-${new Date().toISOString().slice(0,10)}.json`,await exportLocalData(APP_VERSION));setStatus('バックアップを書き出しました。整合性情報も含まれています。')}
    catch(e){setStatus(`バックアップ失敗: ${e.message}`)}
  }
  async function restore(file){
    try{
      const data=await readJsonFile(file);
      const n=await importLocalData(data);
      await reloadLocal();
      const conflict=n.conflictingEvents?`／競合${n.conflictingEvents}件は端末側を保持`:'';
      setStatus(`取り込み完了：新規履歴${n.addedEvents}件、重複${n.duplicateEvents}件、下書き更新${n.draftsUpdated+n.draftsAdded}件${conflict}。`);
    }catch(e){setStatus(`取り込み失敗: ${e.message}`)}
  }
  async function importLegacy(){
    if(busy)return;setBusy(true);
    try{
      if(!legacy.owner||!legacy.repo||!legacy.token||!legacy.passphrase) throw new Error('4項目を入力してください。');
      setStatus('旧履歴を読み込んでいます…');
      const keyring=JSON.parse(dec.decode(await ghGetFile(legacy.owner,legacy.repo,'keyring.enc',legacy.token)));
      const unlocked=await unlockKeyring(keyring,legacy.passphrase);
      const root=b64ToBytes(unlocked.rootKeyB64),syncKey=await deriveSyncKey(root);
      const paths=await ghListEventPaths(legacy.owner,legacy.repo,legacy.token);
      const imported=[];
      for(const p of paths){
        const packed=await ghGetFile(legacy.owner,legacy.repo,p,legacy.token);
        const plain=await decryptPacked(syncKey,packed,`event:${p}`);
        const e=JSON.parse(dec.decode(plain));if(e?.id)imported.push(e);
      }
      await putEvents(imported);await reloadLocal();
      setLegacy(v=>({...v,token:'',passphrase:''}));setLegacyOpen(false);
      setStatus(`旧履歴を${imported.length}件取り込みました。Private repo側は変更していません。`);
    }catch(e){setStatus(`旧履歴取り込み失敗: ${e.message}`)}
    finally{setBusy(false)}
  }

  if(screen==='loading') return <main className="shell"><section className="hero"><h1>国語 60→75</h1><p>読み込み中…</p></section></main>;

  if(screen==='kobun-practice') return <KobunPractice events={events} deviceId={deviceId} appVersion={APP_VERSION} onSaved={rows=>setEvents(prev=>[...prev.filter(e=>!rows.some(r=>r.id===e.id)),...rows])} onClose={async()=>{await reloadLocal();setScreen('home');}}/>;

  if(screen==='next-exam-learning'&&LEARNING_PATH_CONFIG.features?.nextExamLearning===true) return <NextExamLearning events={events} problemManifest={pManifest} nextExamKey={getGuidedStep(events).year} onClose={async()=>{await reloadLocal();setScreen('home');}}/>;

  if(screen==='home'){
    const fs=firstScores().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))),priorities=reviewPriorities();
    const guided=getGuidedStep(events),progress=courseProgress(events),routeLabels=courseRouteLabels(events);
    const finalEvaluationReady=guided.type==='exam'&&isFinalExam(guided.year)&&HOLDOUT_POLICY?.strict===true;
    const guidedDraft=guided.type==='exam'?resumeDrafts[String(guided.year)]:null;
    const latest=fs[0];
    const ledger=weaknessLedger(events);
    const currentPlan=latest?repairPlanForYear(events,eventExamKey(latest)):{all:[],required:[],optional:[],deferred:[],repaired:[],pendingRequired:[],active:[]};
    const domainPriorities=aggregateDomainPriorities(currentPlan.all);
    const focusTop=domainPriorities.slice(0,3),laterDomains=domainPriorities.slice(3);
    const domainLedger=aggregateDomainLedger(ledger);
    const learningItemIds=new Set(visiblePracticeItems.filter(item=>item.domain!==DRILL_LIBRARY_STRATEGY).map(item=>item.id));
    const practiceEvents=events.filter(e=>e?.type==='drill_practice_answered'&&learningItemIds.has(e.itemId));
    const learnedPractice=visiblePracticeItems.filter(item=>item.domain!==DRILL_LIBRARY_STRATEGY&&lifetimePracticeStats.has(item.id)).length;
    const finalizedDraftIds=new Set(events.map(e=>e?.draftId).filter(Boolean));
    const latestPracticeDraft=Object.values(resumeDrafts).filter(d=>d?.draftType==='drill-written'&&!finalizedDraftIds.has(d.draftId)
      &&freePracticeItems.some(item=>item.id===d.itemId&&Number(item.revision||1)===Number(d.itemRevision||0)))
      .sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')))[0];
    const latestRepairDraft=Object.values(resumeDrafts).filter(d=>d?.draftType==='repair-session'&&!finalizedDraftIds.has(d.draftId)
      &&hydrateRepairSession(d,freePracticeItems))
      .sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')))[0];
    const retainedRepairDrafts=Object.values(resumeDrafts).filter(d=>String(d.year).startsWith(REPAIR_DRAFT_PREFIX)&&!finalizedDraftIds.has(d.draftId)&&!hydrateRepairSession(d,freePracticeItems));
    const latestLearningDraft=[latestPracticeDraft,latestRepairDraft].filter(Boolean)
      .sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')))[0];
    const goalRow=(target)=>{
      if(!latest) return <div className="goalRow"><span>{target}{NORMALIZED_SCORING?'%':'点'}</span><b>—</b><small>未測定</small></div>;
      const diff=Number(latest.totalScore)-target;
      return <div className={'goalRow '+(diff>=0?'reached':'pending')}><span>{target}{NORMALIZED_SCORING?'%':'点'}</span><b>{diff>=0?'✓':`あと${Math.abs(diff)}`}</b><small>{target===60?'最低目標':target===70?'安定圏':'上積み'}</small></div>;
    };
    return <main className="shell homeShell">
      <header className="homeHeader">
        <div><div className="eyebrow">RIKKYO UK KOKUGO</div><h1>立教英国 国語</h1></div>
        <button className="iconButton" aria-label="設定" onClick={()=>setSettingsOpen(v=>!v)}>⚙</button>
      </header>
      {settingsOpen&&<section className="card settings">
        <h2>設定</h2>
        <p className="muted">学習履歴は同じURLのIndexedDBに保存します。通常のアプリ更新では消去しません。</p>
        <p className="muted">{storageInfo?.persisted===true?'端末保存：ブラウザから永続保存の許可を取得済みです。':'端末保存：更新では保持されますが、ブラウザのサイトデータ削除・端末初期化などでは失われる可能性があります。'}</p>
        <div className="settingsActions">
          <button onClick={backup}>学習データを書き出す</button>
          <label className="fileButton">学習データを読み込む<input type="file" accept="application/json" onChange={e=>{const f=e.target.files?.[0];if(f)restore(f);e.target.value=''}} /></label>
          {LEARNING_PATH_CONFIG.features?.resetLearning===true&&<button onClick={async()=>{if(!window.confirm('この端末の国語アプリの答案・学習履歴を削除します。必要な場合は先に書き出してください。削除しますか？'))return;try{await resetLocalLearningData({confirmed:true});await reloadLocal();setStatus('学習履歴を削除しました。');}catch(e){setStatus('削除できません：'+e.message);}}}>学習履歴をリセット</button>}
          
        </div>
        {legacyOpen&&<div className="legacyBox">
          <p><b>旧Private GitHub履歴の一度だけの取り込み</b></p>
          <p className="muted">この操作だけ旧PATと旧パスフレーズが必要です。Private repoは読み取りのみで、削除・上書きしません。</p>
          <label>GitHub owner<input value={legacy.owner} onChange={e=>setLegacy({...legacy,owner:e.target.value})}/></label>
          <label>Private repo<input value={legacy.repo} onChange={e=>setLegacy({...legacy,repo:e.target.value})}/></label>
          <label>PAT<input type="password" value={legacy.token} onChange={e=>setLegacy({...legacy,token:e.target.value})}/></label>
          <label>旧パスフレーズ<input type="password" value={legacy.passphrase} onChange={e=>setLegacy({...legacy,passphrase:e.target.value})}/></label>
          <button className="primary" disabled={busy} onClick={importLegacy}>{busy?'取り込み中…':'取り込む'}</button>
        </div>}
      </section>}

      {retainedRepairDrafts.length>0&&<details className="card retainedRepairDrafts"><summary>保持している旧練習・競合した保存 {retainedRepairDrafts.length}件</summary>{retainedRepairDrafts.map(d=><p key={d.year}>{d.sourceYear?examLabel(d.sourceYear):'旧版'}／{d.savedAt||'日時不明'}／{d.allSkills?.join('・')}<br/>答案はバックアップに含まれます。<button disabled={d.sourceYear===undefined||d.sourceYear===null||String(d.sourceYear)===''||!d.allSkills?.length} onClick={()=>startRepair(d.sourceYear,d.allSkills)}>最新版で練習を始める</button></p>)}</details>}

      {latestLearningDraft&&<section className="card learningDraftResume">
        <div><div className="eyebrow">RESUME</div><h2>{latestLearningDraft.draftType==='repair-session'?'途中の補強練習があります':'途中の記述練習があります'}</h2>
          <p>{latestLearningDraft.draftType==='repair-session'?'弱点トレーニングの続きから再開します。':'入力した答案と自己採点の続きから再開します。'}</p></div>
        <button type="button" className="primary" onClick={()=>latestLearningDraft.draftType==='repair-session'
          ?resumeRepair(latestLearningDraft):resumeDrillDraft(latestLearningDraft)}>{latestLearningDraft.draftType==='repair-session'?'補強練習を再開 →':'記述練習を再開 →'}</button>
      </section>}

      <section className="dashboardHero">
        <article className={'card '+(finalEvaluationReady?'finalEvaluationPanel':'todayPanel')}>
          <div className="todayTop">
            <div><div className="eyebrow">{finalEvaluationReady?'FINAL EVALUATION':'NEXT STEP'}</div><span className="stageLabel">{guided.type==='exam'?'過去問':guided.type==='repair'?'弱点トレーニング':guided.type==='retention'?'定着確認':'コース完了'}</span></div>
            <div className="stepCount"><b>{progress.done}</b><span> / {progress.total}</span></div>
          </div>
          <h2>{guided.title}</h2>
          <p>{guided.why}</p>
          {guided.type==='repair'&&<div className="skillTags">{guided.skills.map(s=><span key={s}>{s}</span>)}</div>}
          <div className="progressTrack" aria-label={`学習コース ${progress.done}/${progress.total}`}>
            <span style={{width:`${Math.min(100,Math.round(progress.done/progress.total*100))}%`}} />
          </div>
          <div className="todayAction">
            {guided.type==='exam'&&(guidedDraft
              ?<button className="primary bigAction" onClick={()=>resumeExam(guided.year)}>{guidedDraft.stage==='score'?'採点を再開':'続きから解く'} <span>→</span></button>
              :<button className="primary bigAction" disabled={busy} onClick={()=>startExam(guided.year,'first')}>{examLabel(guided.year)}を始める <span>→</span></button>)}
            {guided.type==='repair'&&<button className="primary bigAction" onClick={()=>startRepair(guided.sourceYear)}>弱点トレーニングを始める <span>→</span></button>}
            {guided.type==='retention'&&<div>{guided.pending.map(row=><div key={row.skill}><b>{row.skill}</b><p>{row.due?'定着を確かめましょう。':`開始できる日時：${new Date(row.dueAt).toLocaleString('ja-JP')}`}</p><button disabled={!row.due} onClick={()=>openRetention(row)}>定着確認を始める</button></div>)}</div>}
            {guided.type==='complete'&&<div className="courseComplete">✓ コース完了</div>}
          </div>
        </article>

        <aside className="card goalPanel">
          <div className="eyebrow">CURRENT LEVEL</div>
          <div className="latestScore"><span>直近初見</span><strong>{latest?.totalScore??'—'}</strong><small>/100</small></div>
          <div className="goalRows">{goalRow(60)}{goalRow(70)}{goalRow(75)}</div>{LEARNING_PATH_CONFIG.scoreAuthorityNote&&<p className="muted">{LEARNING_PATH_CONFIG.scoreAuthorityNote}</p>}
        </aside>
      </section>

      {LEARNING_PATH_CONFIG.features?.nextExamLearning===true&&<section className="card"><h2>次の文章でも解けるように</h2><p>本文の根拠・対比記述・古文の人物関係を学び、別本文・長文・後日の確認へ。途中の過去問や補強練習がある場合は、先に上の再開から続けてください。</p><button onClick={()=>setScreen('next-exam-learning')}>記述の学習を始める・再開する</button></section>}

      <section className="homeColumns">
        <article className="card focusPanel">
          <div className="panelTitle"><div><div className="eyebrow">FOCUS</div><h2>{focusTop.length?`まず練習する${focusTop.length}分野`:'弱点の学習状況'}</h2></div></div>
          <PriorityStrategyLegend/>
          {latest
            ?(domainPriorities.length
              ?<>
                <div className="weaknessSummary">
                  <span>関連分野 <b>{domainPriorities.length}</b></span>
                  <span>今見る <b>{focusTop.length}</b></span>
                  <span>類題学習 <b>{learnedPractice}</b> / {learningItemIds.size}問</span>
                  <span>合計回答 <b>{practiceEvents.length}</b></span>
                </div>
                <p className="muted">過去問の失点を関連する学習分野へ整理しています。原因の入力は不要です。類題を解きながら、次年度にもいつでも進めます。</p>
                {!!focusTop.length&&<div className="priorityList compact">{focusTop.map(p=><div className="priorityItem hasAction" key={p.key}>
                  <span className={'priorityBadge p'+p.priority}>{p.priority}</span>
                  <div><b>{drillDomainLabel(p.key)}</b><small>{p.why}</small></div>
                  <button type="button" className="smallDrillLink" onClick={()=>openDrillLibrary(p.sourceSkills[0])}>類題を見る</button>
                </div>)}</div>}
                {!!laterDomains.length&&<details className="allWeaknesses"><summary>ほかの関連分野（{laterDomains.length}件）</summary>
                  <div className="priorityList compact">{laterDomains.map(p=><div className="priorityItem hasAction" key={p.key}>
                    <span className={'priorityBadge p'+p.priority}>{p.priority}</span>
                    <div><b>{drillDomainLabel(p.key)}</b><small>{p.why}</small></div>
                    <button type="button" className="smallDrillLink" onClick={()=>openDrillLibrary(p.sourceSkills[0])}>類題を見る</button>
                  </div>)}</div>
                </details>}
              </>
              :<p className="muted">この年度は練習対象となる失点分野がありません。次の未見年度へ進めます。</p>)
            :<p className="muted">まず初見過去問を1年度解くと、失点した内容を関連する学習分野へ整理します。</p>}
          {!!domainLedger.length&&<details className="allWeaknesses"><summary>これまでの弱点分野（{domainLedger.length}件）</summary>
            <div className="weaknessLedger">{domainLedger.map(w=><div className="weaknessLedgerRow" key={w.key}>
              <b>{drillDomainLabel(w.key)}</b>
              <small>{w.years.map(examLabel).join('・')}で失点／合計{w.misses}回</small>
              <button type="button" className="smallDrillLink" onClick={()=>{setDrillLibraryDomain(w.key);setDrillLibraryMode('recommended');setScreen('drill-library');window.scrollTo?.({top:0,behavior:'smooth'});}}>類題を見る</button>
            </div>)}</div>
          </details>}
        </article>

        <article className="card routePanel">
          <div className="eyebrow">LEARNING ROUTE</div><h2>過去問と類題を自由に進める</h2>
          <div className="routeRail">{routeLabels.map((step,i)=><div className={'routeStep '+(sameExamKey(guided.year,step.year)?'current':'')+(step.done?' done':'')} key={`${step.year}-${i}`}>
            <span>{step.done?'✓':i+1}</span><b>{step.label}</b>
          </div>)}</div>
          <p className="courseNote">{LEARNING_PATH_CONFIG.requireRemediation?'過去問で見つかった弱点を補強し、翌日の定着確認を終えて次の試験へ進みます。':LEARNING_PATH_CONFIG.examUnitNoun==='年度'?'類題練習を途中で止めても次年度へ進めます。':'類題練習を途中で止めても次の試験へ進めます。'}{RESERVED_EXAM_KEYS.length?`${RESERVED_EXAM_KEYS.map(examLabel).join('・')}は後半の確認用に残すことをおすすめします。`:''}</p>
        </article>
      </section>

      <section className="card drillLibraryEntry">
        <div>
          <div className="eyebrow">PRACTICE LIBRARY</div>
          <h2>弱点別 類題一覧</h2>
          <p>過去問とは別に、{DRILL_LIBRARY_DOMAINS.length}学習分野・{visiblePracticeItems.filter(item=>item.domain!==DRILL_LIBRARY_STRATEGY).length}問から、好きな問題をいつでも解けます。</p>
          <small>学習済み {learnedPractice}問／合計 {practiceEvents.length}回答。結果は保存しますが、過去問の得点や初見判定は変更しません。</small>
        </div>
        <button type="button" className="primary" onClick={()=>openDrillLibrary()}>類題一覧を開く →</button>
      </section>

      {LEARNING_PATH_CONFIG.features?.kobunPractice!==false&&<section className="card drillLibraryEntry"><div><h2>古文練習100問</h2><p>弱点別一覧と同じ100問を、共通本文ごとの5問セットで進めます。</p></div><button type="button" onClick={()=>setScreen('kobun-practice')}>古文100問を開く →</button></section>}
      <details className="card paperLibrary">
        <summary><span><b>過去問一覧</b><small>自由受験・復習はこちら</small></span><span>開く</span></summary>
        <div className="paperList">
          {sortExamKeys(Object.keys(pManifest?.years||{})).reverse().map(y=>{
            const st=yearStatus(y),draft=resumeDrafts[String(y)];
            return <div className="paperRow" key={y}>
              <div><b>{examLabel(y)}</b>{pManifest?.years?.[y]?.partial&&<small>{pManifest.years[y].notice}</small>}<span className={'pill '+(st==='この端末では未見'?'fresh':'used')}>{st}</span></div>
              {draft?<button className="primary" onClick={()=>resumeExam(y)}>{draft.stage==='score'?'採点を再開':'再開'}</button>
                :st==='この端末では未見'?(guided.type==='exam'&&sameExamKey(guided.year,y)
                  ?<button className="primary" disabled={busy} onClick={()=>startExam(y,'first')}>コースで開始</button>
                  :<button className="quietStart" disabled={busy||!canStartHoldout(y,HOLDOUT_POLICY,guided)} onClick={()=>startFreeExam(y)}>{isFinalExam(y)?'FINAL用':'自由受験'}</button>)
                :<div className="paperRowActions"><button onClick={()=>openPastReview(y)}>初見の解説を見る</button><button onClick={()=>startExam(y,'practice')}>復習で解く</button></div>}
            </div>
          })}
        </div>
      </details>
      {status&&<div className="toast" onClick={()=>setStatus('')}>{status}</div>}
    </main>
  }

  if(screen==='drill-library'){
    const domainDefinitions=[
      ...DRILL_LIBRARY_DOMAINS,
      {key:DRILL_LIBRARY_STRATEGY,label:'解答戦略',group:'strategy',description:'得点効率・見直し順'}
    ];
    const learningItems=visiblePracticeItems.filter(item=>item.domain!==DRILL_LIBRARY_STRATEGY);
    const strategyItems=visiblePracticeItems.filter(item=>item.domain===DRILL_LIBRARY_STRATEGY);
    const availableDomains=domainDefinitions.map(x=>x.key)
      .filter(domain=>visiblePracticeItems.some(item=>item.domain===domain));
    const selectedDomain=availableDomains.includes(drillLibraryDomain)?drillLibraryDomain:(availableDomains[0]||null);
    const baseItems=visiblePracticeItems.filter(item=>item.domain===selectedDomain);
    const unseen=baseItems.filter(item=>!practiceStats.has(item.id));
    const wrong=baseItems.filter(item=>practiceStats.get(item.id)?.latest?.correct===false);
    const items=selectPracticeItems(baseItems,practiceStats,drillLibraryMode);
    const activeItem=freePracticeItems.find(q=>q.id===drillLibraryItemId&&q.domain===selectedDomain&&(q.libraryHidden!==true||q.sourcePhase==='retention'))||null;
    const activeIndex=activeItem?baseItems.findIndex(q=>q.id===activeItem.id):-1;
    const nextCandidates=items.filter(item=>item.id!==activeItem?.id);
    const itemIndex=items.findIndex(item=>item.id===activeItem?.id);
    const laterCandidates=itemIndex>=0?items.slice(itemIndex+1):nextCandidates;
    const samePassageNext=activeItem?.contentSet===KOBUN_CONTENT_SET
      ?laterCandidates.find(item=>item.passage?.id===activeItem.passage?.id)
      :null;
    const nextItem=samePassageNext
      ||laterCandidates.find(item=>!activeItem?.passage?.id||item.passage?.id!==activeItem.passage.id)
      ||nextCandidates.find(item=>!activeItem?.passage?.id||item.passage?.id!==activeItem.passage.id)
      ||nextCandidates[0]||null;
    const learningItemIds=new Set(learningItems.map(item=>item.id));
    const practiceEvents=events.filter(e=>e?.type==='drill_practice_answered'&&learningItemIds.has(e.itemId));
    const recentPractice=[...practiceEvents].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,10);
    const learnedCount=learningItems.filter(item=>lifetimePracticeStats.has(item.id)).length;
    const recentCorrect=recentPractice.filter(e=>e.correct===true).length;

    if(activeItem){
      const selectedCorrect=activeItem.responseType==='written'
        ?drillLibraryFeedback?.correct===true
        :!!drillLibraryFeedback&&isDrillAnswerCorrect(activeItem,drillLibrarySelection);
      const directAnswer=['text','written'].includes(activeItem.responseType);
      const structuredAnswer=['multi','order'].includes(activeItem.responseType);
      const requiredCount=activeItem.responseType==='multi'?activeItem.correctAnswers?.length:activeItem.responseType==='order'?activeItem.options?.length:0;
      const answerMissing=directAnswer?!String(drillLibrarySelection??'').trim():structuredAnswer?(!Array.isArray(drillLibrarySelection)||drillLibrarySelection.length!==requiredCount):drillLibrarySelection===null;
      return <main className="shell adaptiveTraining drillLibraryShell">
        <header className="topbar trainingTopbar">
          <div><div className="eyebrow">{activeItem.sourcePhase==='retention'?'RETENTION':'FREE PRACTICE'}</div><h1>{drillDomainLabel(selectedDomain)}</h1></div>
          <button type="button" onClick={closeDrillLibraryItem}>← 類題一覧</button>
        </header>
        <div className="drillLibraryNotice"><b>自由練習</b><span>回答履歴は保存しますが、過去問の得点・答案・初見判定は変更しません。</span></div>
        <section className="trainingStageHead">
          <div><div className="eyebrow">{activeItem.passage?'本文あり':'短問'}</div><h2>{activeItem.sourcePhase==='retention'?'翌日の定着確認':`類題 ${activeItem.number||activeIndex+1} / ${baseItems.length}`}</h2></div>
          <div className="trainingCounter">累計 {lifetimePracticeStats.get(activeItem.id)?.attempts||0}回答</div>
        </section>
        <section className={'trainingQuestionLayout '+(!activeItem.passage?'noPassage':'')}>
          {activeItem.passage&&<article className="card passagePanel">
            <div className="passageMeta"><span>{activeItem.passage.genre}</span><small>本文</small></div>
            <p>{activeItem.passage.text}</p><PracticePassage item={activeItem}/>
          </article>}
          <article className="card focusedDrillCard">
            <div className="drillQuestionTags"><span>{drillDomainLabel(selectedDomain)}</span><small>{activeItem.passage?.genre||'知識確認'}・{activeItem.practiceType||activeItem.phase}</small></div>
            <h3>{activeItem.q}</h3>
            {activeItem.contentSet&&<><p>最新版 {practiceStats.get(activeItem.id)?.attempts||0}回答{!practiceStats.has(activeItem.id)&&lifetimePracticeStats.has(activeItem.id)?'・旧版で学習済み／最新版は未回答':''}</p>
              <details><summary>この問題の学習履歴</summary>{events.filter(e=>e.type==='drill_practice_answered'&&e.itemId===activeItem.id).map(e=>{
                const revision=Number(e.itemRevision||1),old=revision===activeItem.revision?activeItem:KANJI_HISTORY[`${e.itemId}:r${revision}`];
                return <div key={e.id}><b>{revision===activeItem.revision?'最新版':'旧版'} r{revision}・{e.correct?'正解':'不正解'}</b><p>{old?.q||'この旧版の問題文は保存されていません。'}</p><small>{e.createdAt}／回答: {e.answerText??(Number.isInteger(e.answerIndex)?old?.options?.[e.answerIndex]||optionLabel(e.answerIndex):'保存された判定を保持')}</small></div>;
              })}</details></>}

            {structuredAnswer
              ?<div className="focusedDrillOptions structuredDrillOptions">
                {activeItem.options.map((opt,i)=>{
                  const chosen=Array.isArray(drillLibrarySelection)?drillLibrarySelection:[];
                  const position=chosen.indexOf(i);
                  const selected=position>=0;
                  return <button type="button" key={i} disabled={drillLibraryFeedback}
                    className={selected?'selected':''}
                    onClick={()=>setDrillLibrarySelection(prev=>{
                      const current=Array.isArray(prev)?prev:[];
                      if(activeItem.responseType==='order') return current.includes(i)?current:([...current,i]);
                      return current.includes(i)?current.filter(x=>x!==i):current.length<requiredCount?[...current,i]:current;
                    })}>
                    <span>{activeItem.responseType==='order'&&selected?position+1:optionLabel(i)}</span><b>{opt}</b>
                  </button>;
                })}
                <small>{activeItem.responseType==='order'?'並べる順に文を選択してください。':'指定された数だけ選んでください。'}</small>
                {activeItem.responseType==='order'&&Array.isArray(drillLibrarySelection)&&drillLibrarySelection.length>0&&<button type="button" onClick={()=>setDrillLibrarySelection([])}>順番をやり直す</button>}
              </div>
              :directAnswer
              ?<div className="focusedDrillTextAnswer">
                <label htmlFor="drill-library-text-answer">解答</label>
                {activeItem.responseType==='written'?<textarea id="drill-library-text-answer" rows="5"
                  value={String(drillLibrarySelection??'')} disabled={drillLibraryFeedback}
                  onChange={e=>setDrillLibrarySelection(e.target.value)}
                  placeholder="本文の根拠を使って答案を入力"/>:<input id="drill-library-text-answer" type="text" inputMode="text" autoComplete="off"
                  value={String(drillLibrarySelection??'')} disabled={drillLibraryFeedback}
                  onChange={e=>setDrillLibrarySelection(e.target.value)}
                  placeholder={activeItem.strictText?'設問の指定どおりに入力':activeItem.textGrading==='kobun-exact'?'本文どおりに入力':'ひらがなで入力'}/>}
                <small>{activeItem.responseType==='written'
                  ?`${String(drillLibrarySelection??'').replace(/[\s　]/g,'').length}字／${activeItem.writingRules?.min?`${activeItem.writingRules.min}字以上`:''}${activeItem.writingRules?.max?`${activeItem.writingRules.max}字以内`:''}（字数・指定形式・必要語句を機械確認。内容は自己確認）`
                  :activeItem.strictText?'本文や設問の表記どおりに入力してください。句読点・漢字・仮名は区別します。':activeItem.textGrading==='kobun-exact'
                    ?'空白は除外します。句読点・小書き仮名・ひらがな／カタカナ・漢字は本文どおりに入力してください。'
                    :activeItem.strictText?'設問の表記と照合します。句読点・漢字・仮名は区別します。':'空白や句読点、ひらがな・カタカナの違いは採点時に吸収します。'}</small>
              </div>
              :<div className="focusedDrillOptions">
                {activeItem.options.map((opt,i)=>{
                  const selected=isChoiceIndexSelected(drillLibrarySelection,i);
                  const correct=drillLibraryFeedback&&i===activeItem.answer;
                  const wrong=drillLibraryFeedback&&selected&&i!==activeItem.answer;
                  return <button type="button" key={i} disabled={drillLibraryFeedback}
                    className={(selected?'selected ':'')+(correct?'correct ':wrong?'wrong ':'')}
                    onClick={()=>setDrillLibrarySelection(i)}>
                    <span>{optionLabel(i)}</span><b>{opt}</b>
                  </button>;
                })}
              </div>}
            {drillLibraryFeedback&&activeItem.responseType==='written'&&<div className={'focusedFeedback '+(drillLibraryFeedback.pendingSelfAssessment?'':selectedCorrect?'ok':'ng')}>
              {drillLibraryFeedback.pendingSelfAssessment
                ?<WrittenAssessmentPanel item={activeItem} answer={drillLibrarySelection} checks={drillLibraryFeedback.checks}
                  assessment={drillLibraryFeedback.assessment} busy={busy}
                  onChange={assessment=>setDrillLibraryFeedback(prev=>({...prev,assessment}))}
                  onRewrite={()=>assessDrillLibraryWritten(activeItem,'rewrite')}
                  onLearn={()=>assessDrillLibraryWritten(activeItem,'learned-not-mastered')}
                  onConfirm={()=>assessDrillLibraryWritten(activeItem,'self-pass')}/>
                :<div className="feedbackHeadline"><b>{selectedCorrect?'○ 自己採点で合格':'解答例を学習済み（未習得）'}</b></div>}
            </div>}
            {drillLibraryFeedback&&activeItem.responseType!=='written'&&<div className={'focusedFeedback '+(selectedCorrect?'ok':'ng')}>
              <div className="feedbackHeadline"><b>{selectedCorrect?'○ 正解':'× 要確認'}</b><span>{directAnswer?`解答例：${activeItem.acceptedAnswers?.[0]||''}`:structuredAnswer?'正しい組合せ・順序は解説で確認':`正解：${optionLabel(activeItem.answer)}`}</span></div>
              <p>{activeItem.why}</p>
              {!selectedCorrect&&activeItem.trap&&<small>次に注意する点：{activeItem.trap}</small>}
            </div>}
            <div className="focusedDrillFooter drillLibraryFooter">
              {!drillLibraryFeedback
                ?<button type="button" className="primary" disabled={answerMissing||busy} onClick={()=>submitDrillLibraryAnswer(activeItem)}>{busy?'保存中…':'答えを確定'}</button>
                :drillLibraryFeedback.pendingSelfAssessment?null:<>
                  <button type="button" onClick={closeDrillLibraryItem}>一覧に戻る</button>
                  {activeItem.sourcePhase==='retention'?<button type="button" className="primary" onClick={()=>setScreen('home')}>ホームで次の学習を確認</button>:nextItem&&<button type="button" className="primary" onClick={()=>openDrillLibraryItem(nextItem.id)}>次の問題 →</button>}
                </>}
            </div>
          </article>
        </section>
        {status&&<div className="toast" onClick={()=>setStatus('')}>{status}</div>}
      </main>;
    }

    return <main className="shell drillLibraryShell">
      <header className="topbar trainingTopbar drillLibraryTopbar">
        <div><div className="eyebrow">PRACTICE LIBRARY</div><h1>弱点別 類題一覧</h1><p>一覧から好きな問題を選び、必要なだけ続けて解けます。</p></div>
        <button type="button" onClick={closeDrillLibrary}>← ホーム</button>
      </header>
      <div className="drillLibraryNotice"><b>{learnedCount} / {learningItems.length}問を学習</b><span>合計{practiceEvents.length}回答{recentPractice.length?`・直近${recentPractice.length}回答中${recentCorrect}回正解`:''}。別枠：解答戦略 {strategyItems.length}問。</span></div>
      {LEARNING_PATH_CONFIG.features?.kobunPractice!==false&&<section className="card drillLibraryEntry"><div><h2>古文練習100問</h2><p>同じ100問を5問セットでも進められます。個別問題は下の古文2分野から選べます。</p></div><button type="button" onClick={()=>setScreen('kobun-practice')}>古文100問を開く →</button></section>}
      <section className="drillCauseFilter drillModeFilter">
        <div><b>解き方を選ぶ</b><small>いつでも変更できます</small></div>
        {[
          ['recommended','おすすめ',baseItems.length],['unseen','未回答',unseen.length],
          ['wrong','間違い直し',wrong.length],['all','一覧',baseItems.length]
        ].map(([mode,label,count])=><button type="button" key={mode} className={drillLibraryMode===mode?'selected':''} onClick={()=>selectDrillLibraryMode(mode)}>{label} <span>{count}</span></button>)}
      </section>
      {[
        ['skill','学習分野から選ぶ',`${domainDefinitions.filter(d=>d.group==='skill').length}分野`],['format','形式・解き方から選ぶ',`${domainDefinitions.filter(d=>d.group==='format').length}形式`]
      ].map(([group,title,count])=><React.Fragment key={group}>
        <div className="drillPickerHeading"><b>{title}</b><small>{count}</small></div>
        <section className="drillSkillPicker">
          {DRILL_LIBRARY_DOMAINS.filter(domain=>domain.group===group).map(domain=>{
            const domainItems=visiblePracticeItems.filter(item=>item.domain===domain.key);
            const learned=domainItems.filter(item=>lifetimePracticeStats.has(item.id)).length;
            return <button type="button" key={domain.key} disabled={!domainItems.length} className={domain.key===selectedDomain?'selected':''} onClick={()=>selectDrillLibraryDomain(domain.key)}>
              <span><b>{domain.label}</b><small>{domain.description}</small></span>
              <small>{learned} / {domainItems.length}問</small>
            </button>;
          })}
        </section>
      </React.Fragment>)}
      <section className="drillStrategyEntry">
        <button type="button" disabled={!strategyItems.length} className={selectedDomain===DRILL_LIBRARY_STRATEGY?'selected':''} onClick={()=>selectDrillLibraryDomain(DRILL_LIBRARY_STRATEGY)}>
          <span><b>解答戦略（参考）</b><small>通常の類題とは別枠です</small></span><strong>{strategyItems.length}問</strong>
        </button>
      </section>
      <section className="card drillItemLibrary">
        <div className="drillItemLibraryHead">
          <div><div className="eyebrow">SELECTED DOMAIN</div><h2>{drillDomainLabel(selectedDomain)}</h2><small>{drillLibraryMode==='recommended'?'おすすめ順':drillLibraryMode==='unseen'?'未回答のみ':drillLibraryMode==='wrong'?'前回不正解のみ':'全問題'}</small></div>
          <b>{items.length}問</b>
        </div>
        {!items.length&&<p className="muted">この条件に該当する問題はありません。「一覧」または別の分野を選んでください。</p>}
        <div className="drillPhaseList">
          {items.map((item,i)=>{
            const stat=practiceStats.get(item.id),latest=stat?.latest;
            const state=!stat?(lifetimePracticeStats.has(item.id)?'旧版で学習済み／最新版は未回答':'未回答'):latest?.correct===true?'前回正解':'前回不正解';
            return <button type="button" className="drillListRow" key={item.id} onClick={()=>openDrillLibraryItem(item.id)}>
              <span>{item.number||i+1}</span><div><b>{item.q}</b><small>{item.passage?item.passage.genre+'・本文あり':'短問'}／{item.practiceType||item.phase}／{state}{stat?`・${stat.attempts}回答`:''}</small></div><strong>解く →</strong>
            </button>;
          })}
        </div>
      </section>
    </main>;
  }

  if(screen==='training'){
    const sourceExam=[...events].filter(e=>e.type==='exam_completed'&&e.attempt==='first'&&sameExamKey(eventExamKey(e),trainingSourceYear))
      .sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    const sourcePlan=repairPlanForYear(events,examKeyForStorage(trainingSourceYear));
    const sourceMisses=(sourceExam?.questionResults||[]).filter(q=>Math.max(0,Number(q.points||0)-Number(q.score||0))>0)
      .filter(q=>trainingAllSkills.includes(inferCause(q)));
    const phaseKey=trainingStage==='basic'?'basic':trainingStage==='transfer'?'transfer':null;
    const skill=phaseKey?trainingSession?.skills?.[trainingSkillIndex]:null;
    const phaseItems=phaseKey&&skill?(trainingSession?.bySkill?.[skill]?.[phaseKey]||[]):[];
    const item=phaseKey?phaseItems[trainingItemIndex]:null;
    const mixedItem=trainingStage==='mixed'?trainingSession?.mixedItems?.[trainingMixedIndex]:null;
    const activeItem=item||mixedItem;
    const activeSelection=trainingStage==='mixed'&&mixedItem
      ?trainingMixedAnswers[mixedItem.key]
      :trainingSelection;
    const stepTitle=trainingStage==='basic'?'STEP 1｜基本':trainingStage==='transfer'?'STEP 2｜転用':trainingStage==='mixed'?'STEP 3｜混合確認':'';
    const stageProgress=trainingStage==='mixed'
      ?`${trainingMixedIndex+1} / ${trainingSession?.mixedItems?.length||0}`
      :phaseKey?`${trainingSkillIndex+1} / ${trainingSession?.skills?.length||0}`:'';
    const chooseActive=(value)=>{
      if(['multi','order'].includes(activeItem?.responseType)){
        const current=Array.isArray(activeSelection)?activeSelection:[];
        const required=activeItem.responseType==='multi'?activeItem.correctAnswers?.length:activeItem.options.length;
        const next=activeItem.responseType==='order'
          ?(current.includes(value)?current:[...current,value])
          :(current.includes(value)?current.filter(x=>x!==value):current.length<required?[...current,value]:current);
        if(trainingStage==='mixed') chooseMixedOption(next); else setTrainingSelection(next);
        return;
      }
      if(trainingStage==='mixed') chooseMixedOption(value);
      else if(['text','written'].includes(activeItem?.responseType)) setTrainingSelection(value);
      else trainingChooseOption(value);
    };
    const activeAnswerMissing=['text','written'].includes(activeItem?.responseType)
      ?!String(activeSelection??'').trim()
      :['multi','order'].includes(activeItem?.responseType)
        ?(!Array.isArray(activeSelection)||activeSelection.length!==(activeItem.responseType==='multi'?activeItem.correctAnswers?.length:activeItem.options.length))
        :activeSelection===null||activeSelection===undefined;
    return <main className="shell trainingShell adaptiveTraining">
      <header className="topbar trainingTopbar">
        <div><div className="eyebrow">WEAKNESS REPAIR</div><h1>{examLabel(trainingSourceYear)}の弱点トレーニング</h1></div>
        <button onClick={async()=>{clearTimeout(repairDraftTimerRef.current);await repairSaveNowRef.current?.();setScreen('home');}}>ホームへ</button>
      </header>

      <div className="trainingStepper" aria-label="弱点トレーニングの進行">
        {[
          ['review','元問題確認'],['basic','STEP 1 基本'],['transfer','STEP 2 転用'],['mixed','STEP 3 混合']
        ].map(([key,label],i)=>{
          const order={review:0,basic:1,transfer:2,mixed:3,'mixed-self-review':3,'mixed-result':3,complete:4};
          const current=order[trainingStage]??0;
          return <div key={key} className={'trainingStepChip '+(current===i?'current':current>i?'done':'')}><span>{current>i?'✓':i+1}</span><b>{label}</b></div>;
        })}
      </div>

      {trainingStage==='review'&&<section className="card sourceReviewPanel">
        <div className="eyebrow">BEFORE PRACTICE</div>
        <h2>まず、過去問で何を落としたか確認</h2>
        <p>類題を解く前に、{examLabel(trainingSourceYear)}で失点した場所と原因を確認します。ここでは答えを覚えるのではなく、「どこで読み方がずれたか」を1つだけ言える状態にします。</p>
        <div className="reviewSkillGrid">
          {trainingAllSkills.map((s,i)=><div className="reviewSkill" key={s}><span>{i+1}</span><div><b>{s}</b><small>この分野を別本文で直します</small></div></div>)}
        </div>
        {sourceMisses.length>0&&<div className="sourceMissList">
          <b>該当する元問題と解説</b>
          {trainingAllSkills.flatMap(skill=>sourceMisses.filter(q=>inferCause(q)===skill).slice(0,2)).slice(0,6).map(r=>{
            const q=pManifest?.years?.[String(trainingSourceYear)]?.questions?.find(x=>x.id===r.id)||r;
            const rule=aManifest?.years?.[String(trainingSourceYear)]?.grading?.[r.id];
            return <ReviewCard key={r.id} q={q} result={{...r,year:trainingSourceYear}} rule={rule} review={aManifest?.years?.[String(trainingSourceYear)]?.review?.[r.id]}
              totalScore={sourceExam?.totalScore||0} pManifest={pManifest} version={version}
              priorityOverride={priorityForResult(sourcePlan,r)}/>;
          })}
        </div>}
        <div className="sourceReviewNote">
          <b>確認すること</b>
          <span>① 設問要求　② 本文根拠　③ どこから判断がずれたか</span>
        </div>
        {LEARNING_PATH_CONFIG.requireSourceReplay===true&&trainingAllSkills.map(skill=>{
          const r=sourceMisses.find(q=>inferCause(q)===skill);if(!r)return null;
          const q=pManifest.years[String(trainingSourceYear)].questions.find(q=>q.id===r.id),data=aManifest?.years?.[String(trainingSourceYear)];
          const asset=pManifest.years[String(trainingSourceYear)].problemPages.find(p=>p.page===q.page)?.asset;
          return <SourceReplay key={q.id} question={q} record={data?.review?.[q.id]} rule={data?.grading?.[q.id]} grade={gradeChoice} ChoiceEditor={ChoiceAnswerEditor} imageSrc={`./content/${version.contentVersion}/assets/${asset}`} value={trainingOutcomes.replay?.[q.id]} onChange={value=>setTrainingOutcomes(prev=>({...prev,replay:{...prev.replay,[q.id]:value}}))}/>;
        })}
        <button className="primary trainingNextButton" disabled={LEARNING_PATH_CONFIG.requireSourceReplay===true&&trainingAllSkills.some(skill=>{const q=sourceMisses.find(q=>inferCause(q)===skill);return q&&!trainingOutcomes.replay?.[q.id]?.confirmed;})} onClick={()=>{
          setTrainingStage('basic');setTrainingSkillIndex(0);setTrainingItemIndex(0);resetTrainingQuestion();
        }}>確認した。STEP 1へ →</button>
      </section>}

      {['basic','transfer','mixed'].includes(trainingStage)&&activeItem&&<>
        <section className="trainingStageHead">
          <div><div className="eyebrow">{stepTitle}</div>
            <h2>{trainingStage==='mixed'?'何の弱点かは表示しません':skill}</h2>
            <p>{trainingStage==='basic'
              ?'短い本文で、まず基本の読み方を安定させます。2問連続で「正解＋安定回答」なら次へ進みます。'
              :trainingStage==='transfer'
                ?'同じ能力を別の見た目で使います。3問中2問以上、同じ誤り方を繰り返さなければ通過です。'
                :'初見の小問として解きます。途中では正誤・弱点名を出しません。最後にまとめて判定します。'}</p>
          </div>
          <div className="trainingCounter">{stageProgress}</div>
        </section>

        <section className={'trainingQuestionLayout '+(!activeItem.passage?'noPassage':'')}>
          {activeItem.passage&&<article className="card passagePanel">
            <div className="passageMeta"><span>{activeItem.passage.genre}</span><small>本文</small></div>
            <p>{activeItem.passage.text}</p><PracticePassage item={activeItem}/>
          </article>}
          <article className="card focusedDrillCard">
            {trainingStage!=='mixed'&&<div className="drillSkillTag">{skill}</div>}
            <h3>{activeItem.q}</h3>
            {['multi','order'].includes(activeItem.responseType)
              ?<div className="focusedDrillOptions structuredDrillOptions">
                {activeItem.options.map((opt,i)=>{
                  const chosen=Array.isArray(activeSelection)?activeSelection:[];
                  const position=chosen.indexOf(i);
                  return <button type="button" key={i} disabled={trainingStage!=='mixed'&&!!trainingFeedback}
                    className={position>=0?'selected':''} onClick={()=>chooseActive(i)}>
                    <span>{activeItem.responseType==='order'&&position>=0?position+1:optionLabel(i)}</span><b>{opt}</b>
                  </button>;
                })}
                <small>{activeItem.responseType==='order'?'並べる順に文を選択してください。':'指定された数だけ選んでください。'}</small>
                {activeItem.responseType==='order'&&Array.isArray(activeSelection)&&activeSelection.length>0&&<button type="button" onClick={()=>trainingStage==='mixed'?chooseMixedOption([]):setTrainingSelection([])}>順番をやり直す</button>}
              </div>
              :['text','written'].includes(activeItem.responseType)
              ?<div className="focusedDrillTextAnswer">
                <label htmlFor="training-text-answer">解答</label>
                {activeItem.responseType==='written'?<textarea id="training-text-answer" rows="5"
                  value={String(activeSelection??'')} disabled={trainingStage!=='mixed'&&!!trainingFeedback}
                  onChange={e=>chooseActive(e.target.value)}
                  placeholder="本文の根拠を使って答案を入力"/>:<input id="training-text-answer" type="text" inputMode="text" autoComplete="off"
                  value={String(activeSelection??'')} disabled={trainingStage!=='mixed'&&!!trainingFeedback}
                  onChange={e=>chooseActive(e.target.value)}
                  placeholder={activeItem.strictText?'設問の指定どおりに入力':'ひらがなで入力'}/>}
                <small>{activeItem.responseType==='written'
                  ?`${String(activeSelection??'').replace(/[\s　]/g,'').length}字／${activeItem.writingRules?.min?`${activeItem.writingRules.min}字以上`:''}${activeItem.writingRules?.max?`${activeItem.writingRules.max}字以内`:''}（字数・指定形式・必要語句を機械確認。内容は自己確認）`
                  :activeItem.strictText?'設問の表記と照合します。句読点・漢字・仮名は区別します。':'空白や句読点、ひらがな・カタカナの違いは採点時に吸収します。'}</small>
              </div>
              :<div className="focusedDrillOptions">
                {activeItem.options.map((opt,i)=>{
                  const selected=isChoiceIndexSelected(activeSelection,i);
                  const reveal=trainingStage!=='mixed'&&!!trainingFeedback;
                  const correct=reveal&&i===activeItem.answer;
                  const wrong=reveal&&selected&&i!==activeItem.answer;
                  return <button type="button" key={i} disabled={reveal}
                    className={(selected?'selected ':'')+(correct?'correct ':wrong?'wrong ':'')}
                    onClick={()=>chooseActive(i)}>
                    <span>{optionLabel(i)}</span><b>{opt}</b>
                  </button>;
                })}
              </div>}

            {trainingStage!=='mixed'&&trainingFeedback&&<div className={'focusedFeedback '+(trainingFeedback.pendingSelfAssessment?'':trainingFeedback.correct?'ok':'ng')}>
              {trainingFeedback.pendingSelfAssessment
                ?<WrittenAssessmentPanel item={trainingFeedback.item} answer={trainingSelection} checks={trainingFeedback.checks}
                  assessment={trainingFeedback.assessment}
                  onChange={assessment=>setTrainingFeedback(prev=>({...prev,assessment}))}
                  onRewrite={()=>assessTrainingWritten('rewrite')}
                  onLearn={()=>assessTrainingWritten('learned-not-mastered')}
                  onConfirm={()=>assessTrainingWritten('self-pass')}/>
                :<><div className="feedbackHeadline"><b>{trainingFeedback.item.responseType==='written'?(trainingFeedback.correct?'○ 自己採点で合格':'解答例を学習済み（未習得）'):(trainingFeedback.correct?'○ 正解':'× 要確認')}</b>
                  <span>回答安定度（推定）：{trainingFeedback.stable?'安定':'要注意'}</span></div>
                  {trainingFeedback.item.responseType!=='written'&&<><p>{trainingFeedback.item.why}</p>{trainingFeedback.item.responseType==='text'&&<p>解答：{trainingFeedback.item.acceptedAnswers?.[0]}</p>}</>}
                  {!trainingFeedback.correct&&trainingFeedback.item.trap&&<small>今回の確認点：{trainingFeedback.item.trap}</small>}</>}
            </div>}

            <div className="focusedDrillFooter">
              {trainingStage==='mixed'
                ?<button className="primary" disabled={activeAnswerMissing} onClick={advanceMixed}>
                    {trainingMixedIndex<(trainingSession?.mixedItems?.length||1)-1?'次の問へ →':'まとめて判定する'}
                  </button>
                :!trainingFeedback
                  ?<button className="primary" disabled={activeAnswerMissing} onClick={submitTrainingAnswer}>答えを確定</button>
                  :trainingFeedback.pendingSelfAssessment?null
                  :<button className="primary" onClick={advanceTrainingAfterFeedback}>次へ →</button>}
            </div>
          </article>
        </section>
      </>}

      {trainingStage==='mixed-self-review'&&<section className="card mixedResultPanel">
        <div className="eyebrow">STEP 3 SELF CHECK</div><h2>記述答案を自己採点</h2>
        <p>全問回答後に、記述だけ解答例と比べます。機械判定は字数・指定形式・必要語句の確認までです。</p>
        <div className="mixedResultList">
          {(trainingSession?.mixedItems||[]).filter(item=>item.responseType==='written').map(item=>{
            const checks=writtenAnswerChecks(item,trainingMixedAnswers[item.key]),assessed=trainingWrittenAssessments[item.key];
            return <div className={assessed?.outcome==='self-pass'?'ok':assessed?.outcome==='learned-not-mastered'?'ng':''} key={item.key}>
              <div className="mixedWrittenReview"><b>{item.q}</b>
                <label>自分の答案（ここで書き直せます）<textarea rows="5" value={String(trainingMixedAnswers[item.key]??'')}
                  onChange={event=>{setTrainingMixedAnswers(prev=>({...prev,[item.key]:event.target.value}));setTrainingWrittenAssessments(prev=>({...prev,[item.key]:undefined}));}}/></label>
                <WrittenAssessmentPanel item={item} answer={trainingMixedAnswers[item.key]} checks={checks} assessment={assessed}
                  onChange={assessment=>setTrainingWrittenAssessments(prev=>({...prev,[item.key]:assessment}))}
                  onRewrite={()=>setTrainingWrittenAssessments(prev=>({...prev,[item.key]:undefined}))}
                  onLearn={()=>setTrainingWrittenAssessments(prev=>({...prev,[item.key]:{...(prev[item.key]||{}),outcome:'learned-not-mastered'}}))}
                  onConfirm={()=>setTrainingWrittenAssessments(prev=>({...prev,[item.key]:{...(prev[item.key]||{}),outcome:'self-pass'}}))}/>
              </div>
            </div>;
          })}
        </div>
        <button className="primary trainingNextButton" disabled={(trainingSession?.mixedItems||[]).filter(item=>item.responseType==='written').some(item=>!['self-pass','learned-not-mastered'].includes(trainingWrittenAssessments[item.key]?.outcome))}
          onClick={()=>finishMixed(trainingWrittenAssessments)}>自己採点を確定 →</button>
      </section>}

      {trainingStage==='mixed-result'&&trainingChecked&&<section className="card mixedResultPanel">
        <div className="eyebrow">STEP 3 RESULT</div>
        <h2>{trainingChecked.score} / {trainingChecked.total}</h2>
        <p>途中では弱点名を出さずに解いた結果です。間違えた分野だけSTEP 2へ戻します。</p>
        <div className="mixedResultList">
          {(trainingSession?.mixedItems||[]).map(item=>{
            const correct=trainingChecked.results?.find(result=>result.id===item.id)?.correct===true;
            return <div className={correct?'ok':'ng'} key={item.key}>
              <span>{correct?'○':'×'}</span>
              <div><b>{item.q}</b><small>{correct?'正解':`正解：${optionLabel(item.answer)}　${item.why}`}</small></div>
            </div>;
          })}
        </div>
        <div className="failedSkillBox"><b>戻る分野</b><span>{trainingChecked.failedSkills.join(' ／ ')}</span></div>
        <button className="primary trainingNextButton" onClick={remediateFailedMixed}>失敗した分野だけ追加練習 →</button>
      </section>}

      {trainingStage==='complete'&&trainingChecked?.passed&&<section className="card adaptiveComplete">
        <div><div className="eyebrow">TRANSFER CHECK PASSED</div><h2>混合確認クリア</h2></div>
        <div className="completeScore"><strong>{trainingChecked.score}</strong><span>/ {trainingChecked.total}</span></div>
        <p>弱点名を表示しない状態でも正解できました。次の未見年度で、本当に初見本文へ転用できるか確認します。</p>
        <button className="primary trainingNextButton" onClick={saveRepairResult}>クリアを記録して次へ →</button>
      </section>}

      {status&&<div className="toast" onClick={()=>setStatus('')}>{status}</div>}
    </main>
  }

  if(screen==='exam'){
    const y=pManifest.years[String(year)],qs=y.questions.filter(q=>q.section===activeSection),pageCount=y.problemPages.length;
    const sections=examSectionIds(y);
    const safeIndex=Math.max(0,Math.min(activeQuestionIndex,Math.max(0,qs.length-1)));
    const q=qs[safeIndex];
    const meta=y.problemPages.find(x=>x.page===page);
    const pageSrc=meta?`./content/${version.contentVersion}/assets/${meta.asset}`:'';
    const answeredCount=qs.filter(item=>answerState(item,answers)==='done').length;

    const setQuestionAndPage=(index,section=activeSection)=>{
      const sectionQs=y.questions.filter(item=>item.section===section);
      const safe=Math.max(0,Math.min(Number(index)||0,Math.max(0,sectionQs.length-1)));
      const target=sectionQs[safe];
      setActiveSection(section);
      setActiveQuestionIndex(safe);
      setPaperPeekOpen(false);
      if(target?.page) setPage(Number(target.page));
    };
    const switchSection=(s)=>{
      const sectionQs=y.questions.filter(item=>item.section===s);
      const first=sectionQs[0];
      setActiveSection(s);setActiveQuestionIndex(0);setPaperPeekOpen(false);
      const targetPage=Number(first?.page||y.sectionStarts?.[String(s)]||0);
      if(targetPage) setPage(targetPage);
    };
    const moveQuestion=(delta)=>{
      const next=safeIndex+delta;
      if(next>=0&&next<qs.length){setQuestionAndPage(next);return;}
      const neighbor=adjacentSection(y,activeSection,delta);
      if(neighbor===null) return;
      if(delta>0) switchSection(neighbor);
      else {
        const prevSection=neighbor;
        const prevQs=y.questions.filter(item=>item.section===prevSection);
        setQuestionAndPage(Math.max(0,prevQs.length-1),prevSection);
      }
    };
    const qFormat=q?.answerFormat;
    const partIndex=activePartSlots[q?.id]||0;
    const questionState=q?answerState(q,answers):'empty';

    const renderEditor=(targetQ,{paper=false}={})=>{
      if(!targetQ) return null;
      const f=targetQ.answerFormat;
      const pi=activePartSlots[targetQ.id]||0;
      const textValue=String(answers[targetQ.id]||'');
      return <div className={'answerArea '+(paper?'paperAnswerArea':'')}>
        {['text','text-parts'].includes(f?.kind)?<TextAnswerEditor format={f} value={textValue} onChange={v=>updateAnswer(targetQ.id,v)}/>:f?.kind==='mixed'?<>
          <label className="writtenAnswer"><span>記述</span><textarea rows={paper?12:5} value={textValue}
            onChange={e=>updateAnswer(targetQ.id,e.target.value)} placeholder="解答を入力"/></label>
          <div className="charCount">{textValue.length}字入力</div>
          <div className="mixedChoice"><span>選択部分</span><ChoiceAnswerEditor format={f.choice}
            value={answers[`${targetQ.id}#choice`]||''} onChange={v=>updateAnswer(`${targetQ.id}#choice`,v)}
            partIndex={pi} onPartIndex={i=>setActivePartSlots(p=>({...p,[targetQ.id]:i}))}/></div>
        </>:f?<ChoiceAnswerEditor format={f} value={answers[targetQ.id]||''} onChange={v=>updateAnswer(targetQ.id,v)}
              partIndex={pi} onPartIndex={i=>setActivePartSlots(p=>({...p,[targetQ.id]:i}))}/>
          :<><label className="writtenAnswer"><span>記述解答</span><textarea rows={paper?14:7} value={textValue}
              onChange={e=>updateAnswer(targetQ.id,e.target.value)} placeholder="解答を入力"/></label>
            <div className="charCount">{textValue.length}字入力</div></>}
      </div>;
    };

    const compactAnswer=(targetQ)=>{
      const state=answerState(targetQ,answers);
      if(state==='empty') return '未回答';
      const f=targetQ.answerFormat;
      if(f?.kind==='mixed'){
        const written=String(answers[targetQ.id]||'').trim();
        const selected=displayAnswer(answers[`${targetQ.id}#choice`],f.choice);
        const w=written?`${written.length}字`:'記述なし';
        return `${w}${selected?` / 選択 ${selected}`:''}`;
      }
      if(f){
        const shown=displayAnswer(answers[targetQ.id],f);
        return shown||'途中';
      }
      const written=String(answers[targetQ.id]||'').trim();
      return written?`${written.length}字`:'未回答';
    };

    const sectionTabs=<div className="sectionTabs">{sections.map(s=><button key={s} className={activeSection===s?'active':''} onClick={()=>switchSection(s)}>
      <b>大問{s}</b><small>{fmtElapsed(sectionSeconds[s]||0)}</small>
    </button>)}</div>;

    const questionNav=<div className="questionStatus">
      <div><b>大問{activeSection}</b><span>{answeredCount}/{qs.length} 回答</span></div>
      <div className="questionDots">
        {qs.map((item,i)=><button key={item.id} aria-label={`問${item.question}`}
          className={(i===safeIndex?'current ':'')+answerState(item,answers)}
          onClick={()=>setQuestionAndPage(i)}>{item.question}</button>)}
      </div>
    </div>;

    const paperCompactNav=<div className="paperCompactNav">
      <div className="paperSectionMini">
        {sections.map(s=><button key={s} className={activeSection===s?'active':''} onClick={()=>switchSection(s)}>
          大問{s}<small>{fmtElapsed(sectionSeconds[s]||0)}</small>
        </button>)}
      </div>
      <div className="paperQuestionMini">
        <span><b>問{q?.question||''}</b><small>{safeIndex+1} / {qs.length}</small></span>
        <div className="paperMiniDots">
          {qs.map((item,i)=><button key={item.id} aria-label={`問${item.question}`}
            className={(i===safeIndex?'current ':'')+answerState(item,answers)}
            onClick={()=>setQuestionAndPage(i)}>{item.question}</button>)}
        </div>
      </div>
    </div>;

    const activeQuestionPanel=q&&<div className={'activeQuestion '+(displayMode==='paper-focus'?'paperQuestion':'')}>
      <div className="questionHead">
        <div><span className="questionNumber">問{q.question}</span><small>{q.topic}</small></div>
        <span className={'answerBadge '+questionState}>{questionState==='done'?'回答済':questionState==='partial'?'途中':'未回答'}</span>
      </div>
      {displayMode==='paper-focus'&&<div className="paperInstruction compact">
        <span>紙：大問{activeSection}・問{q.question}</span>
        <button type="button" onClick={()=>{
          if(q.page) setPage(Number(q.page));
          setPaperPeekOpen(true);
        }}>問題を画面で確認</button>
      </div>}
      {renderEditor(q,{paper:displayMode==='paper-focus'})}
      <div className="questionFooter">
        <button disabled={activeSection===sections[0]&&safeIndex===0} onClick={()=>moveQuestion(-1)}>← 前の問</button>
        <button className="primary" disabled={activeSection===sections.at(-1)&&safeIndex===qs.length-1} onClick={()=>moveQuestion(1)}>次の問 →</button>
      </div>
    </div>;

    return <main className={'examShell mode-'+displayMode}>
      <header className="examBar">
        <div className="examIdentity"><b>{examLabel(year)}</b><span>{mode==='first'?'初見本番':'学習'}</span></div>
        <div className="examClock"><small>経過</small><div className="clock">{fmtElapsed(elapsed)}</div></div>
        <div className="examViewActions" aria-label="表示方法">
          {displayMode==='screen'?<>
            <button type="button" className="paperModeHeaderButton" onClick={()=>changeDisplayMode('paper-focus')}>
              <span>紙で問題を見る</span><small>解答欄を大きく</small>
            </button>
          </>:<>
            <button type="button" onClick={()=>changeDisplayMode('screen')}>
              <span className="wideLabel">問題を画面で見る</span><span className="shortLabel">画面</span>
            </button>
            <button type="button" className={displayMode==='paper-overview'?'activeView':''}
              onClick={()=>changeDisplayMode(displayMode==='paper-overview'?'paper-focus':'paper-overview')}>
              <span className="wideLabel">{displayMode==='paper-overview'?'1問集中':'答案一覧'}</span>
              <span className="shortLabel">{displayMode==='paper-overview'?'1問':'一覧'}</span>
            </button>
          </>}
        </div>
        <button className="danger finishButton" disabled={busy} onClick={requestFinishExam}>{busy?'準備中…':'終了して採点'}</button>
      </header>

      {displayMode==='screen'&&<div className="examGrid">
        <section className={'viewer '+(viewerZoomed?'zoomed':'fit')}>
          <div className="viewerToolbar">
            <div className="pageNav">
              <button aria-label="前のページ" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>←</button>
              <b>{page}</b><span>/ {pageCount}</span>
              <button aria-label="次のページ" disabled={page>=pageCount} onClick={()=>setPage(p=>p+1)}>→</button>
            </div>
            <div className="viewerActions">
              <button className="zoomToggle" onClick={()=>setViewerZoomed(v=>!v)}>{viewerZoomed?'全体表示':'拡大'}</button>
              <button className="paperModeCta" type="button" onClick={()=>changeDisplayMode('paper-focus')}>
                紙で問題を見る <span>→ 解答欄を大きく</span>
              </button>
            </div>
          </div>
          <div className="pageCanvas">
            {pageSrc?<img src={pageSrc} alt={`問題 ${page}ページ`}/>:<div className="loading">読込中…</div>}
          </div>
        </section>

        <aside className="answerSheet">
          {sectionTabs}
          {questionNav}
          {activeQuestionPanel}
        </aside>
      </div>}

      {displayMode==='paper-focus'&&<section className="paperExamBody">
        <div className="paperFocusWorkspace">
          {paperCompactNav}
          {activeQuestionPanel}
        </div>
      </section>}

      {displayMode==='paper-overview'&&<section className="paperExamBody">
        <div className="paperOverviewWorkspace">
          {sectionTabs}
          <div className="paperOverviewHead">
            <div><div className="eyebrow">電子答案用紙</div><h2>大問{activeSection}　答案一覧</h2></div>
            <div><b>{answeredCount}</b><span>/ {qs.length} 回答</span></div>
          </div>
          <p className="paperOverviewNote">紙の問題冊子を見ながら回答状況を確認できます。入力・修正は各問をタップしてください。</p>
          <div className="paperAnswerList">
            {qs.map((item,i)=>{
              const state=answerState(item,answers);
              return <button type="button" key={item.id} className={'paperAnswerRow '+state} onClick={()=>{
                setQuestionAndPage(i);
                changeDisplayMode('paper-focus');
              }}>
                <span className="paperAnswerNumber">問{item.question}</span>
                <span className="paperAnswerValue">{compactAnswer(item)}</span>
                <span className={'answerBadge '+state}>{state==='done'?'回答済':state==='partial'?'途中':'未回答'}</span>
                <span className="paperAnswerChevron">›</span>
              </button>;
            })}
          </div>
        </div>
      </section>}

      {paperPeekOpen&&q&&<div className="paperPeekBackdrop" role="dialog" aria-modal="true" aria-label={`大問${activeSection} 問${q.question}の問題ページ`}>
        <div className="paperPeekModal">
          <div className="paperPeekBar">
            <div><b>大問{activeSection} 問{q.question}</b><span>原本ページを一時表示</span></div>
            <div className="paperPeekNav">
              <button type="button" aria-label="前のページ" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>←</button>
              <span>{page} / {pageCount}</span>
              <button type="button" aria-label="次のページ" disabled={page>=pageCount} onClick={()=>setPage(p=>p+1)}>→</button>
            </div>
            <button type="button" onClick={()=>setPaperPeekOpen(false)}>閉じる ×</button>
          </div>
          <div className="paperPeekCanvas">
            {pageSrc?<img src={pageSrc} alt={`大問${activeSection} 問${q.question}の掲載ページ`}/>:<div className="loading">読込中…</div>}
          </div>
        </div>
      </div>}
      {status&&<div className="toast">{status}</div>}
    </main>;
  }

  if(screen==='score'){
    const y=pManifest.years[String(year)],aq=aManifest?.years[String(year)];
    const ameta=aq?.answerPages?.find(x=>x.page===answerPage);
    const answerSrc=ameta?`./content/${version.contentVersion}/assets/${ameta.asset}`:'';
    return <main className="scoreShell">
      <header className="topbar"><div><h1>{examLabel(year)} 採点</h1>{NORMALIZED_SCORING&&<p>正答率は検証済みの親問を同じ重みで集計します。学校公式の配点ではありません。確認中の問題は採点・弱点判定から除外します。</p>}<p>選択問題は自動採点。記述などだけ手動で得点を入力してください。弱点分野は設問内容から自動で整理します。</p></div></header>
      <div className="scoreGrid">
        <section className="viewer answerViewer"><div className="pageControls">
          <button disabled={answerPage<=1} onClick={()=>setAnswerPage(p=>p-1)}>←</button>
          <span>模範解答 {answerPage} / {aq?.answerPages?.length||1}</span>
          <button disabled={answerPage>=(aq?.answerPages?.length||1)} onClick={()=>setAnswerPage(p=>p+1)}>→</button></div>
          {answerSrc?<img src={answerSrc} alt="模範解答"/>:aq?.review?<div className="schoolAnswerReferences">{y.questions.map(q=><AnswerReference key={q.id} question={q} record={aq.review[q.id]}/>)}</div>:<div className="loading">読込中…</div>}
        </section>
        <section className="grading">
          {y.questions.map(q=>{
            if(!isScorableQuestion(q,SCORING_POLICY)) return <div className="gradeRow" key={q.id}><b>大問{q.section} 問{q.question}</b><p>正答を確認中のため、採点と弱点判定の対象外です。</p></div>;
            const rule=aq?.grading?.[q.id],mixed=rule?.kind==='mixed',choiceRule=ruleForChoice(rule);
            const choiceRaw=mixed?(answers[`${q.id}#choice`]||''):(answers[q.id]||''),graded=rule?gradeChoice(choiceRule,choiceRaw):null;
            return <div className="gradeRow" key={q.id}>
              <div><b>大問{q.section} 問{q.question}</b><small>{q.topic}・{NORMALIZED_SCORING?'親問内の確認単位 ':''}{q.points}{NORMALIZED_SCORING?'':'点'}</small></div>
              <div className="ownAnswer">答案：{displayAnswer(answers[q.id],q.answerFormat)||'（未回答）'}{mixed&&<small>選択部分：{displayAnswer(answers[`${q.id}#choice`],q.answerFormat?.choice)||'（未回答）'}</small>}</div>
              {mixed?<><div className={'autoGrade '+(graded?.correct?'ok':'ng')}>選択部分：<b>{graded?.score??0} / {choiceRule.points.reduce((a,b)=>a+b,0)}</b><small>正解：{formatCorrectAnswer(choiceRule)}</small></div>
                <label>記述部分<input type="number" min="0" step={NORMALIZED_SCORING?"any":"1"} max={rule.manualPoints} value={scores[q.id]??''} onChange={e=>updateScore(q.id,e.target.value===''?'':Math.max(0,Math.min(rule.manualPoints,Number(e.target.value))))}/>/ {rule.manualPoints}</label></>
              :rule?<div className={'autoGrade '+(graded?.correct?'ok':'ng')}>自動採点：<b>{graded?.score??0} / {q.points}</b><small>正解：{formatCorrectAnswer(rule)}</small></div>
              :<label>得点<input type="number" min="0" step={NORMALIZED_SCORING?"any":"1"} max={q.points} value={scores[q.id]??''} onChange={e=>updateScore(q.id,e.target.value===''?'':Math.max(0,Math.min(q.points,Number(e.target.value))))}/>/ {q.points}</label>}
            </div>
          })}
          <button className="primary" disabled={busy} onClick={finalizeScore}>{busy?'保存中…':'採点を確定して端末に保存'}</button>
        </section>
      </div>{status&&<div className="toast">{status}</div>}
    </main>
  }

  if(screen==='result'){
    const latest=lastResult||[...events].filter(e=>e.type==='exam_completed'&&sameExamKey(eventExamKey(e),year)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    const total=latest?.totalScore??0;
    const resultPlan=repairPlanForYear(events,eventExamKey(latest)??year);
    const resultMistakes=(latest?.questionResults||[]).filter(r=>Number(r.score||0)<Number(r.points||0)).map(r=>{
      const q=pManifest?.years?.[String(year)]?.questions?.find(x=>x.id===r.id)||r;
      const rule=aManifest?.years?.[String(year)]?.grading?.[r.id];
      const ex=buildReviewExplanation({question:q,result:{...r,year},rule,totalScore:total,review:aManifest?.years?.[String(year)]?.review?.[r.id]});
      const type=ex.type||'';
      const efficiency=/漢字|語彙|現代仮名遣い|古文・主語人物|語句・文脈/.test(type)?0:
        (/記述|文完成/.test(type)&&Number(r.points||0)>=10?2:1);
      return {r,q,rule,ex,efficiency,shownPriority:priorityForResult(resultPlan,r,ex.priority)};
    }).sort((a,b)=>PRIORITY_RANK[a.shownPriority]-PRIORITY_RANK[b.shownPriority]||a.efficiency-b.efficiency||b.ex.loss-a.ex.loss);
    const firstFixes=resultMistakes.slice(0,3);
    const laterFixes=resultMistakes.slice(3);
    return <main className="shell"><section className="resultHero"><div className="eyebrow">{examLabel(year)}</div><h1>{total}<small>{NORMALIZED_SCORING?"%":"/100"}</small></h1>{NORMALIZED_SCORING&&<p>検証済み{latest?.scoredParentCount}問で算出した学習用正答率（学校公式配点ではありません）。確認中の除外問題：{latest?.excludedQuestions?.length||0}問。</p>}
      {[TARGET_MIN,TARGET_STABLE,TARGET_STRETCH].map(target=><p key={target}>{total>=target?`${target}${NORMALIZED_SCORING?'%':'点'}目標に ${Math.round((total-target)*10)/10}${NORMALIZED_SCORING?'ポイント':'点'}の余裕`:`${target}${NORMALIZED_SCORING?'%':'点'}まであと ${Math.round((target-total)*10)/10}${NORMALIZED_SCORING?'ポイント':'点'}`}</p>)}</section>
      <section className="card resultPriority"><h2>復習優先度</h2>
        <PriorityStrategyLegend/>
        {(()=>{
          const plan=resultPlan;
          const domains=aggregateDomainPriorities(plan.all),top=domains.slice(0,3),rest=domains.slice(3);
          return <>
            <p className="weaknessCountLine">今回見つかった関連分野：<b>{domains.length}</b>／おすすめ：<b>{top.length}</b></p>
            <div className="priorityList">{top.map(p=><div className="priorityItem hasAction" key={p.key}><span className={'priorityBadge p'+p.priority}>{p.priority}</span><div><b>{drillDomainLabel(p.key)}</b><small>{p.why}</small></div><button type="button" className="smallDrillLink" onClick={()=>openDrillLibrary(p.sourceSkills[0])}>類題を見る</button></div>)}</div>
            {!!rest.length&&<details className="allWeaknesses"><summary>ほかの関連分野も確認する（{rest.length}件）</summary>
              <div className="priorityList">{rest.map(p=><div className="priorityItem hasAction" key={p.key}><span className={'priorityBadge p'+p.priority}>{p.priority}</span><div><b>{drillDomainLabel(p.key)}</b><small>{p.why}</small></div><button type="button" className="smallDrillLink" onClick={()=>openDrillLibrary(p.sourceSkills[0])}>類題を見る</button></div>)}</div>
            </details>}
          </>;
        })()}
      </section>
      <section className="card mistakeReviewPanel"><div className="eyebrow">PAST PAPER REVIEW</div><h2>間違えた問題の解説</h2>
        <p>正答を見るだけで終わらず、「本文のどこを見るか → 自分のずれ → 次回の手順」まで確認します。</p>
        {resultMistakes.length
          ?<>
            <div className="firstFixes">
              <h3>次回{TARGET_MIN}点を割らないために、まず直す{firstFixes.length}問</h3>
              <p className="firstFixNote">総得点だけでA判定にせず、漢字・語彙・古文基本などの得点効率と失点量を優先して並べています。</p>
              <div className="mistakeReviewList">{firstFixes.map(({r,q,rule,shownPriority})=>
                <ReviewCard key={r.id} q={q} result={{...r,year}} rule={rule} review={aManifest?.years?.[String(year)]?.review?.[r.id]} totalScore={total} pManifest={pManifest} version={version} openByDefault={true} priorityOverride={shownPriority}/>
              )}</div>
            </div>
            {!!laterFixes.length&&<details className="laterFixes"><summary>その後に確認するB/C/D問題（{laterFixes.length}問）</summary>
              <div className="mistakeReviewList">{laterFixes.map(({r,q,rule,shownPriority})=>
                <ReviewCard key={r.id} q={q} result={{...r,year}} rule={rule} review={aManifest?.years?.[String(year)]?.review?.[r.id]} totalScore={total} pManifest={pManifest} version={version} priorityOverride={shownPriority}/>
              )}</div>
            </details>}
          </>
          :<p className="allCorrectReview">この年度は失点問題がありません。</p>}
      </section>
      <button className="primary" onClick={returnHome}>ホームへ戻る</button>{status&&<div className="toast">{status}</div>}</main>
  }
  return null;
}
createRoot(document.getElementById('root')).render(<App/>);

