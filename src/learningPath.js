import {pendingRetention} from './retention.js';
import {getReviewProfile} from './reviewProfiles.js';
import {LEARNING_PATH_CONFIG} from './schoolLearningConfig.js';
import {requireScoreTargets} from './scoreStrategy.js';

const OLD_YEARS=LEARNING_PATH_CONFIG.bridgeCandidates;
const ACTIVE_REPAIR_SIZE=3;
const PRIORITY_RANK={A:0,B:1,C:2,D:3};
const [TARGET_MIN,TARGET_STABLE,TARGET_STRETCH]=requireScoreTargets(LEARNING_PATH_CONFIG.scoreTargets);

export const DEFAULT_REPAIR_SKILLS=['選択肢処理','記述要素不足','古文の主語・人物関係'];

function isoCmp(a,b){return String(a||'').localeCompare(String(b||''));}
function sameExamKey(a,b){return String(a??'')===String(b??'');}
function eventExamKey(e){return e?.examId??e?.year;}
function canonicalExamKey(key){
  return (LEARNING_PATH_CONFIG.examKeys||[]).find(x=>sameExamKey(x,key))??key;
}
function examLabel(key){return LEARNING_PATH_CONFIG.examLabels?.[String(key)]||(String(key)+'年度');}

export function firstExam(events,year){
  return (events||[])
    .filter(e=>e?.type==='exam_completed'&&e.attempt==='first'&&sameExamKey(eventExamKey(e),year))
    .sort((a,b)=>isoCmp(a.createdAt,b.createdAt))[0]||null;
}

function canonicalFirstExams(events){
  const keys=[];
  for(const e of (events||[]).filter(e=>e?.type==='exam_completed'&&e.attempt==='first')){
    const key=canonicalExamKey(eventExamKey(e));
    if(key!==undefined&&key!==null&&!keys.some(x=>sameExamKey(x,key))) keys.push(key);
  }
  return keys.map(key=>firstExam(events,key)).filter(Boolean)
    .sort((a,b)=>isoCmp(a.createdAt,b.createdAt));
}

export function completedFirstYears(events){
  return new Set(canonicalFirstExams(events).map(e=>canonicalExamKey(eventExamKey(e))));
}

export function inferCause(q){
  const profile=getReviewProfile(q?.id);
  if(profile?.repairSkill)return profile.repairSkill;
  const t=String(profile?.type||'');
  // 旧履歴では自動採点の誤答が一律「選択肢処理」になっていた。
  // そのまま学習ルートに使わず、現在の設問profileで安全に再分類する。
  const stored=String(q?.reason||'');
  if(stored && stored!=='選択肢処理') return stored;
  if(/漢字|語彙|現代仮名遣い|知識・短答/.test(t)) return '知識不足';
  if(t==='古文・主語人物') return '古文の主語・人物関係';
  if(t==='文学・心情') return '心情';
  if(/記述|文完成/.test(t)) return '記述要素不足';
  if(/複数選択|並べ替え/.test(t)) return '選択肢処理';
  if(profile) return '本文根拠不足';
  if(stored) return stored;
  const topic=String(q?.topic||'');
  if(topic.includes('古文')) return '古文の主語・人物関係';
  if(q?.hasAutoSelection||q?.autoGradable||q?.mixedAutoGraded) return '選択肢処理';
  if(Number(q?.points||0)>=8) return '記述要素不足';
  return '本文根拠不足';
}


export function reviewPrioritiesForEvents(events){
  const completed=canonicalFirstExams(events)
    .sort((a,b)=>isoCmp(b.createdAt,a.createdAt))
    .slice(0,3);
  if(!completed.length) return [];
  const latestTotal=Number(completed[0].totalScore||0), stats=new Map();
  for(const e of completed){
    for(const q of (e.questionResults||[])){
      const loss=Math.max(0,Number(q.points||0)-Number(q.score||0));
      if(!loss) continue;
      const key=inferCause(q);
      const cur=stats.get(key)||{
        key,misses:0,lostPoints:0,maxQuestionPoints:0,
        simpleChoiceMisses:0,complexChoiceMisses:0,manualMisses:0,
        questionIds:[],topics:new Set()
      };
      const kind=q.answerFormat?.kind;
      const simple=q.autoGradable&&['single','parts'].includes(kind);
      const complex=q.autoGradable&&['set','order'].includes(kind);
      cur.misses++; cur.lostPoints+=loss; cur.maxQuestionPoints=Math.max(cur.maxQuestionPoints,Number(q.points||0));
      if(simple) cur.simpleChoiceMisses++; else if(complex) cur.complexChoiceMisses++; else cur.manualMisses++;
      if(q.id&&!cur.questionIds.includes(q.id)) cur.questionIds.push(q.id);
      if(q.topic) cur.topics.add(q.topic);
      stats.set(key,cur);
    }
  }
  return [...stats.values()].map(s=>{
    const repeated=s.misses>=2, onlyComplex=s.complexChoiceMisses>0&&!s.simpleChoiceMisses&&!s.manualMisses;
    const hasSimple=s.simpleChoiceMisses>0, highManualOnly=s.manualMisses===s.misses&&s.manualMisses>0&&s.maxQuestionPoints>=10;
    let priority='C',why=`一度の失点。${TARGET_STABLE}〜${TARGET_STRETCH}点への上積み候補。`;
    if(latestTotal<TARGET_MIN){
      // 60点未満では「繰り返したか」より得点効率を優先する。
      // 高コスト記述や複数選択を、再発だけを理由にAへ持ち上げない。
      if(hasSimple){priority='A';why=`${TARGET_MIN}点未満のため、得点効率の高い基本的な選択問題を最優先。`;}
      else if(highManualOnly){priority='D';why=`${TARGET_MIN}点確保前は高コストの記述を深追いしない。`;}
      else if(onlyComplex){priority='C';why=`複数選択・並べ替えは、まず基本問題で${TARGET_MIN}点を確保してから。`;}
      else if(repeated){priority='A';why=`直近3回の初見で関連分野の失点が${s.misses}回。基本問題での再発防止を最優先。`;}
      else{priority='B';why=`${TARGET_MIN}点確保後、${TARGET_STABLE}点へ上積みする候補。`;}
    }else if(highManualOnly){
      if(latestTotal<TARGET_STABLE){priority='C';why=`${TARGET_MIN}〜${TARGET_STABLE-1}点では高コスト記述を必須にせず、先にB問題を安定させる。`;}
      else if(latestTotal<TARGET_STRETCH){priority='C';why=`${TARGET_STABLE}〜${TARGET_STRETCH}点への任意上積み。必要時間と再現性を見て取り組む。`;}
      else{priority='D';why=`${TARGET_STRETCH}点水準では高コスト記述を現段階で深追いしない。`;}
    }else if(onlyComplex){
      if(latestTotal<TARGET_STABLE){priority='B';why=`${TARGET_MIN}点確保後、${TARGET_STABLE}点を安定させる複数選択・並べ替えの補強。`;}
      else if(latestTotal<TARGET_STRETCH){priority='C';why=`${TARGET_STABLE}〜${TARGET_STRETCH}点への任意上積みとして複数選択・並べ替えを補強する。`;}
      else{priority='D';why=`${TARGET_STRETCH}点水準では複雑な選択問題を現段階で深追いしない。`;}
    }else if(repeated){priority='A';why=`直近3回の初見で関連分野の失点が${s.misses}回。再発防止を最優先。`;}
    else if(latestTotal<TARGET_STABLE){
      priority=hasSimple?'B':'C'; why=hasSimple?`${TARGET_STABLE}点へ上げやすい選択問題の失点。`:'B項目の後に復習する上積み候補。';
    }else if(latestTotal<TARGET_STRETCH){priority='C';why=`${TARGET_STABLE}点台を${TARGET_STRETCH}点前後へ伸ばす上積み候補。`;}
    else{priority='D';why=`${TARGET_STRETCH}点水準では一度だけの失点は現段階で深追いしない。`;}
    return {...s,topics:[...s.topics],priority,why};
  }).sort((a,b)=>PRIORITY_RANK[a.priority]-PRIORITY_RANK[b.priority]||b.misses-a.misses||b.lostPoints-a.lostPoints||a.key.localeCompare(b.key,'ja'));
}

export function weaknessListForEvent(event){
  const map=new Map();
  for(const q of event?.questionResults||[]){
    const loss=Math.max(0,Number(q.points||0)-Number(q.score||0));
    if(!loss) continue;
    const cause=inferCause(q);
    const cur=map.get(cause)||{skill:cause,lostPoints:0,misses:0};
    cur.lostPoints+=loss; cur.misses+=1; map.set(cause,cur);
  }
  return [...map.values()].sort((a,b)=>b.lostPoints-a.lostPoints||b.misses-a.misses||a.skill.localeCompare(b.skill,'ja'));
}

export function repairSkillsForYear(events,year){
  const exam=firstExam(events,year);
  if(!exam) return DEFAULT_REPAIR_SKILLS.slice(0,3);
  // 診断は全網羅。発見した弱点は優先度にかかわらず全件保持する。
  return weaknessListForEvent(exam).map(x=>x.skill);
}

function prioritiesForSourceYear(events,year){
  const exam=firstExam(events,year);
  if(!exam) return [];
  // 後年の結果で過去年度の学習優先度が勝手に変わらないよう、
  // その年度の初見終了時点までの履歴だけでA/B/C/Dを決める。
  const scoped=(events||[]).filter(e=>isoCmp(e?.createdAt,exam.createdAt)<=0);
  return reviewPrioritiesForEvents(scoped);
}

export function repairPlanForYear(events,year){
  const all=repairSkillsForYear(events,year);
  const priorityRows=prioritiesForSourceYear(events,year);
  const bySkill=new Map(priorityRows.map(p=>[p.key,p]));
  const rows=all.map((skill,index)=>{
    const p=bySkill.get(skill)||{key:skill,priority:'B',why:`今回の失点原因として保存し、${TARGET_STABLE}点への補強候補にします。`};
    return {...p,key:skill,index};
  }).sort((a,b)=>PRIORITY_RANK[a.priority]-PRIORITY_RANK[b.priority]||a.index-b.index);
  const repaired=new Set(repairedSkillsForYear(events,year));
  const required=rows.filter(r=>r.priority==='A'||r.priority==='B');
  const optional=rows.filter(r=>r.priority==='C');
  const deferred=rows.filter(r=>r.priority==='D');
  const pendingRequired=required.filter(r=>!repaired.has(r.key));
  const pendingOptional=optional.filter(r=>!repaired.has(r.key));
  const pendingDeferred=deferred.filter(r=>!repaired.has(r.key));
  return {
    all:rows,required,optional,deferred,
    repaired:[...repaired],
    pendingRequired,pendingOptional,pendingDeferred,
    active:pendingRequired.slice(0,ACTIVE_REPAIR_SIZE)
  };
}

function repairSkillsFromEvent(events,repair){
  if(Array.isArray(repair?.skills)&&repair.skills.length) return [...new Set(repair.skills)];
  // v1.1.3以前の repair event は skills を持たない場合がある。
  // 旧イベントは当時の「年度弱点を一括補強した」意味を保ち、破壊的な履歴変換をしない。
  const source=firstExam(events,repair?.sourceExamId??repair?.sourceYear);
  return weaknessListForEvent(source).map(x=>x.skill);
}

export function repairedSkillsForYear(events,year){
  const exam=firstExam(events,year);
  if(!exam) return [];
  const repaired=new Set();
  for(const r of (events||[])
    .filter(e=>e?.type==='repair_block_completed'&&e.passed===true&&sameExamKey(e.sourceExamId??e.sourceYear,year))
    .filter(e=>isoCmp(e.createdAt,exam.createdAt)>0)
    .sort((a,b)=>isoCmp(a.createdAt,b.createdAt))){
    for(const skill of repairSkillsFromEvent(events,r)) repaired.add(skill);
  }
  return repairSkillsForYear(events,year).filter(skill=>repaired.has(skill));
}

export function pendingRepairSkillsForYear(events,year){
  // 学習ルートを止めるのはA/Bのみ。C/Dも診断・保存はするが強制しない。
  return repairPlanForYear(events,year).pendingRequired.map(r=>r.key);
}

export function nextRepairSkillsForYear(events,year){
  // 「3つ」は表示・着手単位であり、補強上限ではない。終わるたび次のA/Bが繰り上がる。
  return repairPlanForYear(events,year).active.map(r=>r.key);
}

export function weaknessLedger(events){
  const firstExams=canonicalFirstExams(events);
  const repairs=(events||[])
    .filter(e=>e?.type==='repair_block_completed'&&e.passed===true)
    .sort((a,b)=>isoCmp(a.createdAt,b.createdAt));
  const discovered=new Map();

  for(const exam of firstExams){
    for(const w of weaknessListForEvent(exam)){
      const cur=discovered.get(w.skill)||{
        skill:w.skill,misses:0,lostPoints:0,years:[],firstSeenAt:exam.createdAt,lastSeenAt:exam.createdAt
      };
      cur.misses+=w.misses; cur.lostPoints+=w.lostPoints;
      const examKey=canonicalExamKey(eventExamKey(exam)); if(!cur.years.some(x=>sameExamKey(x,examKey))) cur.years.push(examKey);
      cur.lastSeenAt=exam.createdAt;
      discovered.set(w.skill,cur);
    }
  }

  return [...discovered.values()].map(item=>{
    const relatedRepairs=repairs.filter(r=>repairSkillsFromEvent(events,r).includes(item.skill));
    const latestRepair=relatedRepairs.at(-1)||null;
    const examsAfterRepair=latestRepair
      ?firstExams.filter(e=>isoCmp(e.createdAt,latestRepair.createdAt)>0)
      :[];
    const recurrence=latestRepair
      ?examsAfterRepair.find(e=>weaknessListForEvent(e).some(w=>w.skill===item.skill))
      :null;
    const clearYears=latestRepair&&!recurrence
      ?examsAfterRepair.filter(e=>!weaknessListForEvent(e).some(w=>w.skill===item.skill)).length
      :0;

    let status='未補強';
    if(latestRepair){
      if(recurrence) status='再補強';
      else if(clearYears>=2) status='定着済み';
      else status='定着確認中';
    }
    return {
      ...item,status,clearYears,
      latestRepairAt:latestRepair?.createdAt||null,
      recurrenceYear:recurrence?canonicalExamKey(eventExamKey(recurrence)):null
    };
  }).sort((a,b)=>{
    const rank={'再補強':0,'未補強':1,'定着確認中':2,'定着済み':3};
    return rank[a.status]-rank[b.status]||b.misses-a.misses||b.lostPoints-a.lostPoints||a.skill.localeCompare(b.skill,'ja');
  });
}

export function passedRepair(events,year){
  const exam=firstExam(events,year);
  if(!exam) return false;
  // 満点等で失点がない年度は、修理すべき弱点がないので自動通過。
  if(weaknessListForEvent(exam).length===0) return true;
  // A/Bは原則すべて補強してから次年度へ進む。
  // Cは70〜75点への上積み、Dは現段階では後回しとして保存するが、学習ルートは止めない。
  return pendingRepairSkillsForYear(events,year).length===0;
}

function dominantSkill(events,year){
  return repairSkillsForYear(events,year)[0]||'選択肢処理';
}

export function bridgeYear(events){
  const diagnostic=LEARNING_PATH_CONFIG.diagnosticExamKey;
  const skill=dominantSkill(events,diagnostic);
  return LEARNING_PATH_CONFIG.bridgeSkillExamKey?.[skill]??LEARNING_PATH_CONFIG.bridgeDefaultExamKey;
}

const OLD_FIT=LEARNING_PATH_CONFIG.oldFit||{};

function aggregateRecentWeakness(events){
  const exams=(events||[]).filter(e=>e?.type==='exam_completed'&&e.attempt==='first')
    .sort((a,b)=>isoCmp(b.createdAt,a.createdAt)).slice(0,3);
  const scores=new Map();
  for(const e of exams) for(const w of weaknessListForEvent(e)){
    scores.set(w.skill,(scores.get(w.skill)||0)+w.lostPoints);
  }
  return scores;
}

export function recommendRemainingOldYear(events,candidates){
  const weakness=aggregateRecentWeakness(events);
  return [...candidates].sort((a,b)=>{
    const sa=[...weakness].reduce((sum,[skill,loss])=>sum+(OLD_FIT[a]?.[skill]||0)*loss,0);
    const sb=[...weakness].reduce((sum,[skill,loss])=>sum+(OLD_FIT[b]?.[skill]||0)*loss,0);
    const tie=LEARNING_PATH_CONFIG.oldTieBreak||[]; return sb-sa||tie.findIndex(x=>sameExamKey(x,a))-tie.findIndex(x=>sameExamKey(x,b));
  })[0];
}

function repairStep(events,year,label='弱点修正'){
  const plan=repairPlanForYear(events,year);
  const skills=plan.active.map(r=>r.key);
  const requiredDone=plan.required.length-plan.pendingRequired.length;
  return {
    type:'repair',sourceYear:year,skills,
    title:`${examLabel(year)}の${label}`,
    why:`弱点${plan.all.length}件をすべて記録しています。A/Bは${plan.required.length}件を順番に補強し、今は最優先${skills.length}件に集中します${requiredDone?`（A/B ${requiredDone}/${plan.required.length}件完了）`:''}。Cは上積み、Dは現段階では後回しです。`
  };
}

function examStep(year,title,why){
  return {type:'exam',year,title,why};
}

export function getGuidedStep(events){
  const done=completedFirstYears(events),cfg=LEARNING_PATH_CONFIG,labels=cfg.labels||{},route=cfg.route||{};
  const diagnostic=cfg.diagnosticExamKey;
  if(![...done].some(x=>sameExamKey(x,diagnostic))) return examStep(diagnostic,labels.diagnosticTitle,labels.diagnosticWhy);

  if(cfg.requireRemediation===true){
    for(const key of cfg.courseExamKeys||cfg.examKeys||[]){
      if(!firstExam(events,key)||sameExamKey(key,route.finalExamKey))continue;
      if(!passedRepair(events,key))return repairStep(events,key);
      const pending=pendingRetention(events,key);
      if(pending.length)return {type:'retention',sourceYear:key,skills:pending.map(x=>x.skill),pending,
        title:'翌日の定着確認',why:'補強を終えてから24時間以上あけ、別の問題で同じ読み方を使えるか確かめます。'};
    }
  }
  const bridge=bridgeYear(events);
  if(bridge!=null&&![...done].some(x=>sameExamKey(x,bridge))){
    return examStep(bridge,labels.bridgeTitle,`${examLabel(diagnostic)}で見つかった弱点に関連する力を、${examLabel(bridge)}の過去問全体で確認します。弱点練習を続けながら、次の試験にも自由に進めます。`);
  }

  if(route.recentCheck1!=null&&![...done].some(x=>sameExamKey(x,route.recentCheck1))) return examStep(route.recentCheck1,labels.recent1Title,labels.recent1Why);

  const remaining=OLD_YEARS.filter(y=>!sameExamKey(y,bridge));
  const candidates=remaining.filter(y=>![...done].some(x=>sameExamKey(x,y)));
  if(candidates.length){
    const y=recommendRemainingOldYear(events,candidates);
    return examStep(y,`${labels.oldTitle} ${remaining.length-candidates.length+1}/${remaining.length}`,labels.oldWhy);
  }

  if(route.recentCheck2!=null&&![...done].some(x=>sameExamKey(x,route.recentCheck2))) return examStep(route.recentCheck2,labels.recent2Title,labels.recent2Why);
  if(route.loadCheck!=null&&![...done].some(x=>sameExamKey(x,route.loadCheck))) return examStep(route.loadCheck,labels.loadTitle,labels.loadWhy);
  if(route.finalExamKey!=null&&![...done].some(x=>sameExamKey(x,route.finalExamKey))) return examStep(route.finalExamKey,labels.finalTitle,labels.finalWhy);
  return {type:'complete',title:labels.completeTitle,why:labels.completeWhy};
}

export function courseProgress(events){
  const done=completedFirstYears(events),keys=LEARNING_PATH_CONFIG.courseExamKeys||LEARNING_PATH_CONFIG.examKeys||[];
  const has=key=>[...done].some(x=>sameExamKey(x,key));
  const examDone=keys.filter(has).length;
  const repairDone=keys.filter(y=>has(y)&&passedRepair(events,y)).length;
  return {done:examDone,total:keys.length,examDone,repairDone};
}

export function courseRouteLabels(events){
  const done=completedFirstYears(events),cfg=LEARNING_PATH_CONFIG,route=cfg.route||{};
  const diagnostic=cfg.diagnosticExamKey;
  const bridge=firstExam(events,diagnostic)?bridgeYear(events):null;
  const b=bridge??cfg.bridgeDefaultExamKey;
  const rows=[
    [diagnostic,`${diagnostic} 診断・全問`],
    [b,`${b} 別試験確認・全問`],
    [route.recentCheck1,`${route.recentCheck1} 近年①・全問`],
    ...OLD_YEARS.filter(y=>!sameExamKey(y,b)).map(y=>[y,`${y} 横断確認・全問`]),
    [route.recentCheck2,`${route.recentCheck2} 近年②・全問`],
    [route.loadCheck,`${route.loadCheck} 負荷確認・全問`],
    [route.finalExamKey,`${route.finalExamKey} FINAL・全問`]
  ].filter(([key])=>key!==undefined&&key!==null);
  return rows.map(([year,label])=>({year,label,done:[...done].some(x=>sameExamKey(x,year))}));
}

