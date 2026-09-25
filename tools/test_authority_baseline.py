"""Regression gates: original verified answers/IDs, review exclusion and omissions."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def read(name):
    return json.loads((ROOT / name).read_text())

baseline = read('metadata/verified_baseline.json')
authority = read('metadata/answer_authority.json')
registry = read('metadata/structural_registry.json')
progress = read('metadata/mapping_progress.json')
records = {r['questionId']: r for r in authority['records']}
assert len(records) == len(authority['records']) == 142
assert len(baseline['records']) == 63
for qid, digest in baseline['records'].items():
    serialized = json.dumps(records[qid], ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    assert hashlib.sha256(serialized.encode()).hexdigest() == digest, qid

mapping = {q['questionId']: {'examId': e['examId'], 'sectionId': s['sectionId'], 'sourcePage': q['sourcePage']}
           for e in registry['exams'] for s in e['sections'] for q in s['questions']}
assert mapping == baseline['sourceMapping'], 'A stable ID or source mapping changed'
assert set(records) == set(mapping)
verified = [r for r in records.values() if r['state'] in authority['policy']['publishableStates']]
review = [r for r in records.values() if r['state'] == 'REVIEW_REQUIRED']
assert {r['questionId'] for r in verified} == set(baseline['records'])
assert len(verified) == progress['answerAuthorityResolved'] == 63
assert len(review) == progress['answerAuthorityPending'] == 79
assert all(r['reviewBlocker'] and not any(c['result'] == 'PASS' for c in r['checks']) for r in review)
assert all(r['official'] is False for r in records.values())
for r in review:
    if 'modelAnswer' in r and 'constraints' in r:
        count = len(r['modelAnswer'])
        assert count >= r['constraints'].get('minCharacters', 0), r['questionId']
        assert count <= r['constraints'].get('maxCharacters', count), r['questionId']
    if r.get('rubric'):
        assert r['rubric'].get('exactMatchRequired') is False, r['questionId']
omissions = authority['unavailableSections']
assert {s['sectionId'] for s in omissions} == {'FY24-B-I', 'FY24-B-II'}
assert all(s['state'] == 'UNAVAILABLE_SOURCE' and s['questionCount'] is None for s in omissions)
for e in registry['exams']:
    for s in e['sections']:
        if s['availability'] == 'copyright-omitted':
            assert s['questions'] == []
assert progress['gates']['publicDeploy'] == 'HOLD'
print('Authority baseline / 142 IDs / 79 review exclusions / two omitted sections: PASS')
