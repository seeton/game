# ローカル保存ファイル

`local/` は公開しないローカル専用データの置き場です。

現状の役割:

- `local/webconf.md`
  ホスティング接続情報と運用メモ
- `local/FTP_DEPLOY_WORKFLOW.md`
  普段使っている FTP 配備手順
- `local/ssl/`
  SSL 発行用のスクリプト、仮想環境、証明書生成物
- `local/SEETONA_SETUP.md`
  `seetona.com` を Cloudflare + XREA へ載せる手順

`local/` 直下には入口だけを置き、SSL 関連の実体は `local/ssl/` にまとめています。
