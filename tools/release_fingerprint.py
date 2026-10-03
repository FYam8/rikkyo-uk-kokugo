"""Fingerprint executable source, school data, source assets and audit tools."""
import hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def source_fingerprint():
 paths=[]
 for folder in ['src','raw','tools','shared-engine']:
  paths.extend(p for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
 paths.extend(p for p in (ROOT/'public').rglob('*') if p.is_file() and 'content' not in p.relative_to(ROOT/'public').parts)
 for name in ['index.html','package.json','package-lock.json','vite.config.js','school.adapter.json','upstream.lock.json','shared-progress-production.json']:
  paths.append(ROOT/name)
 for name in ['answer_authority','authority_review_20260925','authority_review_20261003','structural_registry','input_formats','source_assets','mapping_progress','scoring_strategy','practice_bank','practice_routing','verified_baseline','skill_labels','learning_route_candidate']:
  paths.append(ROOT/'metadata'/f'{name}.json')
 return hashlib.sha256(b''.join(p.relative_to(ROOT).as_posix().encode()+b'\0'+p.read_bytes() for p in sorted(set(paths),key=lambda p:p.relative_to(ROOT).as_posix()))).hexdigest()
if __name__=='__main__':print(source_fingerprint())
