# 偉人の時代

偉人が「同じ時代を生きていたか」が一目でわかるタイムライン。

2人の偉人の名前を入力して候補から選ぶだけで、生存期間を西暦の横軸上に線で描き、重なっていた期間と年齢関係を文章で表示します。人物のデータは [Wikidata](https://www.wikidata.org/) から取得します。

- 公開URL: https://nogawa-asase.github.io/ijin-timeline/
- 登録・インストール不要。スマホ・PCのブラウザで動きます

## 構成

HTML / CSS / JavaScript(ES Modules)のみで作られた静的Webページです。ビルドツール・npmパッケージは使用していません。

```
index.html        唯一のページ
css/              スタイル(全体の style.css と部品ごとのファイル)
src/app.js        エントリーポイント
src/ui/           UIレイヤー(入力欄・タイムライン・結果の文章)
src/logic/        ロジックレイヤー(年の計算・表記、比較)
src/data/         データレイヤー(Wikidataからの取得と変換)
tests/            ユニットテスト(Node.js組み込みのテストランナー)
docs/             設計ドキュメント
```

## 開発の始め方

devcontainerで開けば、追加のインストールは不要です。

```bash
# ローカルで確認(ES Modulesは file:// では動かないため、HTTPサーバー経由で開く)
python3 -m http.server 8000
# → http://localhost:8000/

# ユニットテスト
node --test 'tests/**/*.test.js'
```

詳しくは [開発ガイドライン](docs/development-guidelines.md) の「開発環境セットアップ」を参照してください。手動テストの手順は [手動テストチェックリスト](docs/manual-test-checklist.md) にあります。

## ドキュメント

- [プロダクト要求定義書](docs/product-requirements.md)
- [機能設計書](docs/functional-design.md)
- [技術仕様書](docs/architecture.md)
- [リポジトリ構造定義書](docs/repository-structure.md)
- [開発ガイドライン](docs/development-guidelines.md)
- [用語集](docs/glossary.md)

## ライセンス

ソースコードは [MIT License](LICENSE) です。人物データは Wikidata(CC0)に由来します。
