import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=process.env.QA_DIST||'dist';const server=http.createServer((req,res)=>{let file=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')file+='/index.html';try{let ext=path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.webp':'image/webp'})[ext]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(4173,'127.0.0.1',r));
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const meta=JSON.parse(fs.readFileSync(root+'/content/current.json')),pm=JSON.parse(fs.readFileSync(root+'/content/'+meta.contentVersion+'/problems.json'));
const exams=['FY25-A','FY24-A','FY25-B','FY26-A','FY26-B'];
try{for(const width of (process.env.QA_WIDTHS||'1280,390').split(',').map(Number)){
 const page=await browser.newPage({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));page.on('dialog',d=>d.accept());await page.goto('http://127.0.0.1:4173');
 for(const exam of [...exams,'FY24-B']){
  const label=exam.replace('FY','FY').replace('-A',' A日程').replace('-B',' B日程');
  if(exam==='FY24-B'){await page.locator('.paperLibrary summary').click();await page.locator('.paperRow').filter({hasText:label}).getByRole('button',{name:'自由受験'}).click();}
  else {if(exam==='FY26-B'){await page.locator('.finalEvaluationPanel').waitFor();if(await page.locator('.todayPanel').count())throw Error('Holdout appeared in Today');}await page.getByRole('button',{name:label+'を始める'}).click();}
  await page.getByRole('button',{name:'拡大',exact:true}).click();await page.locator('.viewer.zoomed').waitFor();await page.getByRole('button',{name:'全体表示',exact:true}).click();
  const refs=JSON.parse(fs.readFileSync(root+'/content/'+meta.contentVersion+'/'+meta.answerManifests[exam])).years[exam];
  for(const q of pm.years[exam].questions){
   await page.locator('.sectionTabs button').filter({hasText:'大問'+q.section}).click();await page.getByRole('button',{name:'問'+q.question,exact:true}).click();
   const panel=page.locator('.activeQuestion');if(await panel.locator('.kanaPad button.selected,.kanaPad button[aria-pressed="true"]').count())throw Error('Unanswered question preselected '+q.id);const rule=refs.grading[q.id],record=refs.review[q.id],format=q.answerFormat;
   if(rule&&['single','parts','set','order'].includes(rule.kind)){
    if(await panel.getByRole('button',{name:'残りの選択肢を表示',exact:true}).count())await panel.getByRole('button',{name:'残りの選択肢を表示',exact:true}).click();
    for(const token of rule.answers)await panel.locator('.kanaPad').getByRole('button',{name:token,exact:true}).click();
   }else{
    const boxes=panel.locator('input[type="text"],textarea');
    for(let n=0;n<await boxes.count();n++){
     const value=rule?.answers?.[n]??record?.parts?.[n]?.answer??record?.parts?.[n]?.modelAnswer??record?.cells?.[n]?.answer??record?.modelAnswer??record?.modelSpec??'本文と設問条件を確認する';
     await boxes.nth(n).fill(Array.isArray(value)?value.flat().join('／'):String(value));
    }
   }
   const img=page.locator('.pageCanvas img');await img.evaluate(el=>new Promise((resolve,reject)=>{if(el.complete)return el.naturalWidth?resolve():reject(Error('Image failed'));const timer=setTimeout(()=>reject(Error('Image timeout')),10000);el.onload=()=>{clearTimeout(timer);resolve()};el.onerror=()=>{clearTimeout(timer);reject(Error('Image failed'))}}));
  }
  if(exam==='FY26-B'&&requests.some(u=>u.includes('answers-FY26-B')))throw Error('Final answers fetched before submission');
  await page.screenshot({path:`qa-${exam}-${width}.png`,fullPage:true});await page.getByRole('button',{name:'終了して採点',exact:true}).click();await page.getByRole('button',{name:'採点を確定して端末に保存'}).waitFor();
  const scores=page.locator('.gradeRow input[type="number"]');for(let i=0;i<await scores.count();i++)await scores.nth(i).fill(await scores.nth(i).getAttribute('max'));
  await page.getByRole('button',{name:'採点を確定して端末に保存'}).click();await page.getByRole('button',{name:'ホームへ戻る'}).waitFor();
  const heading=await page.locator('.resultHero').innerText();if(!heading.includes('100%'))throw Error(exam+' expected full normalized score: '+heading);
  console.log('PASS',width,exam,pm.years[exam].questions.length,'input/scoring/source pages');await page.getByRole('button',{name:'ホームへ戻る'}).click();
 }
 if(errors.length)throw Error(errors.join(';'));await page.close();
}}finally{await browser.close();server.close();}
