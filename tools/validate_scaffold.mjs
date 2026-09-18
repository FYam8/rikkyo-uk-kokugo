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

const forbidden=['src/drills.js','src/kanji50.js','src/kobun100Data.js','src/reviewCurated.js','src/reviewProfiles.js','src/schoolLearningConfig.js','raw'];
for(const path of forbidden){
  if(fs.existsSync(path)) throw new Error(`Scaffold must not contain unverified/copied school content yet: ${path}`);
}

const inventory=JSON.parse(fs.readFileSync('metadata/source_inventory.json','utf8'));
assert.equal(inventory.exams.length,6);
assert.deepEqual(inventory.exams.map(x=>x.examId),['FY24-A','FY24-B','FY25-A','FY25-B','FY26-A','FY26-B']);
assert.equal(inventory.answerAuthority.officialAnswerFilesPresent,false);
assert.equal(inventory.exams.find(x=>x.examId==='FY24-B').availability,'partial-problem-booklet');
assert.ok(!fs.existsSync('src/schoolLearningConfig.js'),'do not activate a Rikkyo route/score strategy before the school analysis is resolved');
assert.ok(fs.existsSync('src/schoolLearningConfig.candidate.js'),'candidate route config should exist without becoming runtime config');

const registry=JSON.parse(fs.readFileSync('metadata/structural_registry.json','utf8'));
assert.equal(registry.exams.length,6);
const ids=[];
for(const exam of registry.exams){
  for(const section of exam.sections){
    if(section.availability==='copyright-omitted'){
      assert.equal(section.questions.length,0,'copyright-omitted sections must remain empty');
      continue;
    }
    if(Number.isInteger(section.questionCount)) assert.equal(section.questions.length,section.questionCount,`${exam.examId} ${section.sectionId}: question count mismatch`);
    for(const q of section.questions){
      ids.push(q.questionId);
      const expectedAuthority=exam.examId==='FY25-A'?'app-derived-verified':'answer-unresolved';
      assert.equal(q.authorityStatus,expectedAuthority,`${q.questionId}: unexpected authority state`);
    }
  }
}
assert.equal(new Set(ids).size,ids.length,'stable question ids must be unique');
assert.equal(ids.length,142,'visible parent-question registry count changed unexpectedly');
const visibleQuestions=registry.exams.flatMap(e=>e.sections.filter(s=>s.availability!=='copyright-omitted').flatMap(s=>s.questions));
assert.equal(visibleQuestions.filter(q=>Number.isInteger(q.sourcePage)).length,142,'every visible parent question must map to a source page');
assert.equal(visibleQuestions.filter(q=>q.responseType!=='unknown').length,142,'response-type resolved count changed unexpectedly');

const taxonomy=JSON.parse(fs.readFileSync('metadata/observed_skill_taxonomy.json','utf8'));
assert.equal(taxonomy.status,'provisional-observed-demand-taxonomy');
const progress=JSON.parse(fs.readFileSync('metadata/mapping_progress.json','utf8'));
assert.equal(progress.visibleParentQuestions,visibleQuestions.length);
assert.equal(progress.sourcePageMapped,visibleQuestions.filter(q=>Number.isInteger(q.sourcePage)).length);
assert.equal(progress.responseTypeResolved,visibleQuestions.filter(q=>q.responseType!=='unknown').length);
assert.equal(progress.answerAuthorityResolved,33);
const answerAuthority=JSON.parse(fs.readFileSync('metadata/answer_authority.json','utf8'));
assert.equal(answerAuthority.officialAnswerSourcePresent,false);
assert.deepEqual(answerAuthority.policy.publishableStates,['APP_DERIVED_VERIFIED']);
assert.equal(answerAuthority.records.length,33);
assert.equal(answerAuthority.records.filter(r=>r.examId==='FY25-A'&&r.state==='APP_DERIVED_VERIFIED').length,33);
for(const r of answerAuthority.records){
  assert.equal(r.official,false,`${r.questionId}: app-derived answer must never be labelled official`);
  assert.equal((r.checks||[]).filter(c=>c.result==='PASS').length,2,`${r.questionId}: two independent PASS checks required`);
  if(['written','diagram-rubric','parts-rubric'].includes(r.answerKind)){
    assert.ok(r.rubric||r.parts,`${r.questionId}: rubric/parts required`);
  }
}
const fy25aIds=new Set(answerAuthority.records.map(r=>r.questionId));
for(const exam of registry.exams.filter(e=>e.examId==='FY25-A')){
  for(const section of exam.sections){
    for(const q of section.questions){
      assert.equal(q.authorityStatus,'app-derived-verified',`${q.questionId}: registry authority not promoted`);
      assert.ok(fy25aIds.has(q.questionId),`${q.questionId}: verified registry question missing answer record`);
    }
  }
}
assert.equal(progress.detailedDemandMapped,142);
const coverage=JSON.parse(fs.readFileSync('metadata/practice_coverage_plan.json','utf8'));
assert.equal(coverage.targetUnits,24);
assert.equal(coverage.domains.reduce((n,d)=>n+d.targetUnits,0),24);
const route=JSON.parse(fs.readFileSync('metadata/learning_route_candidate.json','utf8'));
assert.equal(route.status,'candidate-not-runtime-config');
assert.equal(route.scoreTargets,null,'Rikkyo score targets must remain unresolved at this stage');
assert.equal(route.candidateRoles.final,'FY26-B');
assert.equal(progress.responseTypeResolved,142);
assert.equal(progress.detailedDemandMapped,142);
for(const exam of registry.exams){
  for(const section of exam.sections.filter(s=>s.availability!=='copyright-omitted')){
    for(const q of section.questions){
      assert.ok(q.skillDemand.length>=1,`${q.questionId}: demand missing`);
      assert.ok(!q.skillDemand.includes('literary-reading')&&!q.skillDemand.includes('expository-reading'),`${q.questionId}: generic demand tag remains`);
    }
  }
}

console.log('Rikkyo Kokugo scaffold contract: PASS');
