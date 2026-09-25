# リポジトリ構造定義書 (Repository Structure Document)

## プロジェクト構造

```
ijin-timeline/
├── index.html                 # 唯一のページ(GitHub Pagesの入口)
├── .nojekyll                  # GitHub PagesのJekyll処理を無効化(ファイルをそのまま配信)
├── css/
│   ├── style.css              # 画面全体のスタイル(CSS変数、ページの配置、タイムライン、結果)
│   └── person-input.css       # 人物の入力欄の部品のスタイル
├── src/                       # アプリケーションのJavaScript(ES Modules)
│   ├── app.js                 # エントリーポイント(状態管理・全体の組み立て)
│   ├── ui/                    # UIレイヤー
│   │   ├── person-input.js
│   │   ├── timeline-view.js
│   │   ├── result-view.js
│   │   ├── person-input/      # person-input.js を分割した内部モジュール
│   │   │   ├── elements.js    # 入力欄・候補1件分の要素の作成
│   │   │   └── messages.js    # 状態表示の文言と、0件のときの文言の選択
│   │   └── timeline/          # timeline-view.js を分割した内部モジュール
│   │       ├── person-row.js  # 人物1人分の行(名前・線・生没年)の描画
│   │       └── svg.js         # SVG要素の作成・文字幅の計測
│   ├── logic/                 # ロジックレイヤー
│   │   ├── years.js
│   │   ├── comparison.js
│   │   └── timeline-scale.js
│   └── data/                  # データレイヤー
│       ├── wikidata-client.js
│       └── person-parser.js
├── tests/                     # テストコード(Node.js組み込みテストランナー)
│   ├── unit/                  # ユニットテスト(srcと同じ構造)
│   │   ├── logic/
│   │   └── data/
│   └── fixtures/              # テスト用のWikidata応答データ
├── docs/                      # 永続的ドキュメント
│   └── ideas/                 # 壁打ち・アイデアメモ
├── .steering/                 # 作業単位のドキュメント
├── .claude/                   # Claude Codeの設定
├── .devcontainer/             # 開発環境の定義
├── CLAUDE.md
├── README.md                  # プロジェクト概要、公開URL、開発の始め方
├── LICENSE
└── prompt.md                  # /add-feature でMVPを一括実装するときの指示文(作業用)
```

**ポイント**:
- ビルドしないため、リポジトリのファイルがそのまま公開される。`index.html` はリポジトリのルートに置く
- `package.json` などのツール設定ファイルは置かない

## ディレクトリ詳細

### ルート直下(公開ファイル)

**役割**: GitHub Pagesで配信する入口

**配置ファイル**:
- `index.html`: 画面の骨組み、CSP、`<script type="module" src="src/app.js">` の読み込み
- `.nojekyll`: 空ファイル。GitHub PagesのJekyll処理を無効にし、配信を速く・確実にする
- `README.md`: プロジェクトの概要、公開URL(`https://nogawa-asase.github.io/ijin-timeline/`)、開発の始め方(`docs/development-guidelines.md` の開発環境セットアップへのリンク)を書く

**Gitで管理しないファイル**: `使い方メモ.txt` は開発者個人の手順メモのため、コミットしない

### css/

**役割**: スタイルシートの配置

**配置ファイル**:
- `style.css`: 全画面共通のスタイル(`:root` のCSS変数、ページの配置、タイムライン、結果の文章)
- `person-input.css`: 人物の入力欄(`person-input.js` が作る `.person-input` で始まるクラス)のスタイル。`style.css` が300行を超えたため分割した
- `index.html` で `<link>` を使って `style.css` → 部品のCSSの順に読み込む(`@import` は読み込みが直列になるため使わない)

**命名規則**:
- kebab-case、拡張子 `.css`
- 300行を超えたら、画面の部品ごとに分割を検討する(例: `person-input.css`)

### src/(ソースコード)

#### src/app.js

**役割**: エントリーポイント。AppStateを保持し、UIの部品を組み立て、状態が変わったら再描画する

**依存関係**:
- 依存可能: `src/ui/`
- 依存禁止: なし(最上位)。ただし描画・通信の処理は直接書かず、各モジュールに任せる

#### src/ui/

**役割**: UIレイヤー。DOM・SVGの描画と利用者の操作の受付

**配置ファイル**:
- `person-input.js`: 入力欄・候補一覧(オートコンプリート)
- `timeline-view.js`: SVGタイムラインの描画
- `result-view.js`: 比較結果の文章の表示
- `timeline/`: `timeline-view.js` が300行を超えたため分割した内部モジュール(`person-row.js`、`svg.js`)。部品が大きくなったときは、部品名のサブディレクトリに分割する
- `person-input/`: `person-input.js` が300行を超えたため分割した内部モジュール(`elements.js`、`messages.js`)

**命名規則**:
- 入力を受け付ける部品: `[対象]-input.js`
- 表示する部品: `[対象]-view.js`
- 画面の外とのやり取りをする部品: `[対象]-[動作].js`(例: URLと状態の相互変換 `url-state.js`、画像の書き出し `image-export.js`)

**依存関係**:
- 依存可能: `src/logic/`、`src/data/`
- 依存禁止: `src/app.js`、`src/ui/` 内の他のファイル(部品同士は `app.js` を通じて連携する)。ただし部品を分割したサブディレクトリ(`timeline/`、`person-input/`)は、その部品からのみ import してよい

#### src/logic/

**役割**: ロジックレイヤー。年の変換・表記と、2人の比較の計算。DOMに触れない純粋な関数のみ

**配置ファイル**:
- `years.js`: 天文学的年との変換、年数計算、年・年代・世紀の表記
- `comparison.js`: 重なり・年齢関係・空白期間の計算
- `timeline-scale.js`: タイムラインの表示範囲・目盛りの計算

**命名規則**:
- 扱う対象の名詞(複数形または名詞形)、kebab-case

**依存関係**:
- 依存可能: `src/logic/` 内のファイル
- 依存禁止: `src/ui/`、`src/data/`、`src/app.js`、DOM・`fetch`・`Date`(現在の年は引数で受け取る)

#### src/data/

**役割**: データレイヤー。Wikidataからの取得とPersonへの変換

**配置ファイル**:
- `wikidata-client.js`: Wikidata APIの呼び出し(`fetch`、タイムアウト、中断)
- `person-parser.js`: Wikidataのエンティティ → Personの変換、対象外の人物の除外

**命名規則**:
- 外部サービスとの通信: `[サービス名]-client.js`
- データの変換: `[変換後の対象]-parser.js`

**依存関係**:
- 依存可能: `src/logic/`(`years.js` など)、`src/data/` 内のファイル
- 依存禁止: `src/ui/`、`src/app.js`、DOM

### tests/(テストディレクトリ)

#### unit/

**役割**: ユニットテストの配置。`src/` と同じディレクトリ構造にする

**構造**:
```
tests/unit/
├── logic/
│   ├── years.test.js
│   ├── comparison.test.js
│   └── timeline-scale.test.js
└── data/
    ├── person-parser.test.js
    └── wikidata-client.test.js
```

**命名規則**:
- パターン: `[テスト対象ファイル名].test.js`
- 例: `src/logic/years.js` → `tests/unit/logic/years.test.js`

**対象外**: `src/ui/` と `src/app.js`(DOMに依存するため、手動テストで確認する)

#### fixtures/

**役割**: テストで使うWikidataの応答データ(実際の応答から必要な項目だけを残したJSON)

PRDのKPIにある検証用20人のうち、ユニットテストに必要な最小限の人物だけを置く。20人全体の一覧と確認手順は `docs/manual-test-checklist.md` にまとめる。

**構造**:
```
tests/fixtures/
├── Q171411-oda-nobunaga.json    # 年精度・紀元後
├── Q4604-confucius.json         # 紀元前
└── ...
```

**命名規則**:
- パターン: `[WikidataのID]-[人物のローマ字表記].json`
- 実在しない条件を試すための加工データは `synthetic-[条件].json`(例: `synthetic-no-birth.json`)

**テストの実行**:
```bash
node --test 'tests/**/*.test.js'
```

統合テスト・E2Eテストのディレクトリは作らない(`docs/architecture.md` のテスト戦略を参照)。

### docs/(ドキュメントディレクトリ)

**配置ドキュメント**:
- `product-requirements.md`: プロダクト要求定義書
- `functional-design.md`: 機能設計書
- `architecture.md`: 技術仕様書
- `repository-structure.md`: リポジトリ構造定義書(本ドキュメント)
- `development-guidelines.md`: 開発ガイドライン
- `glossary.md`: 用語集
- `manual-test-checklist.md`: 手動テストのチェックリストと検証用20人の一覧
- `ideas/`: 壁打ち・アイデアメモ(正式な仕様ではない)

`docs/` もGitHub Pagesで公開されるが、秘密情報を含まないため問題ない。

## ファイル配置規則

### ソースファイル

| ファイル種別 | 配置先 | 命名規則 | 例 |
|------------|--------|---------|-----|
| ページ | ルート | `index.html` | `index.html` |
| スタイル | `css/` | kebab-case.css | `style.css` |
| エントリーポイント | `src/` | `app.js` | `app.js` |
| UI部品 | `src/ui/` | `[対象]-input.js` / `[対象]-view.js` | `timeline-view.js` |
| 計算・表記 | `src/logic/` | kebab-case.js | `comparison.js` |
| 外部API呼び出し | `src/data/` | `[サービス名]-client.js` | `wikidata-client.js` |
| データ変換 | `src/data/` | `[対象]-parser.js` | `person-parser.js` |

### テストファイル

| テスト種別 | 配置先 | 命名規則 | 例 |
|-----------|--------|---------|-----|
| ユニットテスト | `tests/unit/`(srcと同じ構造) | `[対象].test.js` | `tests/unit/logic/years.test.js` |
| テストデータ | `tests/fixtures/` | `[ID]-[名前].json` | `Q171411-oda-nobunaga.json` |

### 設定ファイル

ツール設定ファイル(`package.json`、`tsconfig.json`、リンター設定など)は置かない。

## 命名規則

### ディレクトリ名

- レイヤーのディレクトリは短い単数形の英単語、kebab-case: `ui/`、`logic/`、`data/`
- 機能設計書・技術仕様書のレイヤー名(UI / ロジック / データ)と1対1で対応させる

### ファイル名

- すべて kebab-case(ES Modulesの一般的な慣習、大文字小文字の違いによる環境差を避けるため)
- 拡張子は `.js`(`.mjs` は使わない)
- 例: `person-input.js`、`wikidata-client.js`

### import の書き方

ブラウザはパスの補完をしないため、拡張子まで含めた相対パスで書く。

```javascript
// ✅ 良い例
import { formatYearValue } from '../logic/years.js';

// ❌ 悪い例(ブラウザで読み込めない)
import { formatYearValue } from '../logic/years';
```

## 依存関係のルール

レイヤーの考え方と各レイヤーの責務は `docs/architecture.md` を正とする。ここでは、それをディレクトリ・ファイル単位の `import` のルールに当てはめたものを定める。ルールが守られているかは、コードレビュー(`docs/development-guidelines.md` のコードレビュー基準、`implementation-validator` サブエージェント)で確認する。

### レイヤー間の依存

```
src/app.js
    ↓
src/ui/  ──────────┐
    ↓              ↓
src/data/  →  src/logic/
```

**禁止される依存**:
- `src/logic/` → `src/data/`、`src/ui/`(❌)
- `src/data/` → `src/ui/`(❌)
- `src/ui/` → `src/app.js`(❌)
- `src/ui/` 内のファイル同士(❌)。ただし、部品を分割したサブディレクトリ(例: `src/ui/timeline/`)は、その部品(`timeline-view.js`)と同じサブディレクトリ内のファイルからのみ import してよい

### 循環依存の禁止

ファイル同士が互いに `import` し合う構成にしない。共通して必要なものは、より下のレイヤー(`src/logic/`)に切り出す。

## スケーリング戦略

### 機能の追加

| 追加する機能 | 配置先 |
|------------|--------|
| URLでの共有(P1) | `src/ui/url-state.js`(URLとAppStateの相互変換)。IDからの取得は `wikidata-client.js` に関数を追加 |
| 3人以上の比較(P1) | 既存ファイルの修正のみ(`app.js`、`timeline-view.js`、`result-view.js`、`comparison.js`) |
| 時代区分の表示(P1) | 時代区分のデータを `src/logic/eras.js` に定数として置き、描画は `timeline-view.js` に追加 |
| 人物の詳細表示(P1) | `src/ui/person-detail-view.js` |
| 出来事の表示(P2) | 取得は `src/data/`、描画は `timeline-view.js` に追加 |
| 同時代の有名人の提案(P2) | 提案する人物の一覧(日本史・世界史の有名人)を `src/logic/famous-people.js` に定数として置き、提案の表示は `src/ui/suggestion-view.js` |
| 画像として保存(P2) | `src/ui/image-export.js` |
| 人物の肖像画表示(P2) | 画像の取り出しは `person-parser.js` に追加(Wikidataの画像プロパティP18)、描画は `timeline-view.js` に追加 |

### ファイルサイズの管理

- 1ファイル300行以下を目安とする
- `person-input.js` が300行を超えたため、要素の作成を `src/ui/person-input/elements.js`、状態表示の文言を `src/ui/person-input/messages.js` に分割した
- `css/style.css` が300行を超えたため、入力欄の部品のスタイルを `css/person-input.css` に分割した。今後も部品ごとに `css/[部品名].css` へ切り出す
- `timeline-view.js` が300行を超えたため、人物の行の描画を `src/ui/timeline/person-row.js`、SVGの補助関数を `src/ui/timeline/svg.js` に分割した。今後さらに大きくなった場合も、描画要素ごと(目盛り、重なり区間、出来事など)に `src/ui/timeline/` へ切り出す

## 特殊ディレクトリ

### .steering/(ステアリングファイル)

**役割**: 特定の開発作業における「今回何をするか」を定義

**構造**:
```
.steering/
└── [YYYYMMDD]-[task-name]/
    ├── requirements.md      # 今回の作業の要求内容
    ├── design.md            # 変更内容の設計
    └── tasklist.md          # タスクリスト
```

**命名規則**: `20260924-add-person-input` 形式

**Gitでの扱い**: 作業の履歴として残すため、コミットする(`.gitignore` で除外しない)

### .claude/(Claude Code設定)

**構造**:
```
.claude/
├── commands/                # スラッシュコマンド
├── skills/                  # タスクモード別スキル
├── agents/                  # サブエージェント定義
└── settings.json
```

## 除外設定

### .gitignore

主な除外対象:
- OS・エディタのファイル: `.DS_Store`、`Thumbs.db`、`.vscode/`、`.idea/`
- ログ・一時ファイル: `*.log`、`tmp/`
- 環境変数: `.env`
- Claude Codeの個人設定: `.claude/settings.local.json`
- 開発者個人の手順メモ: `使い方メモ.txt`

`.steering/` は除外しない(作業の履歴としてコミットする)。
