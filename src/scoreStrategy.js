export function requireScoreTargets(value){
  if(!Array.isArray(value)||value.length!==3) throw new Error('school scoreTargets must be an explicit three-number array');
  const nums=value.map(Number);
  if(nums.some(n=>!Number.isFinite(n))) throw new Error('school scoreTargets must contain finite numbers');
  const [min,stable,stretch]=nums;
  if(!(0<=min&&min<stable&&stable<stretch)) throw new Error('school scoreTargets must be strictly increasing non-negative numbers');
  return nums;
}

