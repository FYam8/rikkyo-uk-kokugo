import fs from 'node:fs';
import assert from 'node:assert/strict';

const adapter=JSON.parse(fs.readFileSync('school.adapter.json','utf8'));
const lock=JSON.parse(fs.readFileSync('upstream.lock.json','utf8'));

assert.equal(adapter.schoolId,'rikkyo-uk');
assert.equal(adapter.subjectId,'kokugo');
assert.equal(adapter.content.inheritUpstreamSchoolContent,false);
assert.equal(adapter.progress.enabled,false);
for(const value of Object.values(adapter.storage)){
  assert.ok(!String(value).startsWith('waseshibu'),'Rikkyo storage must not use Waseda namespace');
}
assert.notEqual(adapter.storage.learningDb,'waseshibu-kokugo');
assert.equal(lock.upstreamRepository,'FYam8/waseshibu-source');
assert.match(lock.upstreamCommit,/^[0-9a-f]{40}$/);

const forbidden=['src/drills.js','src/kanji50.js','src/kobun100Data.js','src/reviewCurated.js','src/reviewProfiles.js','raw'];
for(const path of forbidden){
  if(fs.existsSync(path)) throw new Error(`Scaffold must not contain unverified/copied school content yet: ${path}`);
}

const inventory=JSON.parse(fs.readFileSync('metadata/source_inventory.json','utf8'));
assert.equal(inventory.exams.length,6);
assert.deepEqual(inventory.exams.map(x=>x.examId),['FY24-A','FY24-B','FY25-A','FY25-B','FY26-A','FY26-B']);
assert.equal(inventory.answerAuthority.officialAnswerFilesPresent,false);
assert.equal(inventory.exams.find(x=>x.examId==='FY24-B').availability,'partial-problem-booklet');

console.log('Rikkyo Kokugo scaffold contract: PASS');
