# 要求内容

## 概要

`implementation-validator` による実装全体の検証(2026-09-25)で出た指摘のうち、推奨4件と提案2件に対応する。画面の見た目・動作は変えない。

## 背景

MVPのあと、5つの機能を追加した(検索件数の拡大、別名の表示、職業による除外、生年不明への対応、短い入力の案内)。これらを含めた現在の実装全体を `implementation-validator` で検証した。

- テストは111件すべて成功した。レイヤー間の依存ルールの違反もなかった
- 必須の指摘: 0件
- 推奨の指摘: 4件(古いコメント・ドキュメント、ファイル・関数の長さの目安の超過)
- 提案: 3件

開発ガイドラインでは、長さの目安(ファイル300行、関数40行)を超えたものはレビューで `[推奨]` として指摘し、分割するかどうかをその場で判断する。今回は分割すると判断した。

## 実装対象

### 1. [推奨-1] `wikidata-client.js` のJSDocの修正
- `searchPeople` の `@returns` が「人間かつ生年を持つ人物のみ」のままになっている。生年不明への対応後の仕様(機能設計書では「人間かつ生年または没年を持つ人物のみ」)に合わせて直す

### 2. [推奨-2] `docs/architecture.md` のファイル数の記述の修正
- 「JavaScriptファイルは機能設計書の9ファイル程度に留める」と書かれているが、`timeline-view.js` の分割後は11ファイルある。今回の分割でさらに増えるため、ファイル数ではなく考え方で書く

### 3. [推奨-3] `css/style.css` と `src/ui/person-input.js` の分割
- `css/style.css`(323行)から入力欄のスタイルを `css/person-input.css` に分ける
- `src/ui/person-input.js`(324行)から要素の作成と0件のときのメッセージの選択を `src/ui/person-input/` に分ける(`timeline-view.js` と同じ分割のしかた)
- 分割後は、どちらのファイルも300行以下になる

### 4. [推奨-4] `comparePeople` の分割
- `src/logic/comparison.js` の `comparePeople`(55行)を、40行以内の関数に分ける
- 戻り値は変えない

### 5. [提案-1] 生年がなく没年が「不明な値」の人物を除外することのコメント
- `parsePerson` の生年不明の分岐で、没年が「不明な値」(somevalue)の人物も除外していることと、その理由をコメントに書く
- ユニットテストは既にある(`person-parser.test.js`「生年がなく没年が「不明な値」の人物はnullを返す」)

### 6. [提案-3] `searchPeople` の生年不明の人物のテスト
- `wikidata-client.test.js` に、生年不明の人物(卑弥呼)が `searchPeople` の候補に含まれることのテストを追加する

## 受け入れ条件

- [ ] `searchPeople` のJSDocが「人間かつ生年または没年を持つ人物のみ」になっている
- [ ] `docs/architecture.md` にファイル数の古い記述が残っていない
- [ ] `css/style.css`、`css/person-input.css`、`src/ui/person-input.js`、`src/ui/person-input/` 内のファイルがどれも300行以下
- [ ] `comparison.js` のすべての関数が40行以内
- [ ] `node --test 'tests/**/*.test.js'` がすべて成功する(既存の111件+追加分)
- [ ] `node --check` で `src/` のすべてのJavaScriptに構文エラーがない
- [ ] レイヤー間の依存ルール(`docs/repository-structure.md`)を守っている
- [ ] 画面の見た目と動作が変わらない(ブラウザでの手動テスト。入力欄・候補一覧・クリア・0件・短い入力の案内・タイムライン・結果の文章)
- [ ] 永続ドキュメント(リポジトリ構造・開発ガイドライン・機能設計書・技術仕様書)と README に、分割後の構成が反映されている

## 成功指標

- 検証の推奨の指摘が0件になる
- 画面の動作は1つも変わらない(リファクタリングとドキュメントの修正のみ)

## スコープ外

以下は今回対応しません:

- [提案-2] 同じ人物を2つの入力欄で選んだときの表示(PRDの「今後の検討事項」に書いた既知の事項のため)
- 手動テストチェックリストで未実施のまま残っている環境(Android、Edge/Safari/Firefox、スクリーンリーダー、Fast 4Gでの実測)
- 新しい機能の追加、画面の見た目の変更

## 参照ドキュメント

- `docs/architecture.md` - 技術仕様書(パフォーマンス要件)
- `docs/repository-structure.md` - リポジトリ構造定義書(ファイルサイズの管理、依存関係のルール)
- `docs/development-guidelines.md` - 開発ガイドライン(関数設計、CSS、「目安」の数値の扱い)
- `docs/functional-design.md` - 機能設計書(person-input.js、comparison.js)
