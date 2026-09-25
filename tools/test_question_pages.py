import hashlib,json
from pathlib import Path
r=Path(__file__).resolve().parents[1];meta=json.loads((r/'public/content/current.json').read_text());content=r/'public/content'/meta['contentVersion'];pm=json.loads((content/meta['problemManifest']).read_text())
ids=[]
for key,exam in pm['years'].items():
 pages={p['page']:p for p in exam['problemPages']}
 for q in exam['questions']:
  ids.append(q['id']);assert q['page'] in pages
 for p in pages.values():assert (content/'assets'/p['asset']).is_file()
assert len(ids)==len(set(ids))==142
assert {q['section'] for q in pm['years']['FY24-B']['questions']}=={3,4}
assert all(q['examId']==k for k,e in pm['years'].items() for q in e['questions'])
assert hashlib.sha256((content/meta['problemManifest']).read_bytes()).hexdigest()==meta['problemManifestSha256']
print('142 source mappings and FY24-B omitted-section isolation: PASS')
