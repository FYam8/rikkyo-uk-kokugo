export const LEARNING_PATH_CONFIG=Object.freeze({
  schemaVersion:1,
  examKeys:['FY25-A','FY25-B'],
  examUnitNoun:'試験',
  features:{kobunPractice:false},
  examLabels:{'FY25-A':'FY25 A日程','FY25-B':'FY25 B日程'},
  diagnosticExamKey:'FY25-A',
  bridgeCandidates:[],
  bridgeDefaultExamKey:null,
  bridgeSkillExamKey:{},
  oldFit:{},
  oldTieBreak:[],
  route:{recentCheck1:'FY25-B',recentCheck2:null,loadCheck:null,finalExamKey:null},
  // 60: official FAQ guidance (~60% correct on past papers as a passing guide).
  // 70/75: app-authored buffer/stretch targets, not school-official cutoffs.
  scoreTargets:[60,70,75],
  reserveExamKeys:[],
  labels:{
    diagnosticTitle:'STAGE 1｜FY25 A日程で初期診断',
    diagnosticWhy:'正答Authorityを二重検証済みのFY25 A日程で、設問要求別の弱点を確認します。',
    bridgeTitle:'',recent1Title:'STAGE 2｜FY25 B日程で再確認',recent1Why:'A日程で見つかった弱点が、同じ年度のB日程でも再発しないか確認します。',oldTitle:'',oldWhy:'',
    recent2Title:'',recent2Why:'',loadTitle:'',loadWhy:'',finalTitle:'',finalWhy:'',
    completeTitle:'FY25 A/B日程の確認完了',
    completeWhy:'現在、採点Authorityを二重検証済みのFY25 A/B日程を完了しました。弱点補強を続けながら、他年度は検証完了後に追加されます。'
  }
});
