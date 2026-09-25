#!/usr/bin/env python3
"""Compile school data for the shared engine. Does not approve a release."""
import hashlib,json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(name):return json.loads((ROOT/'metadata'/name).read_text())
def write(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
registry=read('structural_registry.json');authority={r['questionId']:r for r in read('answer_authority.json')['records']};labels=read('skill_labels.json')['labels'];assets=read('source_assets.json');formats=read('input_formats.json')['questions']
version='rikkyo-'+hashlib.sha256(b''.join((ROOT/'metadata'/n).read_bytes() for n in ['structural_registry.json','answer_authority.json','input_formats.json','source_assets.json'])).hexdigest()[:16]
out=ROOT/'public/content'/version;out.mkdir(parents=True,exist_ok=True)
manifest={'years':{}};answerFiles={};profiles={}
for exam in registry['exams']:
 eid=exam['examId'];questions=[];grading={};review={};starts={}
 for section in exam['sections']:
  if section['availability']=='copyright-omitted':continue
  sid={'I':1,'II':2,'III':3,'IV':4}[section['sectionId']];starts[str(sid)]=section['sourcePageStart']
  for source in section['questions']:
   qid=source['questionId'];record=authority[qid];fmt=formats[qid];partCount=fmt.get('parts',1);kind=fmt['kind'];count=partCount if kind in ['parts','text-parts'] else 1
   q={'id':qid,'examId':eid,'section':sid,'question':int(qid.split('Q')[-1]),'page':source['sourcePage'],'points':count,'topic':'・'.join(labels[t] for t in source['skillDemand']),'answerAuthority':record['state'],'answerFormat':fmt if kind!='written' else None,'autoGradable':False}
   rule=None
   if record['state']=='APP_DERIVED_VERIFIED' and not fmt.get('manual') and kind!='written':
    answers=record.get('answer')
    if answers is None and record.get('parts'):answers=[p['answer'] for p in record['parts']]
    if not isinstance(answers,list):answers=[answers]
    assert all(isinstance(a,str) and a for a in answers),(qid,answers)
    rule={'kind':kind,'answers':answers,'points':[count/len(answers)]*len(answers)}
    if 'tokens' in fmt:rule['tokens']=fmt['tokens']
    grading[qid]=rule;q['autoGradable']=True
   questions.append(q)
   if record['state']=='APP_DERIVED_VERIFIED':review[qid]=record
   profiles[qid]={'page':source['sourcePage'],'type':q['topic'],'focus':q['topic'],'requirements':fmt.get('hints',[]),'repairSkill':fmt['repairSkill']}
 pages=[]
 for p in assets[eid]['pages']:
  source=ROOT/p['path'];assert sha(source)==p['sha256'],source
  asset=f'{eid}-{p["page"]:02}.webp';target=out/'assets'/asset;target.parent.mkdir(exist_ok=True);shutil.copyfile(source,target);pages.append({'page':p['page'],'asset':asset})
 manifest['years'][eid]={'questions':questions,'sectionStarts':starts,'problemPages':pages,'partial':eid=='FY24-B','notice':'大問I・IIは原本で省略されています。完全試験・診断には使いません。' if eid=='FY24-B' else ''}
 filename='answers-'+eid+'.json';answerFiles[eid]=filename;write(out/filename,{'years':{eid:{'grading':grading,'review':review,'answerPages':[]}}})
write(out/'problems.json',manifest)
meta={'contentVersion':version,'problemManifest':'problems.json','problemManifestSha256':sha(out/'problems.json'),'answerManifests':answerFiles,'gradingSha256':sha(ROOT/'metadata/answer_authority.json'),'scoringSha256':sha(ROOT/'metadata/scoring_strategy.json'),'releaseStatus':'PRODUCTION_CANDIDATE','officialAnswers':False}
write(out/'version.json',meta);write(ROOT/'public/content/current.json',meta)
# Profiles contain demands and input conditions only; answer evidence is fetched after submission.
(ROOT/'src/reviewProfiles.js').write_text('const profiles='+json.dumps(profiles,ensure_ascii=False)+';\nexport const getReviewProfile=id=>profiles[id]||null;\n')
print('Built',version,'with',sum(len(e['questions']) for e in manifest['years'].values()),'questions and six isolated answer manifests')
