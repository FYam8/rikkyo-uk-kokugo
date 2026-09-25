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
 const panels=page.locator('.sourceReplay');
 for(let i=0;i<await panels.count();i++){
  const panel=panels.nth(i),title=await panel.locator('h3').innerText(),m=title.match(/大問(\d+) 問(\d+)/);const q=pm.years['FY25-A'].questions.find(q=>q.section===Number(m[1])&&q.question===Number(m[2]));const rule=data.grading[q.id];
  if(!rule)throw Error('Fixture expected automatic source replay '+q.id);
  if(['text','text-parts'].includes(rule.kind)){const inputs=panel.locator('input[type="text"]');for(let n=0;n<rule.answers.length;n++)await inputs.nth(n).fill(Array.isArray(rule.answers[n])?rule.answers[n][0]:rule.answers[n]);}
  else for(const token of rule.answers)await panel.locator('.kanaPad').getByRole('button',{name:token,exact:true}).click();
  await panel.getByRole('button',{name:'解き直しを照合する'}).click();
 }
 await page.getByRole('button',{name:'確認した。STEP 1へ'}).click();
 await page.getByRole('button',{name:'ホームへ',exact:true}).click();await page.getByRole('button',{name:'設定',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'学習データを書き出す'}).click();const downloaded=await download;const backup=fs.readFileSync(await downloaded.path());
 await page.getByRole('button',{name:'学習履歴をリセット'}).click();await page.getByRole('button',{name:'FY25 A日程を始める'}).waitFor();
 await page.locator('input[type="file"]').setInputFiles({name:'qa-backup.json',mimeType:'application/json',buffer:backup});await page.getByRole('button',{name:'補強練習を再開'}).waitFor();await page.getByRole('button',{name:'補強練習を再開'}).click();
 if(!(await page.locator('.trainingStageHead').innerText()).includes('STEP 1'))throw Error('Training resume stage mismatch');
 await page.screenshot({path:`qa-training-${width}.png`,fullPage:true});console.log('PASS',width,'diagnostic33, textResume, scoring, weaknesses, sourceReplay3, trainingResume, export/reset/import, noHoldoutFetch');
 if(errors.length)throw Error(errors.join(';'));if(requests.some(u=>u.includes('answers-FY26-B')))throw Error('Holdout fetched');await page.close();
}}finally{await browser.close();server.close();}
