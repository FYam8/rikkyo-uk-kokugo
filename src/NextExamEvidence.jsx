import {UNIT} from './nextExamUnit.js';
import React,{useState} from 'react';
import {answerReference,examReference,firstExamRecords,latestAnnotation,acceptedReview,examEvidence,verifiedEvidence,observedOutcomes} from './nextExamEvidence.js';
const blankReview={role:'',result:'',basis:''};
function ReviewerFields({value,onChange,disabled}){return <>
 <label>確認者の立場<select aria-label="確認者の立場" disabled={disabled} value={value.role||''} onChange={e=>onChange({...value,role:e.target.value})}><option value="">未確認</option><option value="self">本人の自己評価</option><option value="guardian">保護者</option><option value="teacher">指導者</option></select></label>
 <label>確認結果<select aria-label="確認結果" disabled={disabled} value={value.result||''} onChange={e=>onChange({...value,result:e.target.value})}><option value="">未確認</option><option value="confirmed">基準と照合して確認した</option><option value="repair">不足・誤りがある</option><option value="uncertain">判断に迷う</option></select></label>
 <label>評価の根拠・残る不足<textarea aria-label="評価の根拠・残る不足" disabled={disabled} value={value.basis||''} onChange={e=>onChange({...value,basis:e.target.value})}/></label>
 </>;}
export default function NextExamEvidence({state,events,manifest,onSave,onEdit,busy,unit=UNIT}){
 const UNIT=unit;
 const [notice,setNotice]=useState('');
 const draft=state.evidenceDraft||{answerIndex:'',review:blankReview,form:state.examEvidence||{}};
 const {answerIndex,review,form}=draft;
 const setDraft=patch=>onEdit({evidenceDraft:{...draft,...patch}});
 const setReview=review=>setDraft({review});
 const setForm=form=>setDraft({form});
 const records=state.records||[],record=records[Number(answerIndex)],exams=firstExamRecords(events),event=exams.find(e=>e.id===form.eventId);
 const material=record&&UNIT.items.find(x=>x.id===record.itemId&&record.revision===UNIT.revision);
 const questions=manifest?.years?.[String(event?.examId??event?.year)]?.questions||[];
 const audit=examEvidence(event,form,manifest,state.target),verified=verifiedEvidence(state,events,manifest,UNIT),outcomes=observedOutcomes(events,state.examEvidenceLog||[],state.target,manifest);
 const qualified=outcomes.filter(x=>x.qualified),minimum=qualified.length?Math.min(...qualified.map(x=>x.score)):null;
 const update=patch=>setForm({...form,...patch});
 return <section className="card"><h2>長文・時間配分・他者評価の確認</h2><p>保存した答案を保護者・指導者と照合して記録します。入力者の申告記録であり、アプリが確認者の本人性や採点の正しさを認証するものではありません。過去問の初回得点は変更しません。</p>
 <details><summary>記述答案を一つずつ確認する（確認済み {verified.reviewed}／{verified.required}件）</summary>
 <label>確認する答案<select aria-label="確認する答案" disabled={busy} value={answerIndex} onChange={e=>{setDraft({answerIndex:e.target.value,review:blankReview});}}><option value="">選んでください</option>{records.map((r,i)=><option key={i} value={i}>{UNIT.stages[UNIT.items.findIndex(q=>q.id===r.itemId)+1]||'保存済み答案'}／{new Date(r.submittedAt).toLocaleString()}</option>)}</select></label>
 {answerIndex!==''&&record&&<>{material&&<><p className="unitPassage">{material.text}</p><p>{material.question}</p><p>学習用解答例：{material.model}</p><ul>{material.criteria.map(c=><li key={c}>{c}</li>)}</ul></>}<p>初回答案：{record.answer}</p><p>本文根拠：{record.evidence}</p><p>評価は、必要要素・二者や因果の関係・本文との整合・字数を別々に照合してください。自己採点の結果：{record.result}。</p><p>直近の確認：{acceptedReview(latestAnnotation(state.answerReviews,answerReference(record)))?'他者確認の記録あり':'未確認・保留・再補強'}</p>
 <ReviewerFields value={review} onChange={setReview} disabled={busy}/><button disabled={busy||!material||!review.role||!review.result||!review.basis.trim()} onClick={async()=>{if(await onSave({...state,answerReviews:[...(state.answerReviews||[]),{...review,reference:answerReference(record),recordedAt:Date.now()}]})){setNotice('答案の評価を追記しました。');setReview(blankReview);}}}>答案の評価を記録</button></>}
 </details>
 <details><summary>受験済みの長文・本番条件と得点経路を確認する</summary>
 <p>まず学習用年度を通常の過去問画面で解き、採点・保存してください。記録のない年度や、現在の教材版と対応しない答案はここでは確定できません。留保年度の本文をこの画面で先に開くことはありません。</p>
 <label>条件を確認する過去問<select aria-label="条件を確認する過去問" disabled={busy} value={form.eventId||''} onChange={e=>{const e2=exams.find(x=>x.id===e.target.value);setForm(e2?{eventId:e2.id,reference:examReference(e2),selectedIds:[]}:{});}}><option value="">選んでください</option>{exams.map(e=><option key={e.id} value={e.id}>{e.examId??e.year}年度／初回 {e.totalScore}点</option>)}</select></label>
 {event&&<><p>保存済み所要時間：{event.elapsedSeconds}秒。得点：{event.totalScore}点。本文は学校の長文そのものを使います。</p>
 <label>事前の露出<select aria-label="事前の露出" disabled={busy} value={form.exposure||''} onChange={e=>update({exposure:e.target.value})}><option value="">不明</option><option value="unseen">本文・解答・同じ本文の設問を事前に見ていない</option><option value="seen">事前に見た／復習として解いた</option></select></label>
 <label><input type="checkbox" disabled={busy} checked={form.noHelp===true} onChange={e=>update({noHelp:e.target.checked})}/>ヒント・解説・他者の補助なしで解いた</label>
 <label><input type="checkbox" disabled={busy} checked={form.uninterrupted===true} onChange={e=>update({uninterrupted:e.target.checked})}/>保存済み時間に中断・計測漏れがないことを確認した</label>
 <label>原本の制限時間（分）<input aria-label="原本の制限時間（分）" type="number" min="1" disabled={busy} value={Number.isFinite(form.limitSeconds)?form.limitSeconds/60:''} onChange={e=>update({limitSeconds:e.target.value===''?null:Number(e.target.value)*60})}/></label>
 <label>制限時間を確認した資料・箇所<input aria-label="制限時間を確認した資料・箇所" disabled={busy} value={form.limitSource||''} onChange={e=>update({limitSource:e.target.value})}/></label>
 <p>得点を確保する問題群を選んでください。表示はその群の満点合計であり、次年度の予測得点ではありません。</p>
 <div>{questions.map(q=><label className="unitCriterion" key={q.id}><input type="checkbox" aria-label={`得点経路 ${q.id}`} disabled={busy} checked={(form.selectedIds||[]).includes(q.id)} onChange={e=>update({selectedIds:e.target.checked?[...(form.selectedIds||[]),q.id]:(form.selectedIds||[]).filter(id=>id!==q.id)})}/>大問{q.section} 問{q.question}：{q.points}点</label>)}</div>
 <p>選択した問題群の満点合計：{audit.points??'版・配点を要照合'}／目標{state.target}点</p>
 <ReviewerFields value={form} onChange={setForm} disabled={busy}/>
 <ul>{audit.missing.map(x=><li key={x}>{x}</li>)}</ul>
 <button disabled={busy} onClick={async()=>{const annotation={...form,recordedAt:Date.now()};if(await onSave({...state,examEvidence:annotation,examEvidenceLog:[...(state.examEvidenceLog||[]),annotation]})){setForm(annotation);setNotice('受験条件を記録しました。不足する条件は未確認のまま保持します。');}}}>受験条件・得点経路を記録</button></>}
 </details>
 <p>{notice}</p><h3>確認できた年度ごとの結果</h3><ul>{outcomes.map(o=><li key={o.eventId}>{o.year}年度：{o.score}点／{o.result}</li>)}</ul>
 <p>条件確認済み：{qualified.length}年度。観測された最低点：{minimum??'未測定'}。目標未達：{qualified.filter(o=>o.score<state.target).length}回。少数の過去問の結果であり、将来の最低点や合格を保証しません。</p>
 </section>;
}

