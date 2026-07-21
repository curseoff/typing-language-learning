---
name: push-selfcheck
description: 未push差分に秘密情報（APIキー/トークン/秘密鍵）・個人情報・絶対パスでの username 露出が混ざっていないかを1コマンドで点検する。push する前、PR を作る前、「この差分は公開して大丈夫か」を確認したいときに使う。手で grep を組み立てない。
---

# push 前の自己点検

リポジトリは **PUBLIC**。CLAUDE.md の規約どおり、push の前に未push差分を点検して本人に報告する。その点検を 1 コマンドにしたもの。

```
npm run push-selfcheck                      # origin/<現在のブランチ>..HEAD を走査
npm run push-selfcheck -- --verbose         # 該当行の中身も表示（該当箇所は伏せ字）
npm run push-selfcheck -- --base origin/master   # 走査の基点を明示（リリース前など）
```

upstream が無い新規ブランチは自動で `origin/develop..HEAD` にフォールバックする（その旨を出力）。差分ゼロならその旨を出して終了。

## 検出するもの（**追加行 `^+` のみ**が対象）

- **秘密情報** … `BEGIN ... PRIVATE KEY`、AWS(`AKIA…`)、GitHub(`ghp_`/`gho_`/`ghu_`/`ghs_`/`ghr_`)、OpenAI 風(`sk-…`)、Slack(`xox?-…`)、Google(`AIza…`)、`apiKey/secret/token/password = "リテラル"`
- **個人情報** … メールアドレス、および **`git config user.name` / `user.email` / `ai.*` から実行時に取得した本人識別子**（スクリプトに識別子は書かれていない）
- **絶対パス** … `/Users/<誰か>`、`/home/<誰か>`、`C:\Users\<誰か>`
- **鍵/環境ファイル** … 変更ファイル名の `.env` `.pem` `.key` `id_rsa` `id_ed25519`

`process.env.X` や `"<your-api-key>"` のような参照/プレースホルダ、`/touch/home/easy` のようなアプリのルートは対象外。

## 結果の扱い

- **exit 0**（`✓ 自己点検クリア`）… 走査範囲・変更ファイル数・追加行数を添えて本人に報告し、push 指示を仰ぐ。
- **exit 1** … ファイル名・行番号・種別が出る。**秘密情報が本物なら push しない**（履歴に残る）。止めて本人に報告し指示を仰ぐ。`--verbose` でも該当箇所は伏せ字（ログに秘密を残さない）。
- **誤検知** … 理由を添えて本人に報告する。恒久的に無視してよいものだけ `scripts/push-selfcheck.mjs` の `ALLOW` に**控えめに**追加（見逃すより誤検知の方がまし）。既知：`LICENSE` / `README.md` の著作権表記の氏名は意図的。

**補助ツールであって判断の代わりではない**。exit 0 でも差分の中身は目で確認すること。
