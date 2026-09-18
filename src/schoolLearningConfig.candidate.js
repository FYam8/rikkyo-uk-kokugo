export const LEARNING_PATH_CONFIG=Object.freeze({
  schemaVersion:1,
  examKeys:['FY24-A','FY24-B','FY25-A','FY25-B','FY26-A','FY26-B'],
  examUnitNoun:'試験',
  features:{kobunPractice:false},
  examLabels:{
    'FY24-A':'FY24 A日程','FY24-B':'FY24 B日程',
    'FY25-A':'FY25 A日程','FY25-B':'FY25 B日程',
    'FY26-A':'FY26 A日程','FY26-B':'FY26 B日程'
  },
  diagnosticExamKey:'FY25-A',
  bridgeCandidates:['FY24-A'],
  bridgeDefaultExamKey:'FY24-A',
  bridgeSkillExamKey:{},
  oldFit:{'FY24-A':{}},
  oldTieBreak:['FY24-A'],
  route:{
    recentCheck1:'FY25-B',
    recentCheck2:'FY26-A',
    loadCheck:null,
    finalExamKey:'FY26-B'
  },
  // 60 is grounded in the school's FAQ guidance (~60% correct on past papers).
  // 70/75 are app-authored buffer/stretch targets, not school-official cutoffs.
  scoreTargets:[60,70,75],
  reserveExamKeys:['FY26-A','FY26-B'],
  labels:{
    diagnosticTitle:'STAGE 1｜初期診断',
    diagnosticWhy:'漢字・文学・説明の3領域が参照できる試験で、設問要求別の弱点を確認します。',
    bridgeTitle:'STAGE 2｜別形式で確認',
    recent1Title:'STAGE 3｜B日程で確認',
    recent1Why:'同じ共通エンジンで、B日程でも修正した読み方が通用するか確認します。',
    oldTitle:'STAGE 4｜年度横断確認',
    oldWhy:'大問順や形式が変わっても同じ解法を使えるか確認します。',
    recent2Title:'STAGE 5｜近年A日程',
    recent2Why:'近年のA日程で設問要求別の弱点が残っていないか確認します。',
    loadTitle:'STAGE 6｜負荷確認',
    loadWhy:'必要な場合だけ追加確認します。',
    finalTitle:'FINAL｜最終未見確認',
    finalWhy:'FY26 B日程を最後まで未見で残し、総合確認に使います。',
    completeTitle:'参照可能な過去問ルートを完了',
    completeWhy:'参照可能な過去問ルートを完了しました。残る弱点は類題で補強します。'
  }
});
