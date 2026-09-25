"""Reviewed additions to the app-authored bank; preserve IDs with revisions."""
def refine(result):
 units={u['id'].split('-')[-1]:u for u in result['units']}
 extraction={
 'L05-03':('母がいた場所を、本文から漢字二字で抜き出そう。','窓辺'),
 'L05-04':('澄がうなずいた後にしたことを、本文から十一字で抜き出そう。句点は含めない。','握っていた地図を開いた'),
 'L05-06':('声の様子を表す部分を、本文から六字で抜き出そう。','かすれていた'),
 'L05-07':('絵里が感じた匂いを、本文から七字で抜き出そう。','湿った土の匂い'),
 'E02-03':('繰り返す測定で区別する二つを、間の「と」も含めて本文から十二字で抜き出そう。','偶然の変動と安定した傾向'),
 'E02-05':('測定を繰り返す際に必要なことを、本文から五字で抜き出そう。','道具の点検'),
 'E02-07':('記録を比べるために添えるものを、本文から二字で抜き出そう。','日付')}
 for key,(prompt,answer) in extraction.items():
  uid,n=key.split('-');q=units[uid]['items'][int(n)-1]
  for k in ['options','rubric','modelAnswer']:q.pop(k,None)
  q.update(responseType='extraction',prompt=prompt,answer=answer,skills=['TEXT_EXTRACTION'],constraints={'exactCharacters':len(answer)},revision=3,explanation=f'本文の「{answer}」が指定された内容を表す。{len(answer)}字で、前後の助詞や句点を勝手に付け足さない。')
 # Add a distinct seven-item language strand inside the existing vocabulary unit.
 grammar=[
 ('basic','白い雲がゆっくり東へ流れる。','主語と述語の文節の組合せを選ぼう。',['白い―流れる','雲が―流れる','ゆっくり―東へ','東へ―雲が'],'2',['GRAMMAR'],'何がどうするかを探すと「雲が流れる」。白いは雲への修飾、ゆっくりと東へは流れるへの修飾。'),
 ('basic','遠足の帰り、なくしたと思った財布が鞄の底から見つかり、玲は胸をなで下ろした。','胸をなで下ろした気持ちとして適切なのは。',['怒りが強まった','安心した','得意になった','疑いを深めた'],'2',['IDIOM','VOCAB_CONTEXT'],'心配していた財布が見つかったため安心した。胸をなで下ろすは安堵を表し、怒り・自慢・疑念を意味しない。'),
 ('transfer','①冷たい水を飲む。②水は冷たい。','①②の「冷たい」の品詞として正しいものは。',['①形容詞・②形容詞','①名詞・②動詞','①副詞・②名詞','①動詞・②副詞'],'1',['GRAMMAR','PART_OF_SPEECH'],'どちらも性質を表し、言い切りが「い」の形容詞。①は水を修飾し、②は述語になっているが、文中の役割が違っても品詞は変わらない。'),
 ('transfer','【学習用の語義】通る：①ある場所を移動する。②音や声が遠くまではっきり届く。\n体育館で舞台係が「後ろの席まで声が通るように話そう」と呼びかけた。','本文での意味と根拠として正しい組合せは。',['①―人が後ろの席へ歩くから','②―声が離れた席にも聞こえるようにするから','①―声には必ず歩く力があるから','②―後ろの席をなくすから'],'2',['DICTIONARY_USAGE','VOCAB_CONTEXT'],'「通る」の主語は人ではなく声。遠い席まで音が届く意味②に合う。席へ歩く行動や席をなくす話は示されていない。'),
 ('transfer','「果物」は、りんごやみかんに共通する性質をまとめた言葉だ。種類の違いをいったん取り去り、共通点に注目して考えている。','この説明の「具体的」と対になる考え方を表す語は。',['時間的','形式的','抽象的','個別的'],'3',['ANTONYM','CONCEPT_DEFINITION'],'個々の具体例から共通する性質を取り出すのが抽象化。「時間的」は時間、「形式的」は形式、「個別的」は一つ一つの対象に関わる語。'),
 ('mixed','帰り道、雨がぽつぽつ降り始めた。まだ地面の乾いた部分が多く残っていた。','ぽつぽつが表す降り方は。',['激しく連続して降る','大きな音を立てて吹き付ける','少しずつ間を置いて降る','すでに完全にやんでいる'],'3',['MIMETIC_WORD','VOCAB_CONTEXT'],'「降り始め」「乾いた部分が多い」と合わせると、小さな雨粒が間を置いて落ちる様子。激しい連続的な雨や止んだ状態とは違う。'),
 ('retention','風で窓が急に閉まった。机の上の紙が少し動いた。','最初の文の「急に」が直接修飾する文節は。',['風で','窓が','閉まった','紙が'],'3',['GRAMMAR'],'「急に」は閉まり方を表し、閉まったを修飾する。窓という物の性質ではなく動きの様子であり、次の文の紙がにもかからない。')]
 u=units['K09']
 for n,(phase,passage,prompt,options,answer,skills,explanation) in enumerate(grammar,start=8):
  u['items'].append({'id':f'{u["id"]}-{n:02}','revision':1,'phase':phase,'skills':skills,'passage':passage,'prompt':prompt,'options':[{'id':str(i),'text':t} for i,t in enumerate(options,1)],'answer':answer,'responseType':'single','explanation':explanation,'origin':'APP_AUTHORED','repairSkill':'文の組み立てと語の使い方'})
 u['title']='言葉の意味・文の組み立てを確かめる';u['skills']=list(dict.fromkeys(u['skills']+['GRAMMAR','IDIOM','PART_OF_SPEECH','DICTIONARY_USAGE','ANTONYM','MIMETIC_WORD']))
 # Map what each item actually exercises, instead of copying every unit tag.
 for key,u in units.items():
  for q in u['items']:
   if q.get('repairSkill'):continue
   if q['responseType']=='extraction':tags=['TEXT_EXTRACTION']
   elif key.startswith('K'):tags=['KANJI','VOCAB_CONTEXT']
   elif q['responseType']=='written':tags=['WRITTEN_EXPLANATION']+(['PHRASE_INTERPRETATION'] if key=='L07' else ['DATA_INTERPRETATION'] if key=='E06' else ['LITERARY_CHARACTER'] if key.startswith('L') else ['LOGIC_RELATION'])
   else:tags=['CONTENT_SELECTION']+(['LITERARY_CHARACTER'] if key.startswith('L') else ['LOGIC_RELATION'])
   if q['responseType']=='multi':tags+=['MULTI_SELECT']
   if q['responseType']=='order':tags+=['ORDER','CHRONOLOGY']
   if q['responseType']=='true-false':tags+=['TRUE_FALSE']
   if key=='E03':tags+=['BLANK_COMPLETION','CONJUNCTION']
   if key=='E06':tags+=['DATA_INTERPRETATION','NUMERIC_INFORMATION']
   if key=='L07':tags+=['PHRASE_INTERPRETATION','METAPHOR_INTERPRETATION']
   if key=='E07' and q['phase']=='mixed':tags+=['SENTENCE_INSERTION']
   q['skills']=list(dict.fromkeys(tags));q['revision']=max(3,q.get('revision',1))
  u['skills']=list(dict.fromkeys(t for q in u['items'] for t in q['skills']));u['revision']=3
 result['itemCount']=sum(len(u['items']) for u in units.values());result['contentSet']='rikkyo-original-practice-20260925-v3'
 result['contentReview']['status']='ANSWER_REVIEWED_PEDAGOGY_QA_PENDING';result['contentReview']['remaining']='Detailed distractor feedback, source-demand routing and end-to-end STEP/retention QA.'
 return result
