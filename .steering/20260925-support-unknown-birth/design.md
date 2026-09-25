# 設計書

## アーキテクチャ概要

レイヤー構成・通信は変えない。Personの `birth` を `YearValue|null` に広げ、`null` を「生年不明」として各レイヤーで扱う。既存の「没年不明」(`lifeStatus: 'unknown'`)の扱いと対になるように設計する。

| | 没年不明(既存) | 生年不明(今回) |
|---|---|---|
| Personでの表し方 | `lifeStatus: 'unknown'`、`death: null` | `birth: null`(`lifeStatus` は必ず `'deceased'`) |
| 候補一覧 | `(1572年–?)` | `(?–248年)` |
| 仮の描画範囲 | 生年 〜 生年+50年 | 没年−50年 〜 没年 |
| 線 | 全体を点線、右端に「没年不明」 | 全体を点線、左端に「生年不明」 |
| 比較 | 常に判定不可 | 相手が没年より後に生まれた、または没年の120年以上前に亡くなったら重なりなし。それ以外は判定不可 |

## データモデル

### Person(変更)

```javascript
/**
 * @property {YearValue|null} birth  生年。生年不明(「不明な値」または未登録で、没年がある)の場合はnull
 */
```

**不変条件**: `birth === null` のとき、`death !== null` かつ `lifeStatus === 'deceased'`。生年も没年もわからない人物はPersonにならない。

### Comparison(変更)

`kind: 'undetermined'` の理由を分けて持つ。また、生年不明の人物より相手が120年以上前に亡くなった場合の「重なりなし」を表せるようにする。

```javascript
/**
 * @property {number|null} [gapYears]         elderの没年からyoungerの生年までの年数(kind='gap'のとき)。
 *                                            youngerが生年不明のため計算できない場合はnull
 * @property {number} [deathGapYears]         elderの没年からyoungerの没年までの年数(gapYearsがnullのとき)
 * @property {Person[]} [unknownPeople]       没年不明の人物(既存。kind='undetermined'のとき)
 * @property {Person[]} [unknownBirthPeople]  生年不明の人物(追加。kind='undetermined'のとき)
 */
```

## コンポーネント設計

### 1. person-parser.js(データレイヤー)

**実装の要点**:
- `parsePerson` の処理順を次のようにする
  1. 削除済み・人間でない・教育上の観点からフィルタリングする職業を持つ → `null`(変更なし)
  2. 生年を読む(`parseBirth`。変更なし)
  3. 生年がある → これまでどおり `parseDeath` で没年と `lifeStatus` を決める
  4. 生年がない → 没年を読み、日付の値があれば `{ birth: null, death, lifeStatus: 'deceased' }`。なければ `null`
- 没年を読む処理(`selectMainSnak` + `snaktype === 'value'` + `yearValueOfSnak`)は、`parseDeath` と生年不明の分岐で共通にする

### 2. years.js(ロジックレイヤー)

- `formatLifespan(birth, death, lifeStatus)`: `birth` が `null` なら生年の部分を `?` にする(例: `"?–248年"`)

### 3. comparison.js(ロジックレイヤー)

- `lifespanOf`: `startAstroYear` を `number|null` にする(生年不明はnull)
- `hasApproximateYear`: `birth` が `null` の人物は、生年のあいまいさの判定から外す
- `comparePeople` の判定順:
  1. 没年不明(`lifeStatus: 'unknown'`)または生年不明の人物がいなければ、これまでどおり
  2. 生年不明の人物が1人だけで、没年不明の人物がいない場合:
     - 相手の生年の代表年 > 生年不明の人物の没年の代表年 → `kind: 'gap'`(`elder` = 生年不明の人物、`younger` = 相手、`gapYears` = 相手の生年 − 没年)
     - 相手の終了年(没年、存命なら現在の年)の代表年 < 生年不明の人物の没年の代表年 − 120 → `kind: 'gap'`(`elder` = 相手、`younger` = 生年不明の人物、`gapYears: null`、`deathGapYears` = 没年の差)。人の寿命は長くても120年程度のため、生年不明の人物は相手の死後に生まれている
     - それ以外 → 判定不可
  - 寿命の目安 `MAX_LIFESPAN_YEARS`(120)は、今は `person-parser.js` の存命判定で使っている。データレイヤーとロジックレイヤーの両方で使うため、`years.js` に移して export する(`src/data/` → `src/logic/` の依存は許可されている)
  3. 上記以外 → `kind: 'undetermined'`(`unknownPeople` に没年不明の人物、`unknownBirthPeople` に生年不明の人物)
- 「重なりあり」の分岐には生年不明の人物は入らない(2で除外済み)

### 4. timeline-scale.js(ロジックレイヤー)

- `DrawSpan` に `isTentativeStart: boolean` を追加する
- `drawSpanOf`: 生年不明なら `startAstroYear = 没年の代表年 − 50`(`TENTATIVE_LIFESPAN_YEARS` を共用)、`isTentativeStart: true`

### 5. timeline/person-row.js(UIレイヤー)

- `startLabelOf(person)` を追加する(`birth` が `null` なら「生年不明」、それ以外は `formatYearValue(birth)`)。`endLabelOf` と対にする
- `drawLifeLine`: `span.isTentativeStart` のときも線全体を点線にする(`isTentativeEnd` と同じ扱い)
- `drawYearLabels`: 生年のラベルに `startLabelOf` を使う
- `dashedLengthsOf`: `birth` が `null` のときは通らない(線全体が点線のため)が、念のため `null` を安全に扱う

### 6. timeline-view.js(UIレイヤー)

- `describeTimeline`: 生年の部分に `startLabelOf` を使う(例: 「卑弥呼 生年不明〜248年」)

### 7. result-view.js(UIレイヤー)

- `kind: 'gap'` で `gapYears` が `null` のとき: `{elder}が亡くなってから約{deathGapYears}年後に{younger}が亡くなっており、同じ時代ではありません({younger}の生年は不明です)`
- 判定不可の文章を、理由ごとに組み立てる
  - 生年不明のみ: `{名前}の生年が不明なため、同じ時代かどうかを判定できません`
  - 没年不明のみ: `{名前}の没年が不明なため、…`(既存)
  - 両方: `{生年不明の名前}の生年と{没年不明の名前}の没年が不明なため、…`

### 8. person-input.js(UIレイヤー)

- 変更なし(`formatLifespan` の変更で `(?–248年)` と表示される)

## データフロー

### 卑弥呼と織田信長を比べる
```
1. parsePerson(卑弥呼): 生年 somevalue → 没年 248 → { birth: null, death: 248年, lifeStatus: 'deceased' }
2. 候補一覧: 卑弥呼(?–248年)
3. drawSpanOf: 198〜248(isTentativeStart)→ 点線、左端「生年不明」、右端「248年」
4. comparePeople: 生年不明は卑弥呼のみ。織田信長の生年 1534 > 248 → gap(gapYears = 1286)
5. 結果: 卑弥呼が亡くなってから約1286年後に、織田信長が生まれました
```

## エラーハンドリング戦略

- 変更なし。生年・没年の値が不正な場合は、既存どおり「データなし」として扱う

## テスト戦略

### ユニットテスト
- `person-parser.test.js`
  - 生年が「不明な値」で没年がある人物(卑弥呼のフィクスチャ)は `birth: null`、`lifeStatus: 'deceased'` のPersonになる(既存の「nullを返す」テストを置き換える)
  - 生年が未登録で没年がある人物はPersonになる
  - 生年がわからず、没年が「不明な値」・未登録の人物は `null` を返す
- `years.test.js`
  - `formatLifespan(null, 248年, 'deceased')` は `"?–248年"`
- `comparison.test.js`
  - `lifespanOf`: 生年不明の人物は `startAstroYear` が `null`
  - 生年不明の人物の没年より後に相手が生まれた → gap(相手が1人目・2人目のどちらでも)
  - 相手が没年と同じ年に生まれた → 判定不可(同じ年に生まれた場合は、既存の重なり0年の扱いと違い、生年不明の人物が生きていたかわからないため)
  - 相手が没年の121年以上前に亡くなった → gap(`gapYears: null`、`deathGapYears`、elderが相手)
  - 相手がちょうど没年の120年前に亡くなった → 判定不可(境界)
  - 相手が没年より前に生まれ、没年の120年前より後に亡くなった → 判定不可(`unknownBirthPeople` に生年不明の人物)
  - 2人とも生年不明 → 判定不可
  - 生年不明と没年不明 → 判定不可(`unknownBirthPeople` と `unknownPeople` の両方)
  - 生年不明で没年があいまいな年 → gapのとき `approximate: true`
- `timeline-scale.test.js`
  - 生年不明の人物は没年−50年を仮の開始年とし、`isTentativeStart: true`

### 手動テスト
- 「卑弥呼」で「卑弥呼(?–248年)」が候補に出る
- 卑弥呼の線が点線で描かれ、左端に「生年不明」、右端に「248年」
- 卑弥呼と織田信長で「卑弥呼が亡くなってから約1286年後に、織田信長が生まれました」
- 卑弥呼と孔子(前551–前479)で「孔子が亡くなってから約726年後に卑弥呼が亡くなっており、同じ時代ではありません(卑弥呼の生年は不明です)」
- 卑弥呼と出雲阿国(没年不明)で、両方の理由の文章

## 依存ライブラリ

なし。

## ディレクトリ構造

```
src/data/person-parser.js               (変更)
src/logic/years.js                      (変更)
src/logic/comparison.js                 (変更)
src/logic/timeline-scale.js             (変更)
src/ui/timeline/person-row.js           (変更)
src/ui/timeline-view.js                 (変更)
src/ui/result-view.js                   (変更)
tests/unit/data/person-parser.test.js   (変更)
tests/unit/logic/years.test.js          (変更)
tests/unit/logic/comparison.test.js     (変更)
tests/unit/logic/timeline-scale.test.js (変更)
docs/product-requirements.md            (変更)
docs/functional-design.md               (変更)
docs/glossary.md                        (変更)
docs/manual-test-checklist.md           (変更)
```

## 実装の順序

1. データレイヤー(person-parser)のテストと実装
2. ロジックレイヤー(years → comparison → timeline-scale)のテストと実装
3. UIレイヤー(person-row → timeline-view → result-view)の実装
4. 永続ドキュメントの更新
5. ユニットテスト・実データ・手動テスト

## セキュリティ考慮事項

- なし(表示する文字列はすべて `textContent` で入れる既存の方式のまま)

## パフォーマンス考慮事項

- なし(通信・データ量は変わらない)

## 将来の拡張性

- 没年不明の人物にも、生年不明と同じ「確実に重ならない場合は重なりなし」の判定を広げられる(`comparePeople` の分岐を対称にする)
- 活動時期(P1317)が登録されている人物は、仮の描画範囲をより正確にできる
