# Signal Sweep プロジェクト

Python で動くブラウザ版マインスイーパーです。

## 構成

- `publish/`
  公開用ファイル一式
- `local/`
  ローカル専用ファイル
- `local/webconf.md`
  接続情報
- `local/ssl/README.md`
  SSL 発行手順

## ローカル起動

```powershell
python publish/app.py
```

起動後にブラウザで `http://127.0.0.1:8000` を開きます。

## テスト

```powershell
python -m unittest discover -s publish/tests
```

## 公開状態

- 公開 URL: `https://www.setn.shop/`
- `www` 側は HTTPS 動作確認済み
- `setn.shop` 側は独自 SSL の設定作業中
