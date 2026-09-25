"""Report actual inventory without mistaking unit tags for verified skill coverage."""
import json
from pathlib import Path
from collections import Counter,defaultdict
ROOT=Path(__file__).resolve().parents[1]
bank=json.loads((ROOT/'metadata/practice_bank.json').read_text())
registry=json.loads((ROOT/'metadata/structural_registry.json').read_text())
observed=Counter(s for exam in registry['exams'] for section in exam['sections'] for q in section.get('questions',[]) for s in q['skillDemand'])
tagged=defaultdict(Counter);formats=defaultdict(Counter)
for unit in bank['units']:
 for item in unit['items']:
  formats[item['responseType']][item['phase']]+=1
  for skill in item['skills']:tagged[skill][item['phase']]+=1
out={'schemaVersion':1,'status':'REVIEWED_CORE_SKILLS_WITH_DOCUMENTED_LIMITS','unitCount':len(bank['units']),'itemCount':sum(len(u['items']) for u in bank['units']),
 'interpretation':'Declared unit tags are an inventory only. They do not certify that each item exercises each tagged skill, nor that drill progression can be completed without repetition.',
 'observedSourceDemands':dict(sorted(observed.items())),
 'declaredTagPhaseCounts':dict(sorted(tagged.items())),
 'actualResponseFormatPhaseCounts':dict(sorted(formats.items())),
 'demandsWithoutDirectTag':sorted(set(observed)-set(tagged)),
 'coverageReview':'docs/practice-coverage-review.md',
 'remainingGates':['Two consecutive release CLEAN loops'],
 'limitations':['No distinct practice for every fine-grained source tag','No measured admission or score-improvement outcome','Some retention strands reuse a reserved item on later days']}
(ROOT/'metadata/practice_readiness.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(f"Practice coverage inventory: {out['unitCount']} units / {out['itemCount']} items; {len(out['demandsWithoutDirectTag'])} detailed demand tags require explicit coverage review")
