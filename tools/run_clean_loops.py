"""Run both complete release audits against one immutable functional build."""
import datetime,hashlib,json,subprocess,sys,os
from pathlib import Path
from release_fingerprint import source_fingerprint
ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'metadata/clean_loops.json'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def fingerprint():
 files=sorted([* (ROOT/'src').rglob('*'),*(ROOT/'raw').rglob('*'),*(ROOT/'dist').rglob('*')])
 return hashlib.sha256(b''.join(p.relative_to(ROOT).as_posix().encode()+p.read_bytes() for p in files if p.is_file())).hexdigest()
commands=[['node','tools/validate_scaffold.mjs'],['python','tools/test_authority_baseline.py'],['python','tools/test_practice_bank.py'],['node','tools/test_runtime_bank.mjs'],['python','tools/verify_shared_snapshot.py'],['python','tools/test_question_pages.py'],['python','tools/validate_grading.py'],['python','tools/check_public_artifact.py','dist'],['node','tools/audit_browser_diagnostic.mjs'],['node','tools/audit_browser_exams.mjs'],['node','tools/audit_browser_training.mjs']]
commands.extend([['node','tools/verify-shared-progress.mjs'],['node','tools/test_progress_projection.mjs'],['node','tools/test_cloud_document.mjs']])
report={'schemaVersion':1,'status':'RUNNING','functionalFingerprint':fingerprint(),'sourceFingerprint':source_fingerprint(),'browser':os.environ.get('QA_BROWSER_EVIDENCE','Playwright Chromium; desktop 1280px and mobile 390px with touch emulation'),'retentionClock':'Playwright fixed clock advanced by 24 hours + 2 seconds; not a real-day wait','loops':[]}
for n in (1,2):
 loop={'number':n,'startedAt':now(),'checks':[],'fixes':0};report['loops'].append(loop)
 for cmd in commands:
  print('LOOP',n,' '.join(cmd),flush=True)
  p=subprocess.run(cmd,cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=900)
  print(p.stdout,flush=True);loop['checks'].append({'command':cmd,'exitCode':p.returncode,'output':p.stdout})
  if p.returncode or fingerprint()!=report['functionalFingerprint'] or source_fingerprint()!=report['sourceFingerprint']:
   report['status']='FAILED';loop['status']='FAILED';REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');sys.exit(1)
 loop['status']='CLEAN';loop['completedAt']=now();REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
report['status']='TWO_CONSECUTIVE_CLEAN';report['completedAt']=now();REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(report['status'],flush=True)
