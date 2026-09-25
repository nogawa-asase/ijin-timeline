# 開発ガイドライン (Development Guidelines)

本プロジェクトは個人開発で、「一番簡素な構成」を方針とする(`docs/architecture.md`)。規約はツールで強制せず、本ドキュメントとコードレビュー(セルフレビュー・Claude Codeによるレビュー)で守る。

## コーディング規約

### 基本方針

- ブラウザがそのまま実行できる素のJavaScript(ES2022、ES Modules)で書く
- ビルド・トランスパイルが必要な書き方(TypeScript、JSX、`import` の拡張子省略、npmパッケージの `import`)はしない
- `'use strict'` は書かない(ES Modulesは常にstrictモード)

### 命名規則

#### 変数・関数

```javascript
// ✅ 良い例
const elderBirthYear = representativeYear(elder.birth);
function formatYearValue(yearValue) { }
const isLiving = person.lifeStatus === 'living';

// ❌ 悪い例
const y1 = rep(p.b);
function fmt(v) { }
const living = person.lifeStatus === 'living';
```

**原則**:
- 変数: camelCase、名詞または名詞句
- 関数: camelCase、動詞で始める(`format`、`parse`、`render`、`create`、`compare`、`search` など)
- 定数(モジュールのトップレベルで固定の値): UPPER_SNAKE_CASE
- Boolean: `is`、`has`、`should` で始める
- DOM要素を持つ変数: 末尾に `El` を付ける(`inputEl`、`listboxEl`)。SVG要素は `svg` / `[名前]Svg` でもよい

**プロジェクト固有の命名**:

| 概念 | 命名 | 補足 |
|------|------|------|
| 歴史的な西暦年(0年なし) | `year` / `[何の]Year` | 例: `birthYear` |
| 天文学的年(計算用) | `astroYear` / `[何の]AstroYear` | 歴史的年と混同しないよう必ず `astro` を付ける |
| 年と精度の組 | `yearValue` | `YearValue` 型 |
| 現在の年 | `currentYear` | 必ず引数で受け取る |
| WikidataのID | `id` / `wikidataId` | 例: `"Q171411"` |

#### 型(JSDoc)

```javascript
// 型名: PascalCase、名詞
/** @typedef {'deceased'|'living'|'unknown'} LifeStatus */

/**
 * @typedef {Object} Person
 * @property {string} id
 * @property {string} label
 * ...
 */
```

- 型は、その型を主に作るモジュールで `@typedef` を定義する(例: `Person` は `person-parser.js`、`YearValue` は `years.js`)
- 他のファイルから使うときは `@param {import('../data/person-parser.js').Person} person` の形で参照する

### 関数設計

- **1関数1責務**。目安は1関数40行以内
- **ロジックレイヤーは純粋関数**にする。引数だけから結果を決め、引数を書き換えない
- **現在時刻をモジュール内で取得しない**。`currentYear` は `app.js` で `new Date().getFullYear()` を1回取得して渡す(テストで年を固定するため)
- **公開するものだけ `export`** する。モジュール内部の補助関数は `export` しない
- **名前付きexport** を使い、`export default` は使わない(`import` 時の名前を統一するため)

```javascript
// ✅ 良い例: 純粋関数、currentYearを引数で受け取る
export function comparePeople(a, b, currentYear) {
  const aEndAstroYear = endAstroYear(a, currentYear);
  // ...
}

// ❌ 悪い例: 内部で現在時刻を取得している
export function comparePeople(a, b) {
  const currentYear = new Date().getFullYear();
  // ...
}
```

### コードフォーマット

- **インデント**: 2スペース
- **行の長さ**: 最大100文字を目安
- **文字列**: シングルクォート `'`。値を埋め込むときはテンプレートリテラル
- **セミコロン**: 付ける
- **比較**: `===` / `!==` を使い、`==` は使わない
- **変数宣言**: `const` を基本とし、再代入が必要なときだけ `let`。`var` は使わない
- **文字コード・改行**: UTF-8、LF。ファイル末尾に改行を1つ入れる

```javascript
const TIMEOUT_MS = 10_000;

export function formatYearValue(yearValue) {
  const { year, precision } = yearValue;
  const prefix = year < 0 ? '前' : '';

  if (precision === 'century') {
    return `${prefix}${centuryOf(year)}世紀頃`;
  }
  // ...
}
```

### コメント規約

**公開する関数には JSDoc を書く**(引数・戻り値・投げる例外):

```javascript
/**
 * 2つの歴史的年の差(年数)を返す。西暦に0年がないことを考慮する。
 *
 * @param {number} fromYear  開始年(紀元前は負数)
 * @param {number} toYear    終了年(紀元前は負数)
 * @returns {number} 年数(例: yearsBetween(-4, 30) === 33)
 */
export function yearsBetween(fromYear, toYear) {
  return toAstronomical(toYear) - toAstronomical(fromYear);
}
```

**インラインコメントは「なぜ」を書く**:

```javascript
// ✅ 良い例: なぜそうするかを説明
// 古い応答が後から届いて候補を上書きしないよう、前の検索を中断する
currentController?.abort();

// ❌ 悪い例: コードを見ればわかる
// abortを呼ぶ
currentController?.abort();
```

- コメントは日本語で書く
- Wikidataのプロパティ番号には意味を添える(`// P569: 生年月日`)

### エラーハンドリング

**原則**:
- 予期されるエラー(通信失敗・タイムアウト)は専用のエラークラスで表し、UIレイヤーで利用者向けのメッセージに変換する
- 検索の中断(`AbortError`)はエラーとして扱わず、何もしない
- Wikidataのデータの欠落・不正は例外にせず、`null` を返して「データなし」として扱う(機能設計書のエラーハンドリング参照)
- エラーを握りつぶさない。想定外のエラーは `console.error` に出したうえで、利用者には通信エラーと同じメッセージを表示する

```javascript
// src/data/wikidata-client.js
export class WikidataError extends Error {
  /**
   * @param {string} message
   * @param {{ cause?: unknown }} [options]
   */
  constructor(message, options) {
    super(message, options);
    this.name = 'WikidataError';
  }
}
```

```javascript
// src/ui/person-input.js
try {
  const people = await searchPeople(query, currentYear, controller.signal);
  showCandidates(people);
} catch (error) {
  if (error.name === 'AbortError') {
    return; // 新しい入力で中断された。表示は新しい検索に任せる
  }
  if (!(error instanceof WikidataError)) {
    console.error('想定外のエラー:', error);
  }
  showMessage('データを取得できませんでした。時間をおいて試してください');
}
```

### DOM操作・セキュリティ

- 外部から来た文字列は `textContent` で設定する。`innerHTML`・`insertAdjacentHTML`・`outerHTML`・`eval`・`new Function` は使わない
- 要素の作成は `document.createElement` / `document.createElementNS`(SVG)で行う
- SVGの名前空間は定数にまとめる: `const SVG_NS = 'http://www.w3.org/2000/svg';`
- スタイルはCSSのクラスで指定する。CSPのため `style` 属性を文字列で設定しない(`element.setAttribute('style', ...)` は不可)。SVGの位置・色は `x`、`fill` などの属性で指定する
- URLのパラメータは `URLSearchParams` で組み立てる

### アクセシビリティ

- 新しいUI部品を作るときは、`docs/functional-design.md` の「UI設計 > アクセシビリティ」に定めたWAI-ARIAのパターン(`role`、`aria-live`、`aria-label` など)に従う
- クリックできる要素は `<button>` など本来の要素で作り、`<div>` にクリックイベントを付けない(キーボードで操作できなくなるため)
- 実装後、マウスを使わずTabキー・上下キー・Enter・Escだけで比較まで操作できることを確認する

### CSS

- **ファイル**: MVPでは `css/style.css` の1ファイル(分割の基準は `docs/repository-structure.md`)
- **クラス名**: kebab-caseで、部品名を先頭に付ける(例: `.person-input`、`.person-input-clear`、`.timeline-axis`、`.result-text`)
- **JavaScriptからの参照**: JavaScriptで要素を探すときもクラス名を使う。状態は `is-` で始まるクラスで表す(例: `.is-active`、`.is-loading`)
- **色・サイズ**: ファイル先頭の `:root` にCSS変数としてまとめる(例: `--color-person-1: #0072B2;`)。人物の線の色は `docs/functional-design.md` のカラーコーディングに従う
- **画面幅の切り替え**: 切り替え点は600pxの1つだけとし、スマホ幅(600px未満)を基本に書いて `@media (min-width: 600px)` でPC向けを上書きする
- **単位**: 文字サイズは `rem`、余白とタップ対象の大きさは `px`(タップ対象は44px以上)

### パフォーマンス

- 描画は状態が変わったときにまとめて行う。関数の中で何度もDOMを読み書きしない
- `resize` のような連続して起こるイベントは `requestAnimationFrame` で間引く
- 検索は0.3秒のデバウンスと `AbortController` による中断を必ず行う

### テストコード

**フレームワーク**: Node.js組み込みの `node:test` と `node:assert/strict`

```javascript
// tests/unit/logic/years.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { yearsBetween, formatYearValue } from '../../../src/logic/years.js';

describe('yearsBetween', () => {
  it('紀元後同士では単純な差を返す', () => {
    assert.equal(yearsBetween(1543, 1582), 39);
  });

  it('紀元前と紀元後をまたぐと0年がない分1年少なくなる', () => {
    assert.equal(yearsBetween(-4, 30), 33);
  });
});

describe('formatYearValue', () => {
  it('紀元前の年は「前」を付けて表記する', () => {
    assert.equal(formatYearValue({ year: -551, precision: 'year' }), '前551年');
  });
});
```

**原則**:
- テスト名は日本語で「[条件]では[期待結果]」の形で書く
- 1つの `it` では1つの振る舞いを確認する
- Wikidataの応答は `tests/fixtures/` のJSONを使い、テストで実際にAPIを呼ばない
- 読み込みは `JSON.parse(readFileSync(new URL('../../fixtures/xxx.json', import.meta.url)))` で行う
- `currentYear` は固定値(例: `2026`)を渡す

## Git運用ルール

### ブランチ戦略

個人開発のため、`develop` ブランチは置かない簡素な運用とする。

**ブランチ種別**:
- `main`: 公開中の状態(GitHub Pagesは `main` から配信)。常に動く状態を保つ
- `feature/[機能名]`: 新機能開発(例: `feature/person-input`)
- `fix/[修正内容]`: バグ修正(例: `fix/bc-year-format`)
- `docs/[対象]`: ドキュメントのみの変更(例: `docs/update-prd`)

**フロー**:
```
main
  ├─ feature/person-input   → mainへマージ
  ├─ feature/timeline-view  → mainへマージ
  └─ fix/bc-year-format     → mainへマージ
```

- 作業ブランチは `main` から作り、`.steering/` の作業単位と対応させる
- `main` へのマージ前に、ユニットテストと手動テストを行う

### コミットメッセージ規約

**フォーマット**(Conventional Commits、本文は日本語):
```
<type>(<scope>): <subject>

<body>
```

**Type**:
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: 見た目のみの変更(CSS)、コードの整形
- `refactor`: リファクタリング
- `test`: テストの追加・修正
- `chore`: その他(設定、不要ファイルの削除など)

**Scope**: `ui`、`logic`、`data`、`css`、`docs` などの変更箇所

**例**:
```
feat(logic): 2人の生存期間の重なりを計算する処理を追加

- comparePeopleで重なり年数と年齢関係を算出
- 紀元前をまたぐ場合は0年がない分を補正
```

### プルリクエストプロセス

個人開発のため、PRは任意とする。PRを作る場合は以下のテンプレートを使う。

**作成前のチェック**:
- [ ] `node --test 'tests/**/*.test.js'` がすべて成功する
- [ ] ブラウザで手動確認した(スマホ幅を含む)
- [ ] 開発者ツールのコンソールにエラーが出ていない
- [ ] 本ドキュメントのコーディング規約に沿っているかセルフレビューした
- [ ] `implementation-validator` サブエージェントでスペックとの整合性を確認した

**PRテンプレート**:
```markdown
## 概要
[変更内容の簡潔な説明]

## 変更理由
[なぜこの変更が必要か。対応するステアリングファイル]

## 変更内容
- [変更点1]
- [変更点2]

## テスト
- [ ] ユニットテスト追加・成功
- [ ] 手動テスト実施(PC / スマホ幅)

## スクリーンショット(画面の変更がある場合)
[画像]
```

## テスト戦略

### テストの種類

| 種類 | 対象 | 方法 | 目標 |
|------|------|------|------|
| ユニットテスト | `src/logic/`、`src/data/person-parser.js` | `node --test 'tests/**/*.test.js'` | 機能設計書のアルゴリズムA1〜A6の各分岐を最低1ケースずつ通す |
| 手動テスト | 画面全体(`src/ui/`、`src/app.js`) | ブラウザで操作 | `docs/manual-test-checklist.md` のすべての項目 |

統合テスト・E2Eテストの自動化は行わない(`docs/architecture.md` 参照)。

### ユニットテストで確認するケース

対象ケースの一覧は `docs/functional-design.md` の「テスト戦略 > ユニットテスト」を正とする。特に、紀元前をまたぐ年数計算と、Wikidataの値の選択(ランク・`somevalue` / `novalue`・`missing`)は必ずテストする。

### 手動テストのタイミング

- UIに関わる変更をした作業の最後
- `main` へのマージ前
- 公開後、PRDの対応環境(iPhone / Android / PC)で確認

## コードレビュー基準

セルフレビューに加え、実装後は `implementation-validator` サブエージェント(Claude Code)でスペックとの整合性を確認する。

**「目安」の数値の扱い**: 行の長さ(100文字)、関数の長さ(40行)、ファイルの長さ(300行)はツールで強制しない。超えている場合はレビューで `[推奨]` として指摘し、分割するかどうかをその場で判断する。

### レビューポイント

**機能性**:
- [ ] PRDの受け入れ条件を満たしているか
- [ ] 紀元前・存命・あいまいな年・没年不明のケースを考慮しているか
- [ ] 通信エラー・中断のときに画面が壊れないか

**可読性**:
- [ ] 歴史的年(`year`)と天文学的年(`astroYear`)が名前で区別されているか
- [ ] 公開関数にJSDocがあるか
- [ ] 「なぜ」のコメントがあるか

**保守性**:
- [ ] レイヤーの依存ルール(`docs/repository-structure.md`)を守っているか
- [ ] ロジックレイヤーが純粋関数になっているか
- [ ] 1ファイル300行以下か
- [ ] 1関数40行以内か

**パフォーマンス**:
- [ ] 検索にデバウンスと中断があるか
- [ ] 1回の検索の通信が2リクエストに収まっているか

**セキュリティ**:
- [ ] 外部の文字列を `textContent` で表示しているか(`innerHTML` を使っていないか)
- [ ] 通信先がWikidataのみか

### レビューコメントの書き方

**優先度を明示する**:
- `[必須]`: 修正必須
- `[推奨]`: 修正推奨
- `[提案]`: 検討してほしい
- `[質問]`: 理解のための質問

```markdown
## ✅ 良い例
[必須] 紀元前の人物同士を比べると、yearsBetweenを通さずに引き算しているため1年ずれます。
yearsBetweenを使うようにしてください。

## ❌ 悪い例
計算がおかしいです。
```

## 開発環境セットアップ

### 必要なツール

devcontainerに含まれているため、追加のインストールは不要。

| ツール | バージョン | 用途 |
|--------|-----------|------|
| Node.js | v24系 | ユニットテストの実行 |
| Python 3 | 3系(`python` feature) | ローカル開発サーバー |
| Git / GitHub CLI | devcontainer同梱 | バージョン管理 |

### セットアップ手順

```bash
# 1. リポジトリのクローン(devcontainerで開く)
git clone [URL]
cd ijin-timeline

# 2. 依存関係のインストール
# 不要

# 3. 開発サーバーの起動
python3 -m http.server 8000
# ブラウザで http://localhost:8000/ を開く

# 4. ユニットテストの実行
node --test 'tests/**/*.test.js'
```

**注意**: `index.html` をファイルとして直接開く(`file://`)と、ES Modulesが読み込めず動かない。必ず開発サーバー経由で開く。

### 公開(デプロイ)

1. GitHubのリポジトリ設定 → Pages で、公開元を「Deploy from a branch」「`main` / (root)」にする
2. `main` にマージすると、数分以内に `https://nogawa-asase.github.io/ijin-timeline/` に反映される
3. 公開後に不具合が見つかった場合は、原因のコミットを `git revert` して `main` にpushする(`docs/architecture.md` の「障害時の切り戻し」)

### 推奨開発ツール

- **VS Code**: JSDocによる補完と型のヒントが使える。ファイル先頭に `// @ts-check` を書くと、ビルドなしで型の誤りをエディタ上で確認できる(任意)
- **ブラウザの開発者ツール**: レスポンシブ表示(360px幅)、ネットワーク制限(Fast 4G / Offline)、コンソールの確認
