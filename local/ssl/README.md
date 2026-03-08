# SSL ローカル構成

`local/ssl/` は `setn.shop` の Let`s Encrypt 発行作業用です。

## 構成

- `local/ssl/scripts/`
  実行スクリプト
- `local/ssl/state/`
  CSR、秘密鍵、Certbot の状態ファイル、ログ
- `local/ssl/.venv-certbot/`
  Certbot 実行用の仮想環境

## 実行ファイル

- `local/ssl/scripts/certbot_no_admin.py`
  Windows の管理者権限チェックを回避する Certbot ラッパー
- `local/ssl/scripts/generate_setn_shop_csr.py`
  `setn.shop` 用の秘密鍵と CSR を生成する
- `local/ssl/scripts/issue_setn_shop_letsencrypt.ps1`
  DNS-01 で Let`s Encrypt を発行する
- `local/ssl/DNS_SETUP.md`
  Value-Domain に TXT を入れる手順と、`権限がありません` の対処

## 実行コマンド

```powershell
powershell -ExecutionPolicy Bypass -File .\local\ssl\scripts\issue_setn_shop_letsencrypt.ps1
```

## 現在あるファイル

- `local/ssl/state/config/setn.shop.key.pem`
- `local/ssl/state/config/setn.shop.csr.pem`

## 発行完了後にできるファイル

- `local/ssl/state/config/setn.shop.cert.pem`
- `local/ssl/state/config/setn.shop.chain.pem`
- `local/ssl/state/config/setn.shop.fullchain.pem`

今は Let`s Encrypt の challenge 完了前なので、`setn.shop.cert.pem` などはまだ存在しません。

## Value-Domain に貼るもの

発行完了後に以下を使います。

- コモンネーム: `setn.shop`
- 証明書: `setn.shop.cert.pem`
- 中間証明書: `setn.shop.chain.pem`
- プライベートキー: `setn.shop.key.pem`
