# Signal Sweep

Python で動く、ブラウザプレイ対応のマインスイーパーです。

公開 URL:

- `http://www.setn.shop/`

## ローカルで起動する

リポジトリのルートディレクトリで次を実行します。

```powershell
python publish/app.py
```

起動後に `http://127.0.0.1:8000` を開いてください。

## テスト

```powershell
python -m unittest discover -s publish/tests
```

## 公開対象ファイル

外部公開してよいファイルは、この `publish/` ディレクトリ配下です。

主な対象:

- `app.py`
- `app.xcg`
- `app_core.py`
- `minesweeper.py`
- `static/`
- `tests/`
- `Dockerfile`
- `.htaccess`
- `runtime/`

## デプロイ

現在の `publish/` は XREA の Python CGI 配備を前提にしています。

配置手順:

1. `publish/` 配下の内容を `/public_html` にアップロードする
2. `app.xcg` に実行権限を付ける
3. 必要なら `runtime/` と `runtime/sessions/` に書き込み権限を付ける
4. `http://www.setn.shop/` にアクセスして動作確認する

補足:

- `index.html` がトップページとして読み込まれ、API は `app.xcg` を通して動作します
- `app.py` はローカル確認用です
- `runtime/` は `.htaccess` で外部公開されない前提です
