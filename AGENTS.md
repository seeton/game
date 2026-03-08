# プロジェクトメモ

## 概要

- このフォルダでは `seetona.com` のホームページを作成している
- ホームページでは 3D ロゴをくるくる回せる
- ホームページの中でマインスイーパーを遊べる
- 既存の Python バックエンドを使いながら、XREA で公開できる形に整えている

## いまの考え方

- `publish/` を本番向けの基準ディレクトリとして扱う
- `publish2/` はホームページ部分を切り出した静的確認用コピーとして扱う
- `local/` は公開しない運用資料と接続情報の置き場
- 旧 `setn.shop` 系の SSL 作業メモも残っているが、現在の主目的は `seetona.com` のホームページ整備

## ディレクトリ構成

- `publish/`
  XREA 公開を前提にした本番用アプリ一式
- `publish/static/`
  実際に配信するホームページ用の HTML、CSS、JavaScript
- `publish/runtime/`
  セッション保存先。`runtime/sessions/` にゲーム状態 JSON を置く
- `publish/tests/`
  Python の unittest
- `publish2/`
  ホームページ部分だけを単体で確認しやすくした静的ファイル一式
- `local/`
  ローカル専用の運用メモ、DNS/SSL 手順、接続情報
- `README.md`
  プロジェクト概要
- `publish.zip`
  公開ファイルの控え
- `.gitignore`
  将来 Git 管理するときの除外設定
- `.ignore`
  ローカル探索時のノイズ除外設定

## 主なファイル

- `publish/app.py`
  ローカル確認用サーバーの起動入口
- `publish/app.xcg`
  XREA 公開用 CGI エントリーポイント
- `publish/app_core.py`
  HTTP ルーティング、静的ファイル配信、ゲーム API、Cookie、セッション保存の中核処理
- `publish/minesweeper.py`
  マインスイーパーのゲームロジック
- `publish/static/index.html`
  `seetona.com` 向けホームページ本体
- `publish/static/app.js`
  Three.js の 3D ロゴ演出、言語切替、ゲーム API 呼び出し
- `publish/static/styles.css`
  現在のホームページ用スタイル
- `publish/tests/test_app_core.py`
  ルーティング、静的配信、Cookie 周りのテスト
- `publish/tests/test_minesweeper.py`
  ゲームロジックのテスト
- `publish2/index.html`
  ホームページの静的確認用 HTML
- `publish2/app.js`
  静的確認用の演出・UI スクリプト
- `publish2/styles.css`
  静的確認用のスタイル
- `local/SEETONA_SETUP.md`
  `seetona.com` / `www.seetona.com` の移行と公開手順
- `local/webconf.md`
  ホスティング接続情報
- `local/ssl/README.md`
  旧 `setn.shop` 向け SSL 発行手順
- `local/ssl/DNS_SETUP.md`
  Let`s Encrypt 用 DNS 設定メモ

## いま動いているもの

- ホームページのファーストビューに 3D ロゴ演出がある
- ロゴはドラッグやタッチで回せる
- 同じページ内でマインスイーパーを遊べる
- 日本語 / 英語の切替に対応している
- ゲーム状態はセッションファイルとして `publish/runtime/sessions/` に保存する

## 運用メモ

- 公開用の修正はまず `publish/` を基準に考える
- `publish2/` を残す場合は、ホームページの変更内容を意図的に同期する
- `local/` 以下は公開しない
- `local/ssl/` は主に旧ドメイン運用の作業ログ置き場として扱う

## ローカル実行

```powershell
python publish/app.py
```

起動後にブラウザで `http://127.0.0.1:8000` を開く。

## テスト

```powershell
python -m unittest discover -s publish/tests
```

## 現在の補足

- `publish/static/` と `publish2/` には似たホームページ資産がある
- `publish/static/` は Python CGI アプリに組み込まれた本番寄りの配置
- `publish2/` は単体プレビューしやすい作業用コピー
- `seetona.com` の公開手順は `local/SEETONA_SETUP.md` に整理してある
