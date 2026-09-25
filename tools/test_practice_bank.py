import json
from collections import Counter
from pathlib import Path
r=Path(__file__).resolve().parents[1]
b=json.loads((r/'metadata/practice_bank.json').read_text())
assert b['origin']=='NEW_APP_AUTHORED_NOT_RECOVERED'
assert b['referenceBankRecovered'] is False
assert b['holdoutSourceUsed'] is False
assert b['unitCount']==len(b['units'])==24
assert Counter(u['domain'] for u in b['units'])=={'kanji':10,'literary':7,'expository':7}
ids=[];formats=set()
for u in b['units']:
 assert u['pastPaperSourceIds']==[]
 assert u['skills'] and u['title']
 assert len(u['items'])==7
 assert Counter(i['phase'] for i in u['items'])=={'basic':2,'transfer':3,'mixed':1,'retention':1}
 for i in u['items']:
  ids.append(i['id']);formats.add(i['responseType'])
  assert i['passage'] and i['prompt'] and i['explanation']
  assert i['skills']==u['skills']
  if 'options' in i:
   allowed={o['id'] for o in i['options']}
   assert len(allowed)==len(i['options'])
   answer=i['answer'] if isinstance(i['answer'],list) else [i['answer']]
   assert set(answer)<=allowed
   assert len(answer)==len(set(answer))
   if i['responseType']=='order':assert set(answer)==allowed
  if i['responseType']=='extraction':
   assert i['answer'] in i['passage']
   assert len(i['answer'])==i['constraints']['exactCharacters']
  if i['responseType']=='written':
   assert i['rubric']['exactMatchRequired'] is False
   assert i['rubric']['requiredElements'] and i['rubric']['acceptableVariants']
   assert len(i['modelAnswer'])<=i['rubric']['maxCharacters']
  assert 'FY26-B' not in json.dumps(i,ensure_ascii=False)
 # New material for transfer, mixed and next-day, while questions within a passage may share text.
 assert u['items'][0]['passage']!=u['items'][2]['passage']
 assert u['items'][5]['passage']!=u['items'][2]['passage']
 assert u['items'][6]['passage'] not in {i['passage'] for i in u['items'][:6]}
assert len(ids)==len(set(ids))==b['itemCount']==168
assert {'single','multi','order','written','extraction','true-false','text'}<=formats
assert b['retentionPolicy']['minimumDelayHours']==24
assert b['retentionPolicy']['reuseInInitialTraining'] is False
print('Practice content contract: 24 new units / 168 IDs / phase coverage / extraction / rubrics / retention PASS')
labels=json.loads((r/'metadata/skill_labels.json').read_text())['labels']
assert all(skill in labels for u in b['units'] for skill in u['skills'])
assert all(skill in labels for group in json.loads((r/'metadata/observed_skill_taxonomy.json').read_text())['groups'] for skill in group['demands'])
