"""Verify the generated adapter export was not independently edited."""
import hashlib,json
from pathlib import Path
r=Path(__file__).resolve().parents[1];m=json.loads((r/'shared-engine/files.json').read_text());lock=json.loads((r/'upstream.lock.json').read_text());p=json.loads((r/'shared-engine/provenance.json').read_text())
assert m['upstreamCommit']==lock.get('candidateUpstreamCommit',lock['upstreamCommit'])==p['upstreamCommit']
assert p['inheritedUpstreamSchoolContent'] is False
for path,digest in m['files'].items():assert hashlib.sha256((r/path).read_bytes()).hexdigest()==digest,path
print('Generated shared-engine snapshot: PASS',m['upstreamCommit'])
