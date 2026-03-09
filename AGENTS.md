# プロジェクトメモ

## 概要

- このフォルダでは `seetona.com` / `www.seetona.com` 向けのホームページと軽量 Python CGI アプリを管理している
- トップページでは Three.js の 3D ロゴを回せる
- 同じページの中でマインスイーパーとバイナリシミュレーションを遊べる
- 本番基準は `publish/`。XREA 上の Python CGI 配備を前提にしている
- `publish2/` はホームページ部分の静的確認用コピー
- `local/` は公開しない運用資料、DNS/SSL 手順、診断メモの置き場

## 現在の実装方針

- 公開向けの修正はまず `publish/` を基準に考える
- `publish2/` は `publish/static/` の静的確認コピーとして扱う
- `publish2/app.js` と `publish/static/app.js` は同内容
- `publish2/styles.css` と `publish/static/styles.css` は同内容
- `publish2/index.html` は静的確認向けに参照パスを切り替えた別コピーとして扱う
- `publish/runtime/` 以下の JSON はセッションや日次キャッシュの生成物で、通常は手編集しない
- `local/ssl/.venv-certbot/` と `local/ssl/state/` は大きく、かつ機微情報を含むので、SSL 作業時以外は深入りしない
- 旧 `setn.shop` 系の公開・SSL 作業メモも残っているが、現在の主目的は `seetona.com` の整備

## ディレクトリ構成

- `publish/`
  XREA 公開を前提にした本番用アプリ一式
- `publish/static/`
  実際に配信するホームページ用の HTML、CSS、JavaScript
- `publish/runtime/`
  非公開ランタイム
- `publish/runtime/sessions/`
  マインスイーパーのセッション JSON
- `publish/runtime/binary_sessions/`
  バイナリシミュレーションの残高・ポジション JSON
- `publish/runtime/binary_case_cache/`
  日次のヒストリカルケース JSON
- `publish/tests/`
  Python の `unittest`
- `publish2/`
  ホームページ部分だけを単体で確認しやすくした静的ファイル一式
- `local/`
  ローカル専用の運用メモ、DNS/SSL 手順、接続情報、診断レポート
- `local/ssl/`
  旧 `setn.shop` 向け Let`s Encrypt 作業資産
- `README.md`
  ルートの概要メモ。旧 `setn.shop` 記述が残っており、現状とズレる箇所がある
- `publish/README.md`
  公開用メモ。これも旧 `setn.shop` ベースの説明が残っている
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
- `publish/binary_sim.py`
  バイナリシミュレーションの状態管理とヒストリカルケース生成
- `publish/static/index.html`
  `www.seetona.com` 向けホームページ本体
- `publish/static/app.js`
  Three.js の 3D ロゴ演出、言語切替、ゲーム切替、ゲーム API 呼び出し
- `publish/static/styles.css`
  現在のホームページ全体のスタイル
- `publish/static/style.css`
  旧マインスイーパー単体ページ向けスタイル。現行 `index.html` では未使用
- `publish/.htaccess`
  HTTPS / ホスト統一リダイレクトと公開制御
- `publish/runtime/.htaccess`
  `runtime/` 直アクセス拒否
- `publish/tests/test_app_core.py`
  ルーティング、静的配信、Cookie、binary API エラー処理のテスト
- `publish/tests/test_minesweeper.py`
  マインスイーパーのテスト
- `publish/tests/test_binary_sim.py`
  バイナリシミュレーションのテスト
- `publish2/index.html`
  ホームページの静的確認用 HTML
- `publish2/app.js`
  静的確認用の演出・UI スクリプト
- `publish2/styles.css`
  静的確認用のスタイル
- `local/SEETONA_SETUP.md`
  `www.seetona.com` への切り替え手順
- `local/SEETONA_APEX_FIX_XREA_20260309.md`
  `seetona.com` apex を XREA 通常サイト + 無料 SSL で直すメモ
- `local/SEETONA_APEX_LETSENCRYPT_REDIRECT_20260309.md`
  `seetona.com` apex を Let`s Encrypt + 独自 SSL で受けて `www` へ 301 する手順
- `local/SEETONA_VULN_REPORT_20260309.md`
  2026-03-09 時点の脆弱性診断と優先修正メモ
- `local/webconf.md`
  ホスティング接続情報
- `local/ssl/README.md`
  旧 `setn.shop` 向け SSL 発行手順
- `local/ssl/DNS_SETUP.md`
  Let`s Encrypt 用 DNS 設定メモ

## いま動いているもの

- ホームページのファーストビューに Three.js の 3D ロゴ演出がある
- ロゴはドラッグやタッチで回せる
- 日本語 / 英語の切替に対応している
- ゲーム棚 UI があり、`minesweeper` と `binary` は playable
- `planet` `management` `tetris` `solitaire` は見せ枠だけあり、まだ未実装
- マインスイーパー
  - 難易度は `easy` `medium` `hard`
  - 初手安全
  - ゲーム状態は `publish/runtime/sessions/` に保存する
- バイナリシミュレーション
  - 初期残高は `1,000,000 JPY`
  - 対応通貨ペアは `USD/JPY` `EUR/JPY` `GBP/JPY`
  - 取引時間は `30` / `60` / `180` 秒
  - 残高とポジションは `publish/runtime/binary_sessions/` に保存する
  - 日次ケースは `publish/runtime/binary_case_cache/` に保存する
  - バックエンド実装上の現行プロバイダは `Historical Replay` で、`Frankfurter` の履歴データから当日用ケースを作る
- フロント側では binary 状態を 1 秒ごとにポーリングしている

## API と配信

- `app.xcg?action=state|new|reveal|flag` がマインスイーパー API
- `app.xcg?action=binary_state|binary_trade|binary_reset` がバイナリ API
- `/api/` 配下も `app_core.py` が同じ API に流す
- `/`, `/index.html`, `/app.xcg`, `/app.py` は `publish/static/index.html` を返す
- ルート直下の `styles.css` と `app.js` も静的配信する
- `publish/.htaccess` では `setn.shop` と `seetona.com` apex を `https://www.*` へ寄せ、`runtime/` `tests/` `__pycache__/` 直アクセスを遮断している

## 運用メモ

- 公開用の修正はまず `publish/` を基準に考える
- `publish2/` を残す場合は、ホームページ変更を意図的に同期する
- `local/` 以下は公開しない
- `runtime/` 以下の JSON は生成物として扱い、通常は直接編集しない
- `README.md` と `publish/README.md` には `setn.shop` や旧公開 URL の記述が残っているので、現状確認ではコードと `local/` の新しいメモを優先する
- `local/SEETONA_VULN_REPORT_20260309.md` にはセキュリティヘッダ不足とセッション ID 検証不足の指摘が整理されている
- apex の DNS / SSL / リダイレクトを触る前に `local/SEETONA_APEX_FIX_XREA_20260309.md` と `local/SEETONA_APEX_LETSENCRYPT_REDIRECT_20260309.md` を読む
- 大量探索をするときは `local/ssl/.venv-certbot/` と `local/ssl/state/` を避ける

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
- 現在の 3D ロゴは `three` とその追加モジュールを CDN から読み込んでいる
- binary UI には live provider の文言も残るが、Python バックエンドで実装されているのはヒストリカル再生ベースの状態管理
