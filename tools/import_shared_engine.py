"""Generate the school's shared-engine snapshot from a reviewed upstream checkout."""
import argparse,hashlib,json,os,re,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--upstream-root',type=Path,required=True);p.add_argument('--commit',required=True);args=p.parse_args();assert re.fullmatch('[a-f0-9]{40}',args.commit)
up=args.upstream_root.resolve();exporter=up/'tools/export_shared_engine.mjs'
files=re.findall(r"'([^']+)'",exporter.read_text().split('const ENGINE_FILES=[')[1].split('];')[0]);assert 'src/main.jsx' in files
with tempfile.TemporaryDirectory(prefix='rikkyo-engine-') as tmp:
 out=Path(tmp)/'generated'
 subprocess.run(['node',str(exporter),'--adapter',str(ROOT/'school.adapter.json'),'--content-root',str(ROOT),'--out',str(out)],env={**os.environ,'UPSTREAM_COMMIT':args.commit},check=True)
 for rel in files+['src/nextExamCourseData.js','src/nextExamBridgeData.js','src/nextExamUnitData.js','shared-engine/provenance.json']:
  dest=ROOT/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(out/rel,dest)
manifest={'upstreamCommit':args.commit,'mode':'generated-school-adapter-export','files':{rel:hashlib.sha256((ROOT/rel).read_bytes()).hexdigest() for rel in files}}
(ROOT/'shared-engine/files.json').write_text(json.dumps(manifest,indent=2)+'\n')
lock=ROOT/'upstream.lock.json';j=json.loads(lock.read_text());j['candidateUpstreamCommit']=args.commit;j['candidateStatus']='PENDING_FULL_UPSTREAM_REGRESSION_AND_DOWNSTREAM_QA';lock.write_text(json.dumps(j,indent=2)+'\n')
print('Imported shared engine',args.commit)
