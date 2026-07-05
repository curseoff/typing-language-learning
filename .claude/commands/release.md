---
description: リリース（develop→master）の事前監査と自己点検を行い、npm run release の実行コマンドを提示する（本人実行）。未リリース差分→bug-watcher/ddd-auditor→自己点検→版種別推奨→ハンドオフ。
argument-hint: "[patch|minor|major]（省略時は差分から推奨）"
---

**リリース（develop→master）の事前準備**を行い、最後に本人が実行する `npm run release` コマンドを提示する。リリース本体（版上げ→check→PR→マージ→GitHub Release→デプロイ）は CLAUDE.md 規約で**本人実行**なので、このコマンドは**そこまで自動実行しない**（監査と点検とハンドオフに徹する）。`$ARGUMENTS` があれば版種別（patch|minor|major）として扱う。**日本語で報告**する。

## 手順

1. **同期・未リリース差分**：`git fetch origin --prune` の後、`git checkout develop` して develop に居ることを確認。未リリース分 `git log --oneline origin/master..origin/develop` を表示。**空なら「未リリース分なし」で終了**（リリース不要）。現在の `package.json` の version も表示。

2. **事前監査（並列・background）**：CLAUDE.md のリリース直前ルールに従い、未リリース分 `origin/master..origin/develop` を対象に **bug-watcher** と **ddd-auditor** を `run_in_background:true` で起動する。
   - bug-watcher：リグレッション/バグ調査。確証のある不具合は `bug` ラベルで Issue 化（本人常設許可）。
   - ddd-auditor：依存方向・層責務・domain 純粋性の監査。
   - 起動時に台帳へ記録：`npm run team:set -- --agent bug-watcher --status 実行中 --task "リリース前 未リリース分の不具合調査" --branch develop` と、同様に ddd-auditor 分。
   - **両方の結果を待って要点を報告**。完了時に `team:set` で `完了` へ更新。

3. **監査の裁定**：**確証のある不具合や層/依存の重大逸脱があればリリースを止め**、本人に判断を仰ぐ（対応 → 再監査の順）。問題なければ次へ。

4. **自己点検（外部公開前・必須）**：未リリース差分 `origin/master..origin/develop` を秘密情報（APIキー/トークン/パスワード/秘密鍵・`.env`）・個人情報（氏名/メール直書き）・絶対パスでの username 露出でスキャン。問題があれば止めて報告。

5. **版種別の決定**：`$ARGUMENTS` に patch|minor|major があればそれを採用。無ければ差分から推奨する（**新機能追加＝minor／バグ修正・軽微のみ＝patch／破壊的変更＝major**）。理由も添える。

6. **ハンドオフ（本人実行）**：以下を提示し、本人にプロンプトで実行してもらう（`!` 前置きで当セッションに出力が入る）。
   ```
   ! npm run release -- <level>
   ```
   `npm run release` が自動で行うこと（自己点検→版上げ→`npm run check`→`release/x.y.z` ブランチ作成→master への PR→CI 待ち→マージ→GitHub Release→Pages デプロイ）を一言添える。

7. **完了確認（本人が release を実行した後）**：`git fetch origin --prune` して以下を確認・報告する。
   - `origin/master..origin/develop` と `origin/develop..origin/master` が**両方空（同期）**。
   - 対象 Issue が master 到達で **auto-close** されているか（未クローズで全項目完了なら手動 Close）。
   - ローカルブランチ掃除：`git branch -f master origin/master`、`release/x.y.z` などマージ済みローカルは `git branch -D`、`git fetch origin --prune`。※ `issue-assets`・`feature/srs-review`(#85)・未マージ作業ブランチは残す。
   - 台帳を更新：`npm run team:set -- --agent commander --status 完了 --task "リリース vX.Y.Z" --branch master --next -`。

## 注意
- リリース本体（push/マージ/デプロイ）は**本人実行**。このコマンドが勝手に `npm run release` を叩かない。
- `env -u GITHUB_TOKEN gh ...` を使う（キーチェーン認証の上書き回避）。
- 監査の CI/実行が長引いても無限リトライしない。詰まったら本人に相談。
