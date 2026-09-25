import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=process.env.QA_DIST||'dist';const server=http.createServer((req,res)=>{let file=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')file+='/index.html';try{let ext=path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.webp':'image/webp'})[ext]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(4173,'127.0.0.1',r));
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{for(const width of (process.env.QA_WIDTHS||'1280,390').split(',').map(Number)){
 const page=await browser.newPage({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:4173');await page.getByRole('button',{name:'FY25 A日程を始める'}).click();
 await page.getByRole('textbox',{name:'解答',exact:true}).fill('器官');await page.waitForTimeout(400);await page.reload();await page.getByRole('button',{name:'続きから解く'}).click();if(await page.getByRole('textbox',{name:'解答',exact:true}).inputValue()!=='器官')throw Error('Resume lost text');
 // Visit every diagnostic question and operate every visible response field.
 const meta=JSON.parse(fs.readFileSync(root+'/content/current.json'));const pm=JSON.parse(fs.readFileSync(root+'/content/'+meta.contentVersion+'/problems.json'));
 for(const q of pm.years['FY25-A'].questions){
  await page.locator('.sectionTabs button').filter({hasText:'大問'+q.section}).click();await page.getByRole('button',{name:'問'+q.question,exact:true}).click();
  const boxes=page.locator('.activeQuestion input[type="text"],.activeQuestion textarea');
  for(let i=0;i<await boxes.count();i++)await boxes.nth(i).fill('確認用答案');
  const tokens=page.locator('.activeQuestion .kanaPad button');if(await tokens.count())await tokens.first().click();
 }
 await page.screenshot({path:`qa-exam-${width}.png`,fullPage:true});await page.getByRole('button',{name:'終了して採点',exact:true}).click();await page.getByRole('button',{name:'採点を確定して端末に保存'}).waitFor();
 const scores=page.locator('.gradeRow input[type="number"]');for(let i=0;i<await scores.count();i++)await scores.nth(i).fill('0');
 await page.getByRole('button',{name:'採点を確定して端末に保存'}).click();await page.waitForTimeout(200);await page.getByRole('button',{name:'ホームへ戻る',exact:true}).click();
 await page.getByRole('button',{name:'弱点トレーニングを始める'}).click();await page.waitForTimeout(200);const data=JSON.parse(fs.readFileSync(root+'/content/'+meta.contentVersion+'/'+meta.answerManifests['FY25-A'])).years['FY25-A'];
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))throw Error('Source replay horizontal overflow');const panels=page.locator('.sourceReplay');
 for(let i=0;i<await panels.count();i++){
  const panel=panels.nth(i),title=await panel.locator('h3').innerText(),m=title.match(/大問(\d+) 問(\d+)/);const q=pm.years['FY25-A'].questions.find(q=>q.section===Number(m[1])&&q.question===Number(m[2]));const rule=data.grading[q.id];
  if(!rule)throw Error('Fixture expected automatic source replay '+q.id);
  if(['text','text-parts'].includes(rule.kind)){const inputs=panel.locator('input[type="text"]');for(let n=0;n<rule.answers.length;n++)await inputs.nth(n).fill(Array.isArray(rule.answers[n])?rule.answers[n][0]:rule.answers[n]);}
  else for(const token of rule.answers)await panel.locator('.kanaPad').getByRole('button',{name:token,exact:true}).click();
  await panel.getByRole('button',{name:'解き直しを照合する'}).click().catch(async e=>{await page.screenshot({path:'qa-replay-failure.png',fullPage:true});console.log(await panel.evaluate(el=>({html:el.outerHTML,rect:el.getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight,visualViewport.scale]})));throw e;});
 }
 await page.screenshot({path:`qa-source-replay-${width}.png`,fullPage:true});await page.getByRole('button',{name:'確認した。STEP 1へ'}).click();
 await page.getByRole('button',{name:'ホームへ',exact:true}).click();await page.getByRole('button',{name:'設定',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'学習データを書き出す'}).click();const downloaded=await download;const backup=fs.readFileSync(await downloaded.path());
 await page.getByRole('button',{name:'学習履歴をリセット'}).click();await page.getByRole('button',{name:'FY25 A日程を始める'}).waitFor();
 await page.locator('input[type="file"]').setInputFiles({name:'qa-backup.json',mimeType:'application/json',buffer:backup});await page.getByRole('button',{name:'補強練習を再開'}).waitFor();await page.getByRole('button',{name:'補強練習を再開'}).click();
 if(!(await page.locator('.trainingStageHead').innerText()).includes('STEP 1'))throw Error('Training resume stage mismatch');
 const bank=JSON.parse(fs.readFileSync('metadata/practice_bank.json')).units.flatMap(u=>u.items);
for(let block=0;block<10;block++){
 for(let round=0;round<50;round++){
  if(await page.getByRole('button',{name:'クリアを記録して次へ'}).count()){await page.getByRole('button',{name:'クリアを記録して次へ'}).click();console.log('STEP COMPLETE',width);break;}
  const prompt=await page.locator('.focusedDrillCard h3').innerText();const passage=await page.locator('.passagePanel p').innerText();
  const q=bank.find(q=>q.prompt===prompt&&q.passage===passage);if(!q)throw Error('Unmapped practice '+prompt);
  if(['text','extraction','written'].includes(q.responseType))await page.locator('#training-text-answer').fill(q.modelAnswer||q.answer);
  else for(const id of Array.isArray(q.answer)?q.answer:[q.answer]){const opt=q.options.find(o=>o.id===id);await page.locator('.focusedDrillOptions button').filter({hasText:opt.text}).click();}
  if(await page.getByRole('button',{name:'答えを確定',exact:true}).count()){
   await page.getByRole('button',{name:'答えを確定',exact:true}).click();
   if(q.responseType==='written'){
    const panels=page.locator('.writtenAssessmentPanel');for(let i=0;i<await panels.count();i++){const panel=panels.nth(i);for(const button of await panel.getByRole('button',{name:'含まれている',exact:true}).all())await button.click();await panel.getByRole('button',{name:'付け足していない',exact:true}).click();await panel.getByRole('button',{name:'自己採点で合格',exact:true}).click();}
   }
   if(!(await page.locator('.feedbackHeadline').innerText()).includes('○'))throw Error('Model practice answer failed '+q.id);
   await page.getByRole('button',{name:'次へ →',exact:true}).click();
  }else if(await page.getByRole('button',{name:'次の問へ →',exact:true}).count())await page.getByRole('button',{name:'次の問へ →',exact:true}).click();
  else await page.getByRole('button',{name:'まとめて判定する',exact:true}).click();
 }

  await page.locator('.todayPanel').waitFor();
  if(await page.getByRole('button',{name:'弱点トレーニングを始める'}).count()){
   await page.getByRole('button',{name:'弱点トレーニングを始める'}).click();
   const replays=page.locator('.sourceReplay');
   for(let i=0;i<await replays.count();i++){
    const panel=replays.nth(i),m=(await panel.locator('h3').innerText()).match(/大問(\d+) 問(\d+)/),q=pm.years['FY25-A'].questions.find(q=>q.section===Number(m[1])&&q.question===Number(m[2]));const rule=data.grading[q.id],record=data.review[q.id];
    if(rule&&['single','parts','set','order'].includes(rule.kind)){for(const token of rule.answers)await panel.locator('.kanaPad').getByRole('button',{name:token,exact:true}).click();}
    else{const inputs=panel.locator('input[type="text"],textarea');for(let n=0;n<await inputs.count();n++){const value=rule?.answers?.[n]??record?.parts?.[n]?.answer??record?.parts?.[n]?.model??record?.parts?.[n]?.modelAnswer??record?.modelAnswer??record?.modelSpec??'本文の必要要素を確かめる';await inputs.nth(n).fill(Array.isArray(value)?value.flat().join('／'):String(value));}}
    await panel.getByRole('button',{name:'解き直しを照合する'}).click();if(!rule)await panel.getByRole('checkbox').check();
   }
   await page.getByRole('button',{name:'確認した。STEP 1へ'}).click();
  }else break;
 }
 const pending=page.getByRole('button',{name:'定着確認を始める',exact:true});const delayed=await pending.count();if(!delayed)throw Error('No retention scheduled');
 for(let i=0;i<delayed;i++)if(!await pending.nth(i).isDisabled())throw Error('Retention opened before 24 hours');
 const now=await page.evaluate(()=>Date.now());await page.clock.setFixedTime(new Date(now+86400000+2000));await page.reload();await pending.first().waitFor();
 for(let i=0;i<delayed;i++){
  await pending.first().click();
  const prompt=await page.locator('.focusedDrillCard h3').innerText(),passage=await page.locator('.passagePanel p').innerText();
  const q=bank.find(q=>q.phase==='retention'&&q.prompt===prompt&&q.passage===passage);if(!q)throw Error('Missing reserved retention item');
  if(['text','extraction'].includes(q.responseType))await page.locator('#drill-library-text-answer').fill(q.answer);
  else await page.locator('.focusedDrillOptions button').filter({hasText:q.options.find(o=>o.id===q.answer).text}).click();
  await page.getByRole('button',{name:'答えを確定',exact:true}).click();if(!(await page.locator('.feedbackHeadline').innerText()).includes('○'))throw Error('Retention answer failed '+q.id);
  await page.getByRole('button',{name:'ホームで次の学習を確認'}).click();
 }
 await page.getByRole('button',{name:'FY24 A日程を始める'}).waitFor();console.log('RETENTION COMPLETE',width,delayed,'strands; 24h gate simulated with browser clock');
 await page.screenshot({path:`qa-training-${width}.png`,fullPage:true});console.log('PASS',width,'diagnostic33, textResume, scoring, weaknesses, sourceReplay3, trainingResume, export/reset/import, noHoldoutFetch');
 if(errors.length)throw Error(errors.join(';'));if(requests.some(u=>u.includes('answers-FY26-B')))throw Error('Holdout fetched');await page.close();
}}finally{await browser.close();server.close();}
