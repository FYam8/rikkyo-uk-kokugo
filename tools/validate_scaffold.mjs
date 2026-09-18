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
assert.ok(fs.existsSync('src/schoolLearningConfig.js'),'verified diagnostic-only runtime config must exist');
assert.ok(fs.existsSync('src/schoolLearningConfig.candidate.js'),'full-route candidate config should remain separate from runtime');
const runtimeConfig=fs.readFileSync('src/schoolLearningConfig.js','utf8');
assert.match(runtimeConfig,/examKeys:\['FY25-A'\]/,'runtime must expose only fully verified FY25-A');
assert.match(runtimeConfig,/route:\{recentCheck1:null,recentCheck2:null,loadCheck:null,finalExamKey:null\}/,'unverified exams must not enter runtime route');
assert.match(runtimeConfig,/scoreTargets:\[60,70,75\]/,'runtime score targets must be explicit');

const answerAuthority=JSON.parse(fs.readFileSync('metadata/answer_authority.json','utf8'));
assert.equal(answerAuthority.officialAnswerSourcePresent,false);
assert.deepEqual(answerAuthority.policy.publishableStates,['APP_DERIVED_VERIFIED']);
const verifiedRecords=answerAuthority.records.filter(r=>r.state==='APP_DERIVED_VERIFIED');
const verifiedIds=new Set(verifiedRecords.map(r=>r.questionId));
assert.equal(verifiedIds.size,verifiedRecords.length,'verified answer question ids must be unique');

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
      const expectedAuthority=verifiedIds.has(q.questionId)?'app-derived-verified':'answer-unresolved';
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
assert.equal(progress.answerAuthorityResolved,verifiedRecords.length);
assert.equal(progress.answerAuthorityPending,visibleQuestions.length-verifiedRecords.length);
assert.equal(answerAuthority.records.length,52);
assert.equal(answerAuthority.records.filter(r=>r.examId==='FY25-A'&&r.state==='APP_DERIVED_VERIFIED').length,33);
assert.equal(answerAuthority.records.filter(r=>r.examId==='FY25-B'&&r.sectionId==='I'&&r.state==='APP_DERIVED_VERIFIED').length,10);
assert.equal(answerAuthority.records.filter(r=>r.examId==='FY25-B'&&r.sectionId==='II'&&r.state==='APP_DERIVED_VERIFIED').length,9);
for(const r of answerAuthority.records){
  assert.equal(r.official,false,`${r.questionId}: app-derived answer must never be labelled official`);
  assert.equal((r.checks||[]).filter(c=>c.result==='PASS').length,2,`${r.questionId}: two independent PASS checks required`);
  if(['written','diagram-rubric','parts-rubric'].includes(r.answerKind)){
    assert.ok(r.rubric||r.parts,`${r.questionId}: rubric/parts required`);
  }
}
for(const q of visibleQuestions){
  assert.equal(q.authorityStatus,verifiedIds.has(q.questionId)?'app-derived-verified':'answer-unresolved',`${q.questionId}: registry/answer-authority mismatch`);
}
assert.equal(progress.detailedDemandMapped,142);
const coverage=JSON.parse(fs.readFileSync('metadata/practice_coverage_plan.json','utf8'));
assert.equal(coverage.targetUnits,24);
assert.equal(coverage.domains.reduce((n,d)=>n+d.targetUnits,0),24);
const route=JSON.parse(fs.readFileSync('metadata/learning_route_candidate.json','utf8'));
assert.equal(route.status,'candidate-not-runtime-config');
assert.deepEqual(route.scoreTargets,[60,70,75]);
assert.equal(route.scoreTargetAuthority.minimum60.status,'official-guidance');
assert.equal(route.scoreTargetAuthority.stable70.status,'app-strategy');
assert.equal(route.scoreTargetAuthority.stretch75.status,'app-strategy');
assert.equal(route.candidateRoles.final,'FY26-B');
const scoring=JSON.parse(fs.readFileSync('metadata/scoring_strategy.json','utf8'));
assert.equal(scoring.status,'app-normalized-correctness-not-official-points');
assert.equal(scoring.officialPointWeightsKnown,false);
assert.equal(scoring.sourceBasis.passingGuide.valuePercent,60);
assert.equal(scoring.exams['FY25-A'].verifiedParentQuestions,33);
assert.equal(scoring.exams['FY25-A'].officialScoreClaim,false);
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
