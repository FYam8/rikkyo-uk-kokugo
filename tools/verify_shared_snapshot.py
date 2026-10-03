"""Verify the generated adapter export was not independently edited."""
import hashlib,json
from pathlib import Path
r=Path(__file__).resolve().parents[1];m=json.loads((r/'shared-engine/files.json').read_text());lock=json.loads((r/'upstream.lock.json').read_text());p=json.loads((r/'shared-engine/provenance.json').read_text())
assert m['upstreamCommit']==lock.get('candidateUpstreamCommit',lock['upstreamCommit'])==p['upstreamCommit']
assert p['inheritedUpstreamSchoolContent'] is False
cloud=json.loads((r/'shared-engine/cloud-adapter-overrides.json').read_text())
pin=json.loads((r/'shared-progress-production.json').read_text())
assert cloud['productionCloudCommit']==pin['commit'] and pin['productionVerified'] is True
assert set(cloud['files'])=={'src/progressBootstrap.js','src/lib/progressSyncV3.js','src/lib/progressSyncV4.js','index.html'}
# The deployment adapter may add only its exact Cloud origin to the source CSP.
adapted=(r/'index.html').read_bytes()
origin=b'https://rikkyo-uk-progress-api.fyam8.workers.dev'
assert adapted.count(origin)==1
original=adapted.replace(origin,b'')
assert hashlib.sha256(original).hexdigest()==m['files']['index.html']
for path,digest in m['files'].items():
 if path in cloud['files']:
  assert cloud['files'][path]['originalSha256']==digest,path
  digest=cloud['files'][path]['schoolAdapterSha256']
 assert hashlib.sha256((r/path).read_bytes()).hexdigest()==digest,path
print('Generated shared-engine snapshot: PASS',m['upstreamCommit'])
