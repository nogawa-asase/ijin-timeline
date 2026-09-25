# 設計書

## アーキテクチャ概要

レイヤー構成・通信の流れは変えない。`wbsearchentities` の応答で今は捨てている `match` を読み取り、`searchPeople` の戻り値に「一致した別名」を足す。UIレイヤーはそれを表示するだけ。

```
wbsearchentities → [{ id, match: { type: 'alias', text: '豊臣秀綱' } }, ...]
  → searchEntityHits: [{ id: 'Q452628', matchedAlias: '豊臣秀綱' }, ...]
wbgetentities → parsePerson → Person
  → Candidate = { ...Person, matchedAlias }   (wikidata-client.js で合成)
  → person-input.js: 生没年の後ろに「(別名: 豊臣秀綱)」
```

## データモデル

### Candidate(変更)

これまでは `Candidate = Person`(型の別名)だった。これを、Personに一致した別名を足した型にする。

```javascript
/**
 * @typedef {Person & { matchedAlias: string|null }} Candidate
 * matchedAlias: 別名で検索に一致したときの、その別名(例: "豊臣秀綱")。
 *               ラベルで一致した・一致の情報がない・別名が表示名と同じ場合はnull
 */
```

- 定義場所は `src/data/wikidata-client.js` とする。一致の情報は検索の応答にしかなく、`person-parser.js`(エンティティ1件の変換)の責務ではないため
- `onChange` にはCandidateをそのまま渡す。CandidateはPersonのプロパティをすべて持つので、`app.js` 以降は変更不要。`matchedAlias` は使わない

## コンポーネント設計

### 1. wikidata-client.js

**責務**:
- 検索結果から、IDと一致した別名の組を取り出す
- 詳細取得で得たPersonに、一致した別名を足してCandidateとして返す

**実装の要点**:
- `searchEntityIds` を `searchEntityHits` に改め、`{ id, matchedAlias }[]` を返す
  - `result.match?.type === 'alias'` かつ `result.match.text` が空でない文字列のときだけ、`matchedAlias` に `match.text` を入れる。それ以外は `null`
- `searchPeople` の戻り値の型を `Promise<Candidate[]>` にする
  - Personに変換できたものだけに `matchedAlias` を足す。`matchedAlias` が `person.label` と同じなら `null` にする
  - 除外・順序・最大7件の扱いは変えない

### 2. person-input.js

**責務**:
- 候補の行に、一致した別名を表示する

**実装の要点**:
- `createOptionElement` の引数を `Candidate` にする
- `matchedAlias` が `null` でなければ、生没年の `span` の後ろに `span.person-input-option-alias` を追加し、`(別名: ${matchedAlias})` を `textContent` で入れる(`innerHTML` は使わない)
- 選択時に入力欄へ入れる値は、これまでどおり `label`

### 3. style.css

- `.person-input-option-alias` を、説明文と同じ補助的な文字色(`--color-text-sub`)にする。行の折り返しは既存のインライン要素に任せる

## データフロー

### UC1: 人物を検索して選ぶ(変更点のみ)
```
1. wbsearchentities の応答から、IDと一致した別名(alias一致のときのみ)を取り出す
2. wbgetentities の結果をPersonに変換し、条件を満たさないものを除く
3. 残ったPersonに一致した別名を足してCandidateにし、最大7件を返す
4. 候補一覧で、別名があれば「名前(生年–没年)(別名: ○○)」と表示する
```

## エラーハンドリング戦略

- `match` がない・形式が不正な場合はエラーにせず、`matchedAlias: null` として扱う。別名の表示は補助的な情報なので、応答の一部が欠けても候補の表示を止めない

## テスト戦略

### ユニットテスト(`tests/unit/data/wikidata-client.test.js`)
- `match.type` が `alias` の候補は、`matchedAlias` に `match.text` が入る
- `match.type` が `label` の候補、`match` がない候補は、`matchedAlias` が `null`
- `match.text` が表示名(label)と同じ場合は、`matchedAlias` が `null`

### 手動テスト
- 「豊臣」で、天草四郎に「(別名: 豊臣秀綱)」が表示され、豊臣秀吉には表示されない
- 天草四郎を選ぶと、入力欄に「天草四郎」だけが入る
- スマホ幅(360px)で候補の行が崩れない

## 依存ライブラリ

なし。

## ディレクトリ構造

```
src/data/wikidata-client.js               (変更)
src/ui/person-input.js                    (変更)
css/style.css                             (変更)
tests/unit/data/wikidata-client.test.js   (変更)
docs/product-requirements.md              (変更: 機能1の受け入れ条件に別名の表示を追記)
docs/functional-design.md                 (変更: Candidate、wbsearchentitiesの応答、UC1)
docs/glossary.md                          (変更: Candidate、候補・候補一覧)
docs/manual-test-checklist.md             (変更: 別名表示の確認項目)
```

## 実装の順序

1. ユニットテストを追加する(先に失敗することを確認)
2. `wikidata-client.js` を変更し、テストを通す
3. `person-input.js` と `style.css` を変更する
4. 永続ドキュメントを更新する
5. ブラウザで手動テストする

## セキュリティ考慮事項

- 別名はWikidataの編集者が自由に登録できる文字列。`textContent` で入れ、`innerHTML` は使わない(開発ガイドラインの既存ルール)

## パフォーマンス考慮事項

- すでに受け取っている応答の一部を読むだけで、通信・データ量は増えない

## 将来の拡張性

- 別名で一致した候補を後ろに並べる、といった並べ替えが必要になった場合も、`matchedAlias` があれば `searchPeople` の中だけで対応できる
