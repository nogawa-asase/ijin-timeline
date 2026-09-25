# 設計書

## アーキテクチャ概要

`docs/architecture.md` のレイヤードアーキテクチャ(UI → データ → ロジック)に従う。ビルドなしのES Modulesで、`index.html` から `src/app.js` を読み込む。

```
index.html ── src/app.js(AppState・組み立て)
                 ├─ src/ui/person-input.js ──→ src/data/wikidata-client.js ──→ src/data/person-parser.js
                 ├─ src/ui/timeline-view.js ─→ src/logic/timeline-scale.js
                 └─ src/ui/result-view.js ───→ src/logic/comparison.js
                                                 (すべて src/logic/years.js を利用)
```

## 機能設計書からの変更点(実装時に判明した調整)

| 項目 | 機能設計書 | 本実装 | 理由 |
|------|-----------|--------|------|
| `searchPeople` の引数 | `(query, signal)` | `(query, currentYear, signal)` | `parsePerson` の存命判定に `currentYear` が必要。データレイヤー内で `Date` を使わず引数で受け取る規約に合わせる |
| `createPersonInput` のoptions | `placeholder`, `onChange` | `label`(「1人目」)、`slotNumber`、`currentYear` を追加 | クリアボタンの `aria-label`、要素ID・色の区別、検索時の存命判定に必要 |
| `renderTimeline` / `renderResult` の人物 | nullを除いた `Person[]` | `AppState.slots`(`(Person|null)[]`) | 2人目だけ選んだときも2人目の色(オレンジ)で描くため、欄の番号を保つ |
| 表示範囲・目盛りの計算(A6) | `timeline-view.js` 内 | `src/logic/timeline-scale.js`(純粋関数) | A6をユニットテストできるようにし、UIレイヤーに計算ロジックを置かない |
| 目盛りの位置 | 天文学的年が間隔の倍数 | 歴史的年が間隔の倍数(0年は飛ばす) | 天文学的年の倍数だと紀元前のラベルが「前501」「前1」のように半端になるため |
| `Comparison` の重なり年 | `overlapStart` / `overlapEnd`(数値) | `YearValue` と天文学的年の両方を持つ | 文章では「1530年代」などの精度付き表記、描画では座標が必要なため |
| ラベルの言語 | `languages=ja\|en` | `languages=ja\|mul\|en`(フォールバック ja → mul → en → ID) | Wikidataは全言語共通ラベル `mul` を導入済みで、`en` がなく `mul` だけの人物がいるため |

## コンポーネント設計

### 1. src/logic/years.js
**責務**: 天文学的年との変換、年数計算、年・年代・世紀の表記、代表年
**実装の要点**:
- `toAstronomical` / `fromAstronomical` / `yearsBetween` / `formatYearValue` / `formatAxisYear` / `representativeYear` / `formatLifespan`
- `formatLifespan(birth, death, lifeStatus)` は「1534年–1582年」「1960年–」「1100年–?」を返す(候補一覧・aria-labelで共通利用)
- 年代の代表年: 紀元後は先頭年+5、紀元前は先頭年−5(前550年代 → 前555年)

### 2. src/logic/comparison.js
**責務**: A5の比較計算
**実装の要点**:
- `lifespanOf(person, currentYear)`: 生存期間の天文学的年 `{ startAstroYear, endAstroYear }`(没年不明は `endAstroYear: null`)
- `comparePeople(a, b, currentYear)`: `Comparison` を返す。判定不可のときは `unknownPeople` に没年不明の人物を入れる
- 2人とも存命の重なりは `isOngoing: true`

### 3. src/logic/timeline-scale.js(新規)
**責務**: A6の表示範囲・目盛り間隔・目盛り一覧
**実装の要点**:
- `drawSpanOf(person, currentYear)`: 描画用の期間(没年不明は生年+50を仮の終了年とし `isTentativeEnd: true`)
- `computeTimeRange(spans)`、`chooseTickStep(range)`、`computeTicks(range)`

### 4. src/data/person-parser.js
**責務**: エンティティ → Person(A1, A2)
**実装の要点**: `parsePerson`、`parseYearValue`。ランクによる値の選択、`somevalue` / `novalue`、`missing`・人間以外・生年なしの除外

### 5. src/data/wikidata-client.js
**責務**: `wbsearchentities` → `wbgetentities` の2リクエスト、10秒タイムアウト、中断
**実装の要点**:
- 呼び出し元の `signal` による中断は `AbortError` のまま投げ直し、タイムアウト・HTTPエラー・APIの `error`・JSON不正は `WikidataError`
- 検索0件なら詳細取得をしない。検索順を保ったまま最大7件

### 6. src/ui/person-input.js
**責務**: comboboxパターンの入力欄1つ分
**実装の要点**:
- 0.3秒デバウンス、`AbortController`、同じ入力の再検索省略(直前の結果を再表示)
- `aria-activedescendant` による上下キー移動、Enter確定、Esc閉じる
- 状態メッセージは `aria-live="polite"` の領域に表示(件数はスクリーンリーダー向けに視覚的に隠す)
- 候補の `mousedown` で `preventDefault` し、クリック前に入力欄のフォーカスが外れて一覧が閉じるのを防ぐ

### 7. src/ui/timeline-view.js
**責務**: SVGの描画(目盛り・補助線、重なり区間、人物の線・名前・生没年、存命の矢印、点線)
**実装の要点**:
- 目盛り・重なり区間・人物の行を別関数で描く(P2の出来事などを足しやすくする)
- 生没年ラベルは `getComputedTextLength()` で幅を測り、入らなければ線の下に置く
- 色はCSSクラス(`is-person-1` など)で指定する

### 8. src/ui/result-view.js
**責務**: A5の文章パターンを `<p>` として表示。2人未満なら非表示

### 9. src/app.js / index.html / css/style.css
- `currentYear` を1回だけ取得して各部品に渡す
- `resize` は `requestAnimationFrame` で間引く
- 0人のときは案内文を表示し、SVGを隠す

## データフロー

### 人物を選んで比較する
```
1. person-input: 入力 → 0.3秒後 searchPeople(query, currentYear, signal)
2. wikidata-client: wbsearchentities → wbgetentities → parsePerson ×n → Person[](≤7)
3. person-input: 候補表示 → 選択 → onChange(person)
4. app: slots[i] = person → renderTimeline(svg, slots, currentYear, width) / renderResult(el, slots, currentYear)
```

## エラーハンドリング戦略

### カスタムエラークラス
- `WikidataError`(`src/data/wikidata-client.js`): 通信失敗・タイムアウト・不正な応答

### エラーハンドリングパターン
- `AbortError` は何もしない。`WikidataError` は定型メッセージ。それ以外は `console.error` のうえ同じメッセージ
- データの欠落・不正は `null` を返して「データなし」として扱う

## テスト戦略

### ユニットテスト(`node --test 'tests/**/*.test.js'`)
- `years.test.js`、`comparison.test.js`、`timeline-scale.test.js`、`person-parser.test.js`、`wikidata-client.test.js`(`globalThis.fetch` を差し替え)
- フィクスチャはWikidataの実際の応答から必要な項目だけを残したJSON

### 手動テスト
- `docs/manual-test-checklist.md` を作成(この環境にはブラウザがないため、実行は開発者が行う)

## 依存ライブラリ

なし。

## ディレクトリ構造

```
index.html
.nojekyll
css/style.css
src/app.js
src/ui/{person-input,timeline-view,result-view}.js
src/logic/{years,comparison,timeline-scale}.js
src/data/{wikidata-client,person-parser}.js
tests/unit/logic/{years,comparison,timeline-scale}.test.js
tests/unit/data/{person-parser,wikidata-client}.test.js
tests/fixtures/*.json
docs/manual-test-checklist.md
```

## 実装の順序

1. ロジックレイヤー(years → comparison → timeline-scale)とテスト
2. データレイヤー(フィクスチャ → person-parser → wikidata-client)とテスト
3. UIレイヤー(index.html / CSS → result-view → timeline-view → person-input → app)
4. 手動テストのチェックリスト、テンプレート由来ファイルの削除、ドキュメント更新

## セキュリティ考慮事項

- 外部の文字列は `textContent` のみ。`innerHTML` 不使用
- CSPを `<meta>` で設定(`connect-src https://www.wikidata.org`)。`style` 属性を使わない
- URLは `URLSearchParams` で組み立てる

## パフォーマンス考慮事項

- 1検索2リクエスト、デバウンス、中断、同じ入力の再検索省略
- 再描画は状態変化時にまとめて行い、`resize` は `requestAnimationFrame` で間引く

## 将来の拡張性

- `slots` 配列・`renderTimeline` は人数に依存しない(P1の3人以上)
- `createPersonInput` は `setPerson` を返す(P1のURL共有)
