import fs from 'node:fs';import assert from 'node:assert/strict';
import {createSchoolPractice,isSchoolDrillAnswerCorrect} from '../src/schoolPractice.js';
const data=JSON.parse(fs.readFileSync('metadata/practice_bank.json')),routing=JSON.parse(fs.readFileSync('metadata/practice_routing.json'));
const {items,bank,domains}=createSchoolPractice(data,routing.unitSkills);
assert.equal(items.length,175);assert.equal(domains.length,7);
for(const [skill,questions] of Object.entries(bank)){
 assert.ok(questions.filter(q=>q.phase==='基本').length>=2,skill);assert.ok(questions.filter(q=>q.phase==='転用').length>=3,skill);assert.ok(questions.some(q=>q.phase==='混合確認'),skill);
 assert.ok(!questions.some(q=>q.sourcePhase==='retention'));assert.ok(items.some(q=>q.skill===skill&&q.sourcePhase==='retention'&&q.libraryHidden));
}
for(const q of items){
 const answer=q.responseType==='single'?q.answer:q.responseType==='multi'?q.correctAnswers:q.responseType==='order'?q.correctOrder:q.acceptedAnswers[0];
 assert.equal(isSchoolDrillAnswerCorrect(q,answer),true,q.id);
 assert.equal(isSchoolDrillAnswerCorrect(q,null),false,q.id);assert.equal(isSchoolDrillAnswerCorrect(q,''),false,q.id);
 if(q.responseType==='multi')assert.equal(isSchoolDrillAnswerCorrect(q,[...answer,answer[0]]),false);
 if(q.strictText)assert.equal(isSchoolDrillAnswerCorrect(q,answer+'。'),false,q.id);
 assert.doesNotMatch(q.trap,/[A-Z]+_[A-Z_]+/);
}
assert.equal(isSchoolDrillAnswerCorrect(items.find(q=>q.id==='RUK-ORIGINAL-K01-03'),'意志'),true);
console.log('175 runtime items / 7 repair strands / exact text / explicit variants / hidden retention: PASS');
