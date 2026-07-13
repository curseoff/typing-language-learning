---
description: 現在の feature ブランチを develop へ PR して CI 緑を待ってマージ。自己点検→check→push→PR(Closes #N)→CI待ち→マージ→ローカル掃除→Issue更新まで一気通貫。
argument-hint: "[Issue番号（省略時は自動検出）]"
---

現在の feature ブランチを **develop へ PR してマージ**するまでを一気通貫で行う。`$ARGUMENTS` があれば対応 Issue 番号として扱う（省略時は自動検出）。**日本語で報告**する。CLAUDE.md の規約（自己点検・`Closes #N`・`env -u GITHUB_TOKEN gh`・ローカル掃除）に従う。

## 手順

1. **前提確認**：`git branch --show-current` が `feature/*` であること。`develop`/`master` に居るなら中止して本人に報告（このコマンドは feature ブランチ用）。作業ツリーに未コミットの変更があれば中止して知らせる（`tmp/` の gitignore 分は無視可）。

2. **Issue 特定**：`$ARGUMENTS` があればその番号。無ければコミットメッセージ（`git log develop..HEAD` の `(#N)` / `Closes #N`）やブランチ名から検出。特定できなければ本人に確認（`Closes #N` を空にしない）。

3. **自己点検（push 前・必須）**：`git fetch origin --prune` の後、未 push 差分 `origin/develop..HEAD`（無ければ `develop..HEAD`）を秘密情報（APIキー/トークン/パスワード/秘密鍵・`.env`）・個人情報（氏名/メール直書き）・絶対パスでの username 露出でスキャン。**問題があれば push せず中止して報告**。問題なければ「クリア」と伝える。

4. **check（冗長回避）**：委任先が既に full `npm run check` を緑にした差分をそのまま進める場合は、ここで full `check` を**再実行しない**（差分未変更が前提。full `check` は次の push 前フックと CI が担保する）。差分に手を入れた／緑が未確認なら `npm run check:fast` で素早く確認（赤なら中止して要点を報告）。**full `check` の権威ゲート＝push 前フック（`.githooks/pre-push`）＋CI**。

5. **台帳更新**：`npm run team:set -- --agent commander --status 実行中 --task "feature→develop PR/マージ" --branch <ブランチ名> --issue '#<N>'`。

6. **push**：`git push -u origin <ブランチ名>`（AI 鍵は settings 経由で自動）。

7. **PR 作成**：`env -u GITHUB_TOKEN gh pr create --base develop --title "<変更内容の簡潔な日本語要約>" --body "Closes #<N>"`（適切なら `--label` も）。title は diff とコミットから決める。**本文に必ず `Closes #<N>`**（develop マージで `on-develop` ラベルが自動付与される）。

8. **CI 待ち**：`env -u GITHUB_TOKEN gh pr checks <PR番号> --watch`（または数秒間隔でポーリング）。**緑を確認**してから次へ。赤なら中止して失敗ジョブの要点を報告。

9. **マージ**：`env -u GITHUB_TOKEN gh pr merge <PR番号> --merge --delete-branch`（リポジトリの様式＝マージコミット。リモートは auto-delete だが明示）。

10. **ローカル掃除**（CLAUDE.md 準拠）：`git checkout develop && git pull --ff-only origin develop && git branch -D <feature ブランチ> && git fetch origin --prune`。※ `issue-assets`・`feature/srs-review`(#85)・保留中の作業ブランチは消さない。

11. **Issue 更新**：Issue #<N> の**本文チェックリスト**の該当項目を `- [x]` に更新（`env -u GITHUB_TOKEN gh issue edit`）。**develop にマージされ、かつ全チェック項目が完了していれば `gh issue close #<N>`**。未完なら閉じない（早すぎる Close を避ける／master 到達での auto-close は保険）。

12. **台帳を完了に**：`npm run team:set -- --agent commander --status 完了 --task "#<N> を develop へマージ" --branch develop --next -`。

13. **報告**：PR 番号/URL、CI 結果、マージ可否、削除したローカルブランチ、Issue の更新/Close 状況を日本語でまとめる。

## 注意
- 破壊的/外部公開の操作（push・PR・マージ）はこのコマンドの明示指示に含まれるので実行してよい。ただし**自己点検で問題を見つけたら必ず止めて報告**する。
- CI が長引く場合は `run_in_background` やポーリング間隔を工夫し、無限リトライしない。2〜3 回失敗したら本人に相談。
