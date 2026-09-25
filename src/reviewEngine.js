import {requireScoreTargets} from './scoreStrategy.js';
export function reviewPriority(totalScore,loss,profile=null,scoreTargets){
  const [targetMin,targetStable,targetStretch]=requireScoreTargets(scoreTargets);
  if(loss<=0) return 'D';
  const t=profile?.type||'';
  const efficient=/漢字|語彙|現代仮名遣い|古文・主語人物|語句・文脈/.test(t);
  const costly=/記述|文完成/.test(t)&&loss>=8;
  if(Number(totalScore)<targetMin){
    if(efficient) return 'A';
    if(costly) return 'D';
    return 'B';
  }
  if(Number(totalScore)<targetStable) return efficient?'B':'C';
  if(Number(totalScore)<targetStretch) return 'C';
  return 'D';
}

