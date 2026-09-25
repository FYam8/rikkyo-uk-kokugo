# 立教英国学院 国語

FY24〜FY26 A/Bの過去問から弱点を見つけ、別素材の類題と翌日の定着確認へ進む学習アプリです。

公開状態の正本は [`metadata/release_gate.json`](metadata/release_gate.json)。公開先は `https://fyam8.github.io/rikkyo-uk-kokugo/` を予定しています。デプロイ成功を確認するまでは公開済みと扱いません。検索除外の `noindex,nofollow,noarchive` を維持します。

## 学習の進め方

1. FY25-Aで診断し、採点後に本文根拠と答案例を確認します。
2. 誤答分野の元問題を解き直し、STEP 1（基礎）、STEP 2（別素材への転用）、STEP 3（混合確認）を進めます。
3. 24時間後に定着確認を行い、次の過去問に進みます。不合格時は再学習し、新たに24時間空けます。
4. FY24-A → FY25-B → FY26-A → FY26-Bの順で確認します。FY26-Bは通常のToday・類題から外し、最後の専用入口から受験します。

試験・補強練習は途中保存できます。履歴はこのブラウザ内に保存されます。「設定」から書き出し／読み込みできます。端末変更やブラウザデータの削除前には書き出してください。リセットは確認後にこのアプリの履歴だけを消します。

## 問題・採点の根拠

- 見える142問すべてに固定ID、原本ページ、回答形式、出題要求を対応付けています。
- **141問はアプリによる検証済み参考解答、1問は REVIEW_REQUIRED**。学校公式解答ではありません。既存のFY25 A/B 63問は維持しています。
- FY26-B-III-Q01は正答を断定せず、採点・弱点判定から除外します。最終確認の得点は29問を分母とする非公式指標です。
- FY24-Bの大問I・IIは原本で著作権上省略されており、復元・採点しません。見える3問だけを追加練習として利用し、診断や完全試験とは扱いません。
- 記述・図表は答案例、本文根拠、必須要素を使う自己照合です。別表現を認め、完全一致やAI採点を必須にしません。
- 得点は親設問ごとに正規化した正答率です。公式の小問別配点ではありません。60%は[学校FAQ](https://www.rikkyo.co.uk/faq/)の目安、70%・75%はアプリ独自の安定・上積み目標です。合格保証はありません。

類題は**新規作成の24 unit・175問**（漢字10／文学7／説明7）。旧24-unit Bankは回収できていません。150問が通常学習、25問が翌日確認用です。範囲と限界は[類題の対応監査](docs/practice-coverage-review.md)に記載しています。

## 共通Engine

UI、Today、Resume、解答・採点の仕組み、弱点補強、STEP、履歴、Export/Import、PWAの枠組みは `FYam8/waseshibu-source` を唯一の上流とします。立教側は問題・解答根拠・類題・解説・弱点対応・学校設定を持ちます。

`upstream.lock.json` に固定したEngineを `tools/import_shared_engine.py` で学校adapterに適用し、`shared-engine/files.json` のハッシュで独自改変を検出します。Engineの修正は上流に反映してから取り込みます。早稲田の学校固有データは取り込みません。

## 開発と検証

```sh
npm ci
python tools/build_content.py
npm run build
node tools/validate_scaffold.mjs
python tools/test_authority_baseline.py
python tools/test_practice_bank.py
node tools/test_runtime_bank.mjs
python tools/verify_shared_snapshot.py
python tools/test_question_pages.py
python tools/validate_grading.py
python tools/check_public_artifact.py dist
npm install --no-save --package-lock=false playwright@1.55.0
npx playwright install chromium
python tools/run_clean_loops.py
```

ブラウザ監査は実際のChromiumで1280pxと390px（タッチエミュレーション）を操作します。翌日確認だけは時計を24時間進めます。2回のCLEAN結果と実行出力は `metadata/clean_loops.json` に保存します。CIも同じ操作を再実行します。

## 制約

参考解答の二系統確認は原本からの解き直しと制約・本文根拠の再確認であり、独立した二人の専門家による審査ではありません。学習効果の長期実測は未実施です。短い類題だけで入試長文の負荷を再現せず、次の過去問で確認します。

FY26-Bの解答ファイルは受験終了まで取得しませんが、静的ホスティングのためURLを意図的に調べる利用者に対するアクセス制御ではありません。オフラインでの全問題利用や端末間の自動同期は保証しません。検索除外は認証による非公開化ではありません。
