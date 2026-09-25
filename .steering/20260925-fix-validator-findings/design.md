# 設計書

## アーキテクチャ概要

リファクタリングとドキュメントの修正のみ。レイヤーの構成、公開している関数の名前・引数・戻り値、画面の見た目と動作は変えない。

分割は、既存の `timeline-view.js` → `src/ui/timeline/` と同じやり方で行う。

```
変更前                               変更後
css/style.css (323行)               css/style.css          (ページ全体・タイムライン・結果)
                                    css/person-input.css   (入力欄の部品)

src/ui/person-input.js (324行)      src/ui/person-input.js           (状態と操作。createPersonInput)
                                    src/ui/person-input/elements.js  (要素の作成)
                                    src/ui/person-input/messages.js  (状態表示の文言と0件のときの選択)

comparePeople (55行)                comparePeople           (判定不可・生年不明の振り分け)
                                    compareKnownLifespans   (生年がわかる2人の重なり・空白期間)
                                    orderByBirth            (先に生まれた人物・後に生まれた人物の決定)
```

## コンポーネント設計

### 1. `src/data/wikidata-client.js`([推奨-1])

- `searchPeople` の JSDoc の `@returns` を「最大7件。人間かつ生年または没年を持つ人物のみ。検索結果の順を保つ」に直す
- 処理は変えない

### 2. `css/person-input.css`(新規、[推奨-3])

**責務**:
- `person-input.js` が作る入力欄の部品(`.person-input` で始まるクラス)のスタイル

**実装の要点**:
- `css/style.css` の「入力欄」のセクションのうち、`.person-input`、`.person-input-field` 〜 `.person-input-status:empty` をそのまま移す(約120行)
- 次はページの配置なので `css/style.css` に残す
  - `.person-inputs`(`index.html` の入力欄を並べる領域)
  - PC向けの `@media` 内の `.person-inputs`、`.person-input-slot`
- 色・サイズのCSS変数(`:root`)は `css/style.css` に置いたまま、`person-input.css` から参照する
- `index.html` で `css/style.css` の次に `<link rel="stylesheet" href="css/person-input.css">` を読み込む。CSPは `style-src 'self'` のため変更不要
- `@import` は使わない(読み込みが直列になり、表示が遅くなるため)
- 移したあとも、セレクタの詳細度と記述の順序は変わらないため、見た目は変わらない

### 3. `src/ui/person-input/`(新規、[推奨-3])

**`elements.js`**

**責務**: 入力欄1つ分のDOM要素の作成

**実装の要点**:
- `person-input.js` から `createElements(options)` と `createOptionElement(person, optionId)` をそのまま移し、`export` する
- `formatLifespan`(`src/logic/years.js`)の import も一緒に移す
- `PersonInputOptions` の型定義は `person-input.js` に残し、`elements.js` から JSDoc の `import()` で参照する

**`messages.js`**

**責務**: 入力欄の状態表示の文言と、0件のときの文言の選択

**実装の要点**:
- 定数 `MESSAGE_SEARCHING`、`MESSAGE_NOT_FOUND`、`MESSAGE_NOT_FOUND_SHORT_QUERY`、`SHORT_QUERY_LENGTH`、`MESSAGE_FETCH_ERROR` と関数 `notFoundMessageOf(query)` を移す
- `person-input.js` で使う `MESSAGE_SEARCHING`、`MESSAGE_FETCH_ERROR`、`notFoundMessageOf` を `export` する。`MESSAGE_NOT_FOUND` などは内部でのみ使うため `export` しない
- DOMに触れない。ただしUIの文言なのでロジックレイヤーには置かない(UIレイヤーのテスト対象外の方針どおり、ユニットテストは書かない)

**`person-input.js`**

- `DEBOUNCE_MS`、`MAX_QUERY_LENGTH` と `createPersonInput` は残す
- `./person-input/elements.js` と `./person-input/messages.js` を import する
- 分割後は約200行になる

**依存ルール**: `docs/repository-structure.md` の「部品を分割したサブディレクトリは、その部品と同じサブディレクトリ内のファイルからのみ import してよい」に従う。`src/ui/person-input/` のファイルを import するのは `person-input.js` だけにする

### 4. `src/logic/comparison.js`([推奨-4])

**責務**: 変わらない(`comparePeople` の戻り値も同じ)

**実装の要点**:
- `orderByBirth(a, b, currentYear)`: 2人の生存期間を計算し、先に生まれた順に `{ elder, younger, elderSpan, youngerSpan }` を返す。同じ年に生まれた場合は `a` を先にする(現在の `<=` の比較を保つ)
- `compareKnownLifespans(a, b, currentYear, approximate)`: 現在の `comparePeople` の「生存期間を計算」以降(空白期間または重なりの計算)を移す
- `comparePeople(a, b, currentYear)`: `approximate` の計算、判定不可・生年不明の振り分けのあと、`compareKnownLifespans` を呼ぶ
- 3関数とも40行以内。どれも `export` しない内部関数(`comparePeople` 以外)

### 5. `src/data/person-parser.js`([提案-1])

- `parsePerson` の生年不明の分岐のコメントに、「没年も『不明な値』(somevalue)の場合は、タイムラインに線を引けないため除外する」ことを書き足す
- 処理は変えない

## テスト戦略

### ユニットテスト
- 追加: `tests/unit/data/wikidata-client.test.js` に「生年不明で没年がある人物(卑弥呼)も候補に含める」テストを1件追加する([提案-3])
  - `stubFetch` で検索結果に `Q234451` を返し、詳細取得に `tests/fixtures/Q234451-himiko.json` を返す
  - 候補に卑弥呼が含まれ、`birth` が `null`、`death` が `{ year: 248, precision: 'year' }` であることを確認する
- 既存: `comparison.test.js` がそのまま通ることで、`comparePeople` の分割で結果が変わらないことを確認する
- `src/ui/` と CSS はユニットテストの対象外

### 手動テスト(ブラウザ、キャッシュを無効化して再読み込み)
- 入力欄: 見た目(色の丸、枠、フォーカス時の枠線、×ボタン)がスマホ幅・PC幅とも分割前と同じ
- 候補一覧: 表示、別名、説明、キーボード操作(↑↓・Enter・Esc)、クリック
- 状態表示: 「検索中…」、0件、短い入力の案内(「紫」)
- クリア、2人を選んだあとのタイムラインと結果の文章
- 開発者ツールのコンソールにエラーがない(CSSとモジュールの読み込み失敗がない)

## 依存ライブラリ

なし。

## ディレクトリ構造

```
index.html                              (変更: person-input.css の読み込み)
css/style.css                           (変更: 入力欄の部品のスタイルを移す)
css/person-input.css                    (新規)
src/ui/person-input.js                  (変更)
src/ui/person-input/elements.js         (新規)
src/ui/person-input/messages.js         (新規)
src/logic/comparison.js                 (変更)
src/data/wikidata-client.js             (変更: JSDoc)
src/data/person-parser.js               (変更: コメント)
tests/unit/data/wikidata-client.test.js (変更: テスト追加)
docs/architecture.md                    (変更: ファイル数の記述)
docs/repository-structure.md            (変更: 構成図、css/ と src/ui/ の説明、ファイルサイズの管理)
docs/development-guidelines.md          (変更: CSSのファイルの記述)
docs/functional-design.md               (変更: person-input.js の依存関係など、必要な箇所)
README.md                               (変更: 構成)
```

## 実装の順序

1. 小さな修正(JSDoc、コメント、architecture.md)
2. テストの追加(`searchPeople` の生年不明)
3. `comparePeople` の分割 → ユニットテスト
4. `person-input.js` の分割 → 構文チェック
5. CSSの分割
6. 永続ドキュメントと README の更新
7. 全体のテスト・構文チェック・行数と依存ルールの確認、手動テスト

## セキュリティ考慮事項

- CSSを別ファイルにしても `style-src 'self'` の範囲内。インラインのスタイルは使わない
- DOMの作成方法(`createElement`・`textContent`)は変えない

## パフォーマンス考慮事項

- ファイルが3つ増える(CSS 1、JavaScript 2)。どれもHTTP/2で並行して読み込まれ、合計の転送量はほぼ変わらない(約61KB。上限100KB)
- `css/person-input.css` は `<link>` で読み込み、`@import` による直列の読み込みを避ける

## 将来の拡張性

- 入力欄の文言は `messages.js` に集まるため、文言の追加・変更や、将来のユニットテストの対象化がしやすくなる
