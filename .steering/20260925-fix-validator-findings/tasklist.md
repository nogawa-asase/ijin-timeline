# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

### タスクスキップが許可される唯一のケース
以下の技術的理由に該当する場合のみスキップ可能:
- 実装方針の変更により、機能自体が不要になった
- アーキテクチャ変更により、別の実装方法に置き換わった
- 依存関係の変更により、タスクが実行不可能になった

スキップ時は必ず理由を明記:
```markdown
- [x] ~~タスク名~~（実装方針変更により不要: 具体的な技術的理由）
```

---

## フェーズ1: 小さな修正

- [x] `src/data/wikidata-client.js` の `searchPeople` の `@returns` を「人間かつ生年または没年を持つ人物のみ」に直す([推奨-1])
- [x] `src/data/person-parser.js` の生年不明の分岐に、没年が「不明な値」の人物も除外する理由をコメントで書く([提案-1])
- [x] `docs/architecture.md` の「9ファイル程度に留める」を、ファイル数に頼らない書き方に直す([推奨-2])

## フェーズ2: テストの追加

- [x] `tests/unit/data/wikidata-client.test.js` に「生年不明で没年がある人物(卑弥呼)も候補に含める」テストを追加する([提案-3])
- [x] `node --test 'tests/**/*.test.js'` で追加したテストが成功する

## フェーズ3: `comparePeople` の分割([推奨-4])

- [x] `orderByBirth(a, b, currentYear)` を追加する
- [x] `compareKnownLifespans(a, b, currentYear, approximate)` を追加し、重なり・空白期間の計算を移す
- [x] `comparePeople` を振り分けだけにする
- [x] `comparison.js` のすべての関数が40行以内であることを確認する
- [x] `node --test 'tests/**/*.test.js'` が成功する

## フェーズ4: `person-input.js` の分割([推奨-3])

- [x] `src/ui/person-input/messages.js` を作り、状態表示の文言と `notFoundMessageOf` を移す
- [x] `src/ui/person-input/elements.js` を作り、`createElements` と `createOptionElement` を移す
- [x] `src/ui/person-input.js` から移した部分を消し、2つのファイルを import する
- [x] `node --check` で3ファイルに構文エラーがないことを確認する

## フェーズ5: CSSの分割([推奨-3])

- [x] `css/person-input.css` を作り、`.person-input` 〜 `.person-input-status:empty` のスタイルを移す(`.person-inputs` と `@media` 内は `style.css` に残す)
- [x] `index.html` で `css/style.css` の次に `css/person-input.css` を読み込む

## フェーズ6: 永続ドキュメントとREADMEの更新

- [x] `docs/repository-structure.md` を更新する
  - [x] プロジェクト構造の図に `css/person-input.css` と `src/ui/person-input/` を追加する
  - [x] `css/` の配置ファイルの説明を更新する(「MVPでは1ファイル」を直す)
  - [x] `src/ui/` の配置ファイルに `person-input/` を追加する
  - [x] ファイルサイズの管理に、`person-input.js` と `style.css` を分割したことを書く
- [x] `docs/development-guidelines.md` のCSSの「ファイル」の記述を更新する
- [x] `docs/functional-design.md` の `person-input.js` の説明を、分割後の構成に合わせる(必要な箇所のみ)
- [x] `README.md` の構成を更新する

## フェーズ7: 品質チェックと検証

- [x] `node --test 'tests/**/*.test.js'` がすべて成功する(112件)
- [x] `node --check` で `src/` のすべてのJavaScriptに構文エラーがない
- [x] 分割後の各ファイルが300行以下であることを `wc -l` で確認する(style.css 203行、person-input.css 121行、person-input.js 214行、elements.js 99行、messages.js 22行)
- [x] `grep` で import を確認し、依存ルールの違反がない(`src/ui/person-input/` を import しているのは `person-input.js` だけ)
- [x] ブラウザで手動テストする(ユーザーに依頼。キャッシュを無効化して再読み込み。2026-09-25 ユーザー確認済み)
  - [x] 入力欄の見た目がスマホ幅・PC幅とも分割前と同じ
  - [x] 候補一覧(別名・説明の表示、↑↓・Enter・Esc、クリック)
  - [x] 「検索中…」、0件、「紫」で短い入力の案内
  - [x] クリア、2人を選んだあとのタイムラインと結果の文章
  - [x] 開発者ツールのコンソールにエラーがない(分割による読み込みエラーはなし。開発者ツールの「問題」タブに、分割前からある指摘が2件出た。下の追加タスクを参照)

### 手動テストで見つかった指摘への対応(追加)

- [x] 入力欄(`<input>`)に `id` を付ける(「A form field element should have an id or name attribute」への対応)
  - [x] `src/ui/person-input/elements.js` の `createElements` で ``inputEl.id = `person-input-text-${slotNumber}` `` を設定する
  - [x] `node --check` と `node --test` が成功する
  - [x] ブラウザで開発者ツールの「問題」タブからこの指摘が消えたことを確認する(ユーザーに依頼。2026-09-25 ユーザー確認済み)
- [x] ~~CSPが `/.well-known/appspecific/com.chrome.devtools.json` をブロックする件に対応する~~(対応不要: Chromeの開発者ツールがlocalhostで自動的に要求するファイルで、アプリの通信ではない。`connect-src` をWikidataに限る設計どおりのブロックで、公開ページの利用者には影響しない。CSPを緩めると防御が弱まるため変更しない)

## フェーズ8: 振り返り

- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-09-25

### 計画と実績の差分

**計画と異なった点**:
- `docs/architecture.md` の「9ファイル程度」は、ファイル数を書き直すのではなく「レイヤーと部品の単位に分け、300行の目安を超えたら分割する。import の階層を深くしない」という考え方の記述に置き換えた。分割のたびに数字が古くなるのを避けるため
- CSSの分割で、入力欄のスタイルが `style.css` の後ろ(タイムライン・結果・`@media` より後)で読み込まれる順序になった。`style.css` の入力欄より後ろには他の部品のクラスセレクタしかなく、同じ要素に当たるルールがないため、見た目は変わらないことを確認してから進めた
- 入力欄を並べる配置(`.person-inputs`、`.person-input-slot`)は `index.html` の要素なので `style.css` に残し、`person-input.js` が作る部品のスタイルだけを移した

**新たに必要になったタスク**:
- 入力欄(`<input>`)への `id` の追加。手動テストで開発者ツールの「問題」タブに「A form field element should have an id or name attribute」が出たため。分割前からある指摘で、1行の変更で直せるため、ユーザーと相談してこのブランチで対応した。フォームとして送信しないため `name` は付けず、候補一覧と同じ命名(`person-input-text-{番号}`)の `id` だけを付けた

**技術的理由でスキップしたタスク**:
- CSPが `/.well-known/appspecific/com.chrome.devtools.json` をブロックする件
  - スキップ理由: Chromeの開発者ツールがlocalhostで自動的に要求するファイルで、アプリの通信ではない。`connect-src` をWikidataに限る設計どおりのブロックで、公開ページの利用者には影響しない
  - 代替実装: なし(CSPを緩めると防御が弱まるため変更しない)

### 学んだこと

**技術的な学び**:
- 既存の分割の前例(`src/ui/timeline/`)があったため、`person-input/` の分割はファイル名・先頭コメント・依存ルールをそろえるだけで済み、設計の判断がほとんど要らなかった
- CSSを別ファイルにすると読み込み順が変わる。移す前に「後ろに残るルールが同じ要素に当たらないか」を確認すれば、ブラウザで比べる前に見た目が変わらないと判断できる
- 関数の分割(`comparePeople`)は、既存のユニットテストが網羅的だったため、テストを変えずに安全に行えた

**プロセス上の改善点**:
- `implementation-validator` の指摘を手元で確かめてから(JSDocの記述、行数、ファイル数)対応範囲をユーザーと決めたため、計画の前提がずれなかった
- 手動テストで、開発者ツールの「問題」タブも確認対象になった。コンソールのエラーだけでなく、アクセシビリティやフォームの指摘も拾える

### 次回への改善提案
- 手動テストのチェックリスト(`docs/manual-test-checklist.md`)に「開発者ツールの『問題』タブに、アプリ起因の指摘がない」ことを加えると、今回のような指摘を早く見つけられる
- 既存の長い行(`person-parser.js:64`、`timeline-view.js:22`・`51`)が100文字の目安をわずかに超えている。次にそのファイルを触るときに合わせて直す
