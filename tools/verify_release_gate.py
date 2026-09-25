import json
from pathlib import Path
from release_fingerprint import source_fingerprint
r=Path(__file__).resolve().parents[1]
g=json.loads((r/'metadata/release_gate.json').read_text());c=json.loads((r/'metadata/clean_loops.json').read_text());l=json.loads((r/'upstream.lock.json').read_text())
assert g['status']=='APPROVED_FOR_DEPLOY', 'Release has not passed review'
assert g['consecutiveCleanLoops']==2 and c['status']=='TWO_CONSECUTIVE_CLEAN'
assert len(c['loops'])==2 and all(x['status']=='CLEAN' and x['fixes']==0 and all(t['exitCode']==0 for t in x['checks']) for x in c['loops'])
assert c['sourceFingerprint']==source_fingerprint(), 'Content, engine or audit tools changed after CLEAN'
assert l['upstreamCommit']==json.loads((r/'shared-engine/files.json').read_text())['upstreamCommit']
assert l['candidateStatus']=='PROMOTED_AFTER_UPSTREAM_AND_DOWNSTREAM_QA'
assert 'noindex,nofollow,noarchive' in (r/'index.html').read_text()
print('Release gate: reviewed source fingerprint, two CLEAN loops, promoted pin and noindex PASS')
