---
description: リリース（develop→master）を事前監査・自己点検し、異常が無ければそのまま AI がリリースまで実行する。未リリース差分→bug-watcher/ddd-auditor→自己点検→版種別→npm run release→完了確認。
argument-hint: "[patch|minor|major]（省略時は差分から自動判定）"
---

**リリース（develop→master）を最後まで実行する**コマンド。事前監査（bug-watcher/ddd-auditor）と自己点検を行い、**異常が何もなければ、そのまま AI が `npm run release` を実行してリリースまで完了させる**（版上げ→check→PR→マージ→GitHub Release→デプロイ）。本人が `/release` を呼ぶこと自体がリリース実行の明示指示とみなす。`$ARGUMENTS` があれば版種別（patch|minor|major）として扱う。**日本語で報告**する。

**中止（AI は実行せず本人に報告）する条件**：未リリース分が空／bug-watcher が確証のある不具合を検出／ddd-auditor が重大な層・依存逸脱を検出／自己点検で秘密情報・個人情報を検出。これら「異常」があれば**リリースせず止めて報告**する。

## 手順

1. **同期・未リリース差分**：`git fetch origin --prune` の後、`git checkout develop` して develop に居ることを確認。未リリース分 `git log --oneline origin/master..origin/develop` を表示。**空なら「未リリース分なし」で終了**（リリース不要）。現在の `package.json` の version も表示。

2. **事前監査（並列・background）**：CLAUDE.md のリリース直前ルールに従い、未リリース分 `origin/master..origin/develop` を対象に **bug-watcher** と **ddd-auditor** を `run_in_background:true` で起動する。
   - bug-watcher：リグレッション/バグ調査。確証のある不具合は `bug` ラベルで Issue 化（本人常設許可）。
   - ddd-auditor：依存方向・層責務・domain 純粋性の監査。
   - 起動時に台帳へ記録：`npm run team:set -- --agent bug-watcher --status 実行中 --task "リリース前 未リリース分の不具合調査" --branch develop` と、同様に ddd-auditor 分。
   - **両方の結果を待って要点を報告**。完了時に `team:set` で `完了` へ更新。

3. **監査の裁定**：**確証のある不具合や層/依存の重大逸脱があればリリースを止め**、本人に判断を仰ぐ（対応 → 再監査の順）。問題なければ次へ。

4. **自己点検（外部公開前・必須）**：未リリース差分 `origin/master..origin/develop` を秘密情報（APIキー/トークン/パスワード/秘密鍵・`.env`）・個人情報（氏名/メール直書き）・絶対パスでの username 露出でスキャン。問題があれば止めて報告。

5. **版種別の決定**：`$ARGUMENTS` に patch|minor|major があればそれを採用。無ければ差分から自動判定する（**新機能追加＝minor／バグ修正・軽微のみ＝patch／破壊的変更＝major**）。判定した種別と理由を報告してから実行する。

6. **リリース実行（異常なしなら AI が実行）**：ここまでで異常が無ければ、AI がそのまま実行する。
   ```
   env -u GITHUB_TOKEN npm run release -- <level>
   ```
   - `GITHUB_TOKEN` を外して実行する（子プロセスの `gh` がキーチェーン認証を使えるように）。push は AI 署名鍵（settings の `GIT_SSH_COMMAND`）経由。
   - `npm run release` が自動で行うこと：自己点検→版上げ→`npm run check`→`release/x.y.z` ブランチ作成→master への PR→CI 待ち→マージ→GitHub Release→Pages デプロイ。**長時間かかるので `run_in_background:true` 推奨**、完了通知を待つ。
   - 失敗・中断したら止めて要点を報告（無限リトライしない）。

7. **完了確認（release 実行後）**：`git fetch origin --prune` して以下を確認・報告する。
   - `origin/master..origin/develop` と `origin/develop..origin/master` が**両方空（同期）**。
   - 対象 Issue が master 到達で **auto-close** されているか（未クローズで全項目完了なら手動 Close）。
   - ローカルブランチ掃除：`git branch -f master origin/master`、`release/x.y.z` などマージ済みローカルは `git branch -D`、`git fetch origin --prune`。※ `issue-assets`・`feature/srs-review`(#85)・未マージ作業ブランチは残す。
   - 台帳を更新：`npm run team:set -- --agent commander --status 完了 --task "リリース vX.Y.Z" --branch master --next -`。

## 注意
- **異常が無ければ AI がリリースまで実行してよい**（本人が `/release` を呼ぶこと＝リリース実行の明示指示）。ただし手順4までの「中止条件」に触れたら**必ず止めて報告**し、AI 判断でリリースしない。
- `env -u GITHUB_TOKEN ...` を使う（キーチェーン認証の上書き回避）。`gh` 単体呼び出しも同様。
- 監査や release の実行が長引いても無限リトライしない。詰まったら本人に相談。
