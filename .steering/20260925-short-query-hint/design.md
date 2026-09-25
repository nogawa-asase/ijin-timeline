# 設計書

## アーキテクチャ概要

`src/ui/person-input.js` の中だけの変更。検索・データ・ロジックの各レイヤーは変えない。0件のときに表示するメッセージを、検索語の長さで出し分ける。

```
runSearch(query)
  → searchPeople(query) → people
  → showCandidates(people, query)
       people が0件 → 検索語が2文字以下なら短い入力向けの案内、そうでなければ従来のメッセージ
```

## コンポーネント設計

### 1. person-input.js

**責務**:
- (追加)0件のときのメッセージを、検索語の長さで出し分ける

**実装の要点**:
- 定数を追加する
  - `SHORT_QUERY_LENGTH = 2`(この文字数以下を短い入力とみなす)
  - `MESSAGE_NOT_FOUND_SHORT_QUERY = '該当する人物が見つかりませんでした。名前をもう少し長く入力してみてください'`
- 関数 `notFoundMessageOf(query)` を追加し、検索語の文字数が `SHORT_QUERY_LENGTH` 以下なら短い入力向けのメッセージを返す
  - 文字数は `Array.from(query).length` で数える(サロゲートペアの文字を1文字として数えるため)
- `showCandidates(people)` を `showCandidates(people, query)` にし、0件のときに `notFoundMessageOf(query)` を表示する
  - 呼び出し元は `runSearch` の2か所(同じ検索語の再表示、検索完了時)。どちらも `query` を渡す
- 表示先は既存の状態表示の領域(`aria-live="polite"`)のまま

## データフロー

### 「紫」と入力した場合
```
1. 0.3秒のデバウンス後に runSearch('紫')
2. searchPeople('紫') → [](上位20件に人物なし)
3. showCandidates([], '紫') → 1文字なので「該当する人物が見つかりませんでした。名前をもう少し長く入力してみてください」
```

## エラーハンドリング戦略

- 変更なし(通信エラーのメッセージは従来どおり)

## テスト戦略

### ユニットテスト
- `person-input.js` はDOMを使うUIレイヤーのため、開発ガイドラインのテスト方針どおりユニットテストの対象外。既存のユニットテストがすべて通ることを確認する

### 手動テスト
- 「紫」→ 短い入力向けの案内
- 「紫式」→ 紫式部が候補に出る
- 「あいうえおかきくけこ」→ 従来のメッセージ
- 「織田」→ 候補が表示される
- スクリーンリーダーの読み上げ(可能な範囲で。少なくとも `aria-live` の領域に表示されることを開発者ツールで確認)

## 依存ライブラリ

なし。

## ディレクトリ構造

```
src/ui/person-input.js          (変更)
docs/product-requirements.md    (変更: 機能1の受け入れ条件、ユーザビリティのエラーメッセージ)
docs/functional-design.md       (変更: エラーハンドリングの表)
docs/glossary.md                (変更: 画面の文言)
docs/manual-test-checklist.md   (変更: 確認項目)
```

## 実装の順序

1. `person-input.js` を変更する
2. 永続ドキュメントを更新する
3. ユニットテストの実行と手動テスト

## セキュリティ考慮事項

- なし(固定の文言を `textContent` で表示する既存の方式のまま)

## パフォーマンス考慮事項

- なし

## 将来の拡張性

- 短いとみなす文字数は `SHORT_QUERY_LENGTH` の1か所で変えられる
