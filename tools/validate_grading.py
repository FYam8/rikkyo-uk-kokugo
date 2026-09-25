import json
from pathlib import Path
r=Path(__file__).resolve().parents[1];m=json.loads((r/'public/content/current.json').read_text());c=r/'public/content'/m['contentVersion'];pm=json.loads((c/m['problemManifest']).read_text());count=0
for key,filename in m['answerManifests'].items():
 a=json.loads((c/filename).read_text());assert list(a['years'])==[key];a=a['years'][key]
 for q in pm['years'][key]['questions']:
  rule=a['grading'].get(q['id']);review=a['review'].get(q['id'])
  if q['answerAuthority']!='APP_DERIVED_VERIFIED':assert rule is None and review is None;continue
  count+=1;assert review['official'] is False and review['state']=='APP_DERIVED_VERIFIED'
  if rule:
   assert abs(sum(rule['points'])-q['points'])<1e-9
   assert len(rule['points'])==len(rule['answers'])
   if rule['kind'] in ['single','parts','set','order']:assert set(rule['answers'])<=set(rule['tokens'])
assert count==141
assert not any(k in (c/m['problemManifest']).read_text() for k in ['modelAnswer','sourceEvidence','checks','candidateSource'])
print('141 verified references; unverified excluded; answers separated from problem manifest: PASS')
