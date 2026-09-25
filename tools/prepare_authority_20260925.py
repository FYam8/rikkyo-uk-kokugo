"""Stage the 2026-09-25 answer candidates; never promote or alter the FY25 baseline."""
import json, hashlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def read(name): return json.loads((ROOT/name).read_text())
def write(name,value): (ROOT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

# Each row records two distinct checks: direct booklet evidence and an alternative
# solution/elimination/constraint check. These are two methods by one reviewer,
# not a claim of two independent human reviewers.
ROWS={
'FY24-A-I':[
(['イ','イ'],'頓着しない／口をへの字の文脈。','aは無関心。落ち着き・視覚・察知・嫌がらせではない。bは不機嫌。要求・落胆・反省は文脈不一致。'),
(['雁首','狐'],'雁首を揃える／狐につままれた。','人が揃う慣用句と、不可解で呆然とする慣用句を別々に再構成。'),
(['浮世絵','西画'],'川原が運んだ浮世絵と西洋画法の西画を対照。','設問の「と」の両側に本文の名称が入り、遠近・陰影は名称ではなく相違点。'),
('エ','人の顔・服を一様な色と線で描いていることを見直す。','アは描き方を既に理解したことになり不適。イは喜びの根拠なし。ウの捨てがたさも記述なし。'),
('エ','西画を御禁制と述べる親父にお栄が同意する場面。','アの奢侈、イの仏教、ウの裸の天使の風紀という説明は本文の焦点と異なる。'),
('西画の描き方が分からず、思うように描けない自分へのもどかしさ。','手先は動かせるはずなのに西画では手も足も出ない。','帰途に歩幅が縮む原因を描けない焦燥として再構成。納期だけの心配では不十分。'),
(['奥行','影','光景'],'本文の遠近、影、眼前の光景と囲み内の描写を照合。','a二字・b一字・c二字。aは画面の深さ、bは光の遮られた形、cは見た場面全体。'),
('イ','親父の仕事への誇り・納期厳守・世間の目に晒す覚悟を読む。','適当でない肢。アは誇り、ウは期限、エは批判を受ける覚悟として明記。イの画法の違いへの悔しさは当該場面の理由でない。'),
('オ','北斎工房・親父どのから人物を特定。','北斎は葛飾北斎。鶴屋・近松・井原・歌川は別の名。British MuseumのKatsushika Hokusai表記も照合。'),
(['4','5','1','3'],'2の注文→4の納期相談→5の外出→1の藤棚→3の客→6の完成画。','2と6は印刷済み。入力すべき四空欄のみを抽出し、三日前・翌朝・帰途の時間接続を確認。')],
'FY24-A-II':[
('ウ','サル類との比較なので対照。原本の対照の記号はウ。','ア対象は目標、イ対称はつりあう配置、エ対症は症状への対応。対照は比較で違いを際立たせること。参考PDFのイは記号誤り。'),
('c','aのないは存在しない、bは弱みがない、cはできない。','a/bは形容詞、cのみ動詞できるに付く打消の助動詞。'),
('手','二足歩行は、自由になった手で食物を運ぶ。','足は移動を担い、自由になる運搬器官ではない。漢字一字。'),
('仲間意識','共感の後に仲間意識を集団内で強化したと記される。','これより後の本文という範囲を満たす四字。「社会関係」は説明対象で共感の言換えでない。'),
('ウ','物語・定住・余剰食料から集団間争い・支配層・世界宗教へ。','不適当肢。言葉による世界の切分けは農耕以前に述べられる。ア/イ/エは農耕後の記述。'),
('社会の外に共通の敵を作り、敵意によって人々を団結させること。','社会外の敵と団結する仕組みを説明する段落。','外敵の設定→内部の団結の因果を再構成。戦争一般や宗教一般の説明に広げない。'),
('イ','自然の時間を人工の時間へ変えるという対比。','夜に自然な睡眠を抑えて昼の試験に合わせる。アは約束、ウは日照に沿う活動、エは無理のない旅程で焦点が違う。'),
('エ','前段の発展史を裏道としてまとめ、共感と科学技術の使用へ転換。','悲観だけではなく提案が続くのでア不可。事実との対比や新問題の詳細説明でないのでイ/ウ不可。'),
('弱みを強みに変える','人類進化の前半を導いた共感に満ちた社会。','九字。設問の「ことができたから」に接続できる述語を抜き出す。'),
(['自然の時間に沿った暮らし','共助の社会'],'最終段落の管理された時間からの解放とシェア、コモンズ。','各十五字以内。文明の批判ではなく提案される二つの社会のあり方を抽出。'),
('例えば、物品の貸し借りを仲介する情報技術は、各自が物を所有する量を減らし、必要な物を共同で利用する仕組みを支えられる。また、遠くの人とも映像で交流できる技術は、離れて暮らす人同士が助け合う機会を広げる。技術を競争や武力の強化ではなく、人々のつながりと共助を支えるために使うことが大切だ。','所有の削減・共助・科学技術の活用という本文の提案。','二百字以内の意見記述。技術の具体例と共助への因果が必要で、この例だけを唯一解としない。')],
'FY24-A-III':[
(['朗読','発芽','委','紛争','概','融資'],'ロウドク・ハツガ・ユダねる・フンソウ・オオムね・ユウシ。','読みへの逆変換と各文脈を再確認。送り仮名「ねる」「ね」は印刷済みで答えに重複させない。'),
(['留','帯','善','臨'],'留学/留守番/書留、熱帯/帯出/一衣帯水、改善/善後策/善行/善は急げ、臨機応変/臨時/君臨/海に臨む。','各空欄を全語に代入。読みの異なる語でも同じ漢字一字で成立。')],
'FY24-B-III':[
(['促','看護','威厳','抑圧','彼岸','契約'],'ウナガす・カンゴ・イゲン・ヨクアツ・ヒガン・ケイヤク。','各漢字から読みへ逆変換。促すの送り仮名は印刷済み。春分秋分側の彼岸であり悲願ではない。'),
(['高','座','端','葉'],'標高/乱高下/高速道路、高座ではなく座禅/居座る/銀行口座/座右の銘、先端/井戸端/中途半端/端を発する、紅葉/葉書/合言葉/根も葉もない。','各行の四用例へ代入して共通一字を照合。')],
'FY26-A-I':[
(['さいばし','はんも','ちまなこ'],'菜箸・繁茂・血眼の下線を読む。','料理器具、植物の茂り、必死に捜す慣用表現から読みを再確認。'),
(['確認','映像','著者','出典','大団円','破壊','光沢'],'カクニン/エイゾウ/チョシャ/シュッテン/ダイダンエン/ハカイ/コウタク。','照合すること・映像会社・論文著者・参考文献の出典・芝居の結末・環境破壊・磨いた光沢という別々の意味で再検証。')],
'FY26-A-II':[
(['ウ','キ','オ','イ'],'夏木書店は存知、自己満足、時代遅れ、宣戦布告。','戦線でなく宣戦、自己自慢でなく自己満足、流行遅れより時代遅れが成句に適合。'),
('想','予想もつかない。','予測の意味をもつ予想を漢字一字で補完。'),
(['ウ','ア','エ'],'不穏＝おだやかでない、気概＝強い意志、鷹揚＝ゆったり威厳。','不穏のイは「いそがないこと」で誤り。アかくさない/エはっきりしないも不適。気概は不快/覚悟/急ぐ態度でない。鷹揚は悪賢さ/傷つきやすさ/落着かなさでない。'),
({'1':[['エ','オ'],['サ','ス']],'2':{'partOfSpeech':'副詞','modifies':'ス'}},'機械音が―響き、カーテンが―開き始めた。やがては開き始めたを修飾。','何か低いは機械音への修飾。真っ赤なはカーテンへの修飾。壁を閉ざしていたはカーテンの連体修飾で主節の主述組合せではない。'),
({'1':'多数のビルの窓から無数の本が投げ捨てられている光景。','2':'ウ'},'窓の外の雪のようなものが本であり、本が捨てられていた。','1は比喩を使わず三十字以内。2はウのおそれと驚き。アの緊張と怒り、イの嘆きとあきらめ、エの納得となぐさめは異なる。'),
('イ','雪のような本、ビルが吹雪に見えるという文脈。','野原・花園・山脈は雪が舞う景観の喩えに合わない。'),
('ウ','売れた利益で本を増産し、売れ残りは捨てると社長が説明。','アは読む目的を誤る。イは紙束や自然へ戻す説明を事実にしている。エは林太郎の心情で社長の説明でない。'),
('山','毎日山の数ほど本を出版。','数の多さを表す「山ほど」を漢字一字で再構成。'),
('利益','多くの利益を積み上げ、社長の手が本を弄ぶ。','経済用語二字で本文から抜き出す。金銭一般や欲望でなく利益。'),
('エ','傍線部は「理解にツトめようとした」。努力して理解する意味で努。','努力が実を結ぶの努と一致。市役所に勤めるは勤、義務を務めるは務、勉学の勉は別字。'),
('惑','困惑と戸惑いの同一漢字。','両方へ代入して語を成立させる。'),
('ウ','社長の声と本が落ちる光景で思考が働かなくなる自分に、受付女性の言葉を重ねる。','原本のウは思考が働かなくなった林太郎に受付の言葉がいらだたしく感じられること。アはけがの危険を現実として認める説明、イは抵抗心の支え、エは社長の悪行を女性が告発する説明で、当該場面との照合が必要。'),
('本を消耗品とし利益を追求する社長に対し、二人は本を読むものとして大切にする心と、本そのものの価値を守ろうとしている。','社長の消費財説と、林太郎の「本は読むもの」を対照。','六十字以内。社長の考えと二人の守るものを双方含める。利益だけの否定では不十分。')],
'FY26-A-III':[
('エ','氷期は寒冷化→低地へ、間氷期は温暖化→高地へ。','ア/イは氷期温暖、ウは氷期高地となり逆。'),
(['ア','ウ','ウ','イ'],'Iは氷床形成の帰結、IIは浅い海峡の具体例、IIIは温暖化の具体例、IVは帰還の付加。','Iはそのため。II/IIIはたとえば。IVはもちろん。反対を表すしかしでは因果が切れる。'),
('イ','海面低下によって浅い海峡が陸橋となる。','USGSの最終氷期最大期約120～125m低下と選択肢20/100/200/300を照合し最も近い100を選択。正確に100mと断定はしない。'),
('地理的隔離','海峡形成で集団が移動できず分かれる現象。','本文の同じ説明語を漢字五字で照合。運命共同体とは別概念。'),
(['運命共同体','アジア','ベーリンジア'],'生き物の運命共同体ができる、数十万年前アジア中央部から、陸橋ベーリンジア。','a五字/b三字/c六字。ヒグマの移動経路を北米と北海道への二分岐で検証。'),
({'meaning':'2','explanation':'1は相手に行動を求める使い方、2は物事の進行を速める使い方。本文では温暖化が動物の移動・分散を進める意味。'},'原本に掲載された辞書の2の意味で移動・分散を促進。','温暖化には相手へ意志的に働きかける主体性がなく、意味1ではない。二つの用法の区別も必要。'),
('大陸内では温暖化によって北上や山地への移動・分散が進む一方、海面上昇で海峡ができると集団は隔離される。また、寒冷化は南下や避難地での隔離をもたらす一方、陸橋を形成して島と大陸などの間の移動・分散を可能にすること。','大陸/海峡/島/陸橋という場所の違いで同じ変動の効果が逆転。','温暖化と寒冷化の両方について、分散と隔離の対照を説明。字数上限は原本にないため創作しない。'),
(['ア','ウ'],'日本列島はフュージア。現生人類はベーリンジアを経てアメリカへ移動。','イは日本列島に氷床がないとの本文に反する。エは寒冷化と北上を逆転。オは全解明という過大な断定。')],
'FY26-B-I':[
('けいりゅう','渓流を下る。','谷川の流れという語義と読みを逆照合。'),
('へいそく','閉塞感。','閉ざされ塞がる状態。閉鎖へいさとは異なる。'),
('さく','牧場を柵で囲う。','囲う設備の柵。読みを文脈で再確認。'),
('幼','オサナい子。','幼いの送り仮名「い」は印刷済み。'),
('職務','ショクムに携わる。','職業上の務めで職務。職無ではない。'),
('香辛料','コウシンリョウを輸入。','香りと辛味を加える材料として三字を確認。'),
('頑固','ガンコな性格。','かたくなで意見を変えない意味。'),
('需要','ジュヨウと供給。','求められる量という対概念。受容ではない。'),
('輩出','有名な選手をハイシュツ。','優れた人を次々に出す意味。排出は不要物等を出す語。'),
('円熟','エンジュクの境地。','技術や人格が十分に熟達する語として確認。')],
'FY26-B-II':[
(['エ','イ','ア','オ','カ','ウ'],'沈黙をしつける、奇蹟の源泉、眼下の海、動転、口調、社会の縮図。','六語を重複なしで代入。空欄4は手紙の意外さに動転、5は発話の言い方に口調。'),
('西','ヨーロッパの最西端、西の果てる海。','ポルトガルのロカ岬という本文内地理と二箇所の同一漢字を照合。'),
(['ウ','ア','エ'],'買いかぶり＝過大評価、理不尽＝道理に合わない、丹精＝偽りのない真心。','買いかぶりは伝達や過小評価でない。理不尽は理想/夢/希望でない。丹精は知識/体力/周囲配慮だけでない。'),
('病気','梶井の手紙に北軽井沢の病院という記載。','しつこい悪魔は志穂子を長く苦しめる病気。手紙部分の漢字二字という指定を満たす。'),
('ひと言も言葉を交わさなかった','同じ病院にいたが会話もなかったという先行記述。','二十字以内で空欄後の「程度の関係」に文法的につながる。'),
('十八','実年齢二十四歳、内面のカレンダー六歳。','24−6=18。要求は漢数字二字なので十八。'),
('ウ','妹は姉の諦めを聞いて社会帰属ではなく生還という語を選ぶ。','アの嫌気や衝動、イの相談、エの自己嫌悪は根拠なし。励ましが当該語の目的。'),
('ウ','野菜に虚無・理不尽・怒り・悔しさを栽培する比喩。','美味/楽しい/哀しいだけでは否定的感情全体を捉えない。汚いものが適合。'),
('誤魔化したりは','義務にも慣れてあきらめを誤魔化したりはしてしまい。','あきらめを直接受ける文節を過不足なく抽出。してしまいは後続。'),
('病気は治らないと諦め、病気と闘う気力も失った自分も、栽培に執着して生きる患者と同じく、恨みや怒りなどの負の感情を、語る言葉に込めていると感じたから。','患者が野菜へ込めた感情と志穂子の言葉を対照する。','六十～九十字。病への諦めと負の感情の流出の対応を説明し、単なる野菜嫌いにしない。')],
'FY26-B-III':[
('ウ','赤い服の三人が数学好きだからと全員へ一般化する例。','アは数学との結び付きがなく、イは服の条件を失い、エは因果の向きが逆。'),
(['ウ','イ','オ'],'直感、客観、不変。','感/観/変の前に各漢字を代入して三熟語を再構成。'),
('限られたリソースや時間の中でよりよく判断をすること','丁寧な科学的検討より限られた条件内の判断が求められる。','二十五字を再計数し、設問の「を求められている」に接続。'),
('イ','他人からの情報で評価が変わることに当たらない例を選ぶ。','アは人気、ウは価格、エは支持という外部情報がある。イは時間経過で馴染む例。'),
('エ','ネットやSNSで中傷されるという用例。','アは冤罪、イは飽き、ウは遠慮のない発言一般。エの根拠なき名誉毀損が対応。'),
('当時はふくよかな体型が美しいとされ、現代の痩せた体型とは美の基準が異なっていたから。','一八九〇年代のリリアン・ラッセルと現代の基準を比較。','現在の人が誤っているという断定ではなく時代ごとの美の評価の変化を説明。'),
('基準','本文の「美の基準さえ他からの情報で書き換え」に対応。','原本は漢字二字。参考PDFの価値観は三字で不適合。スタンダードの意味と本文内の二字を再照合して基準へ修正。'),
('だけです。','自然に痩せるのは病気のときだけという文の後に長命データを置く。','健康と痩身の同一視を問い直す文脈を保つ。直前五字には句点を含み、だけです。で五字。'),
(['○','×','×','×'],'1は周囲の少数から全体への一般化、2は外集団バイアス、3は過去の美人と現代の可能性、4は柔軟さの効用。','2の「少ない」は頻出性に逆行。3は本文が将来について述べる仮定を現状の事実に変えている。4は流行を追えなくなるとの逆の説明。'),
('日本人学校でも、生徒の育った国や家庭、考え方は一様ではない。全寮制では生活習慣の違いが衝突につながることもあるため、自分の常識だけで相手を判断せず、まず理由を聞きたい。また、英国の人々との交流でも少数の経験を全体に当てはめず、話し合いながら互いに過ごしやすい方法を探すことが大切だ。','価値基準の変化と思考の柔軟性を英国の全寮制日本人学校に適用。','百～百八十字。英国/日本人学校/全寮制の条件と具体行動を含める。特定の意見への同調を正答条件にしない。')]
}

WRITTEN={
'FY24-A-I-Q06':(0,40,['西画の描き方が分からない','思うように描けない焦り・もどかしさ']),
'FY24-A-II-Q06':(0,50,['社会外に共通の敵を作る','内部の団結を作る']),
'FY24-A-II-Q11':(0,200,['科学技術の具体例','共助や所有削減へのつながり','自分の考えと根拠']),
'FY26-A-II-Q13':(0,60,['社長は本を消費財として利益を追求','二人は本を読むものとして大切にする']),
'FY26-A-III-Q07':(0,0,['同じ気候変動でも場所によって作用が異なる','大陸内の移動・分散','海峡による隔離と陸橋による移動の対照']),
'FY26-B-II-Q10':(60,90,['自分の病や運命への諦め','患者の野菜と自分の言葉との対応','恨みや怒りなどの負の感情']),
'FY26-B-III-Q06':(0,0,['当時のふくよかな美人像','時代で美の基準が異なる']),
'FY26-B-III-Q10':(100,180,['変化し得る価値基準と思考の柔軟性','英国・日本人学校・全寮制という条件','具体的行動や考えと理由'])
}

def main():
 authority=read('metadata/answer_authority.json');registry=read('metadata/structural_registry.json')
 baseline=read('metadata/verified_baseline.json')
 for r in authority['records']:
  if r['questionId'] not in baseline['records']:
   assert r['state']=='REVIEW_REQUIRED', 'Refusing to overwrite a subsequently promoted record: '+r['questionId']
 old={r['questionId']:r for r in authority['records'] if r['questionId'] in baseline['records']}
 assert len(old)==63
 for qid,r in old.items():assert hashlib.sha256(json.dumps(r,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()==baseline['records'][qid]
 qs={q['questionId']:q for e in registry['exams'] for s in e['sections'] for q in s['questions']}
 records=[]
 for prefix,rows in ROWS.items():
  for i,(answer,passa,passb) in enumerate(rows,1):
   qid=f'{prefix}-Q{i:02}';q=qs[qid];exam='-'.join(prefix.split('-')[:2]);section=prefix.split('-')[2]
   r={'questionId':qid,'examId':exam,'sectionId':section,'sourcePage':q['sourcePage'],'state':'APP_DERIVED_VERIFIED','official':False,'answerKind':q['responseType'],'answer':answer,'sourceEvidence':{'sourcePages':[q['sourcePage']],'contextBrief':passa},'checks':[{'checkId':qid+':check1','kind':'source-context-pass','result':'PASS','detail':passa},{'checkId':qid+':check2','kind':'alternative-solution-and-constraints','result':'PASS','detail':passb}],'reviewedAt':'2026-09-25','reviewMethod':'two-method-same-reviewer','candidateSource':'Rikkyo_Japanese_Answers_FY24-FY26_AB.pdf (unofficial)'}
   if qid in WRITTEN:
    lo,hi,elements=WRITTEN[qid];r.pop('answer');r['answerKind']='written';r['modelAnswer']=answer
    r['constraints']={'modelCharacterCount':len(answer)}
    if lo:r['constraints']['minCharacters']=lo
    if hi:r['constraints']['maxCharacters']=hi
    assert not lo or len(answer)>=lo
    assert not hi or len(answer)<=hi
    r['rubric']={'requiredElements':elements,'acceptableVariants':['同じ本文根拠と意味を保つ別表現を許容。意見問題では異なる具体例・立場も根拠と条件を満たせば許容。'],'gradingMode':'manual-element-comparison','exactMatchRequired':False}
   records.append(r)
 assert len(records)==78
 # The graph is a separate parent question, with evidence transcribed from its table.
 graph={'questionId':'FY24-B-IV-Q01','examId':'FY24-B','sectionId':'IV','sourcePage':6,'state':'APP_DERIVED_VERIFIED','official':False,'answerKind':'written','modelAnswer':'三か国とも署名、デモ、座り込みの順に許容度が低くなる。代表性・有効性を高く評価し、秩序不安が少ない人ほど許容度が高い。日本はどの運動でも代表性・有効性の高低による差が三か国で最も小さい。署名では代表性・有効性の各区分で日本が最も高いが、秩序不安の少ない層では最も低い。デモは各区分でドイツより低く韓国より高い。座り込みは代表性・有効性の高い層では最も低く、低い層では韓国より高い。','constraints':{'wordLimitSpecified':False},'rubric':{'requiredElements':['三か国共通の運動別許容度の順序','代表性・有効性・秩序不安と許容度の関係','日本の特徴を運動別・区分別に説明','参加率でなく許容度とする'],'acceptableVariants':['すべての数字の列挙は不要。正しい共通傾向と日本独自の特徴を区分を明示して説明する。'],'gradingMode':'manual-element-comparison','exactMatchRequired':False},'sourceEvidence':{'sourcePages':[6],'tableRows':{'日本':[93.6,78.1,94.8,71.9,84.3,83.4,49.5,42.9,60.1,29.3,53.0,40.4,22.0,20.7,30.2,12.1,28.3,17.2],'韓国':[93.0,66.8,92.3,66.9,86.3,80.7,42.1,19.5,45.7,11.6,38.7,29.3,30.5,7.9,31.5,5.0,27.8,17.0],'ドイツ':[90.3,59.1,91.3,61.1,91.0,74.3,80.1,45.5,82.8,41.7,80.8,62.6,51.4,27.3,53.2,25.0,52.3,38.5]}},'checks':[{'checkId':'FY24-B-IV-Q01:check1','kind':'source-table-pass','result':'PASS','detail':'原本6ページの表の54値と見出しを目視で照合。割合は許容度。'},{'checkId':'FY24-B-IV-Q01:check2','kind':'independent-numeric-comparison','result':'PASS','detail':'各列の国順位と高低差を算出。日本の代表性/有効性の差は三運動とも最小。秩序不安の差は署名のみ最小。'}],'reviewMethod':'two-method-same-reviewer','reviewedAt':'2026-09-25'}
 vals=graph['sourceEvidence']['tableRows'];j,k,g=[vals[x] for x in ['日本','韓国','ドイツ']]
 for v in vals.values():
  for col in range(6):assert v[col]>v[col+6]>v[col+12]
  for col in range(0,18,2):assert v[col]>v[col+1]
 for col in [0,2,6,8,12,14]:assert j[col]-j[col+1]<min(k[col]-k[col+1],g[col]-g[col+1])
 for col in range(6,12):assert g[col]>j[col]>k[col]
 records.append(graph)
 # Source schema corrections preserve every parent ID.
 for qid,count in {'FY26-A-II-Q01':4,'FY26-A-III-Q02':4,'FY26-B-II-Q01':6,'FY26-A-III-Q08':2,'FY24-A-I-Q10':4}.items():qs[qid]['partCount']=count
 qs['FY26-B-III-Q09']['responseType']='true-false'
 qs['FY26-A-III-Q06']['responseType']='written'
 for r in records:
  if r['questionId']=='FY26-A-II-Q04':
   r['answerKind']='parts-rubric'
   r['parts']=[{'label':'(1)','answer':[['エ','オ'],['サ','ス']],'unorderedPairs':True,'parentCredit':0.5},{'label':'(2)','answer':['副詞','ス'],'parentCredit':0.5}]
   r['rubric']={'requiredElements':['主語と述語の二組を正しく対応させる','やがては副詞','修飾先は開き始めた（ス）'],'acceptableVariants':['二組の記入順は問わない。主語と述語の対応は維持する。'],'exactMatchRequired':False,'gradingMode':'manual-element-comparison'}
  if r['questionId']=='FY26-A-II-Q05':
   r['answerKind']='parts-rubric'
   r['parts']=[{'label':'(1)','modelAnswer':r['answer']['1'],'constraints':{'maxCharacters':30},'parentCredit':0.5,'rubric':{'requiredElements':['ビルの窓から','多数の本が投げ捨てられる'],'forbiddenFigurativeExpressions':['吹雪','雪','荒野']}},{'label':'(2)','answer':'ウ','parentCredit':0.5}]
   assert len(r['answer']['1'])<=30
  if r['questionId']=='FY26-A-III-Q06':
   r['answerKind']='parts-rubric'
   r['parts']=[{'label':'意味','answer':'2','parentCredit':0.5},{'label':'使い分け','modelAnswer':r['answer']['explanation'],'parentCredit':0.5,'rubric':{'requiredElements':['1は人に働きかけ行動を求める','2は物事の進行を速める','本文は移動・分散の進行を促進する意味']}}]
  if r['questionId']=='FY26-B-III-Q07':r['candidateCorrection']={'from':'価値観','to':'基準','reason':'原本は漢字二字指定。本文の美の基準と対応。'}
  if r['questionId']=='FY24-A-II-Q01':r['candidateCorrection']={'from':'イ','to':'ウ','reason':'対照の選択肢記号はウ。イは対称。'}
  if r['questionId']=='FY26-A-II-Q03':r['candidateCorrection']={'from':['イ','ア','エ'],'to':['ウ','ア','エ'],'reason':'不穏の意味はウ「おだやかでないこと」。'}
 # Initial visual/constraint checks are review notes, not a completed independent audit.
 for r in records:
  r['state']='REVIEW_REQUIRED'
  r['reviewBlocker']='Recheck the complete source, distractors, extraction constraints and rubric in a fresh pass before promotion.'
  for check in r['checks']:check['result']='REVIEW_REQUIRED'
 verified=set(old)|{r['questionId'] for r in records if r['state']=='APP_DERIVED_VERIFIED'}
 for qid,q in qs.items():q['authorityStatus']='app-derived-verified' if qid in verified else 'review-required'
 authority['records']=list(old.values())+records
 authority['unavailableSections']=[{'sectionId':'FY24-B-I','state':'UNAVAILABLE_SOURCE','questionCount':None},{'sectionId':'FY24-B-II','state':'UNAVAILABLE_SOURCE','questionCount':None}]
 authority['reviewMethodNote']='2026-09-25 additions are provisional review notes from a single model reviewer. Neither note constitutes a completed independent PASS. All 79 additions remain REVIEW_REQUIRED and must be excluded from scoring.'
 write('metadata/answer_authority.json',authority);write('metadata/structural_registry.json',registry)
 progress=read('metadata/mapping_progress.json');progress.update(updatedAt='2026-09-25',answerAuthorityResolved=len(verified),answerAuthorityPending=142-len(verified),unavailableSectionCount=2)
 progress['gates'].update(answerScoringAuthority='PARTIAL_WITH_EXPLICIT_REVIEW_REQUIRED',publicDeploy='HOLD')
 write('metadata/mapping_progress.json',progress)
 print('verified',len(verified),'review',142-len(verified),'unavailable sections',2)

if __name__=='__main__':main()
