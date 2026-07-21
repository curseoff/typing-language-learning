---
name: git-flow
description: このリポジトリのブランチ運用・PR・リリースの詳細規約。ブランチを切るとき、PR を作るとき、マージ後の掃除をするとき、リリースするときに読む。`Closes #N` をどこに書くか、`on-develop` ラベルの仕組み、マージ済みブランチの削除と残す例外、リリース PR の head を `release/*` にする理由、GitHub Release の作り方を含む。
---

# ブランチ運用・PR・リリース（詳細）

**常時守る規則は CLAUDE.md にある**（`git push` と PR 作成は本人の明示指示があるときだけ／push 前の自己点検／`env -u GITHUB_TOKEN gh`）。このスキルはその実行手順の詳細。

## ブランチ

`feature/*` → `develop` → `master`

**develop と master は乖離しうる**ので、新ブランチの起点と差分を毎回確認する。

### マージ済みブランチは消す
PR がマージされたら、**リモート**は auto-delete が消し、**ローカルは `git branch -D` ＋ `git fetch origin --prune`** で自分で掃除する。

**手順・削除可否の確かめ方・残す例外（`issue-assets`／`feature/srs-review`）は `branch-cleanup` スキル。**

## `gh` の実行

必ず **`env -u GITHUB_TOKEN gh ...`**。不正な `GITHUB_TOKEN` 環境変数がキーチェーン認証を上書きするため。

## `Closes #N` は2回書く

**「feature→develop」と「develop→master」の両方の PR 本文に書く。**

自動クローズは **master（デフォルトブランチ）到達時のみ**発火する。develop 止まりでは閉じない。

### `on-develop` ラベル
develop マージ時に自動付与される（`.github/workflows/label-on-develop.yml` が PR の `Closes`/`Fixes`/`Resolves #N` を検出）。「develop に乗った（リリース待ち）」の目印。master 到達で auto-close。

**だから feature→develop PR にも必ず `Closes #N` を書く。**

### Issue を閉じるタイミング
**develop にマージされ、かつ全チェック項目が完了したら Close する**（master 到達の auto-close を待たない）。feature コミット単体（develop 未マージ）では閉じない＝早すぎる Close を避ける。

## check の回し方

何かを「完了」と言う前に **`npm run check`**（lint→coverage→validate→build→check-bundle→audit ＝ CI と同等。**`check` が通れば CI も通る**）。

ただし**同じ差分に full `check` を多重に回さない**：

| 場面 | 使うもの |
|---|---|
| 反復・委任先の自己確認・司令塔の中間確認 | **`check:fast`**（coverage の代わりに test） |
| 権威ゲート | **push 前フック（`.githooks/pre-push`）＋ CI に一任** |
| カバレッジ閾値を触る／実測が要る | 明示的に full `check` |

差分が変わっていないのに手で何度も full `check` を回さない。

**push 前フック**（`.githooks/pre-push`）が `check` を強制する（CI 赤の混入防止）。急ぐ時のみ `git push --no-verify`。**master/develop はブランチ保護で CI 緑必須**（赤ではマージ不可）。

### docs のみの PR は CI がスキップされる
ソース無変更（`CLAUDE.md` / `docs/` / `.claude/` のみ）の PR は `paths-ignore` により CI が走らず、**`BLOCKED` になってマージできない**。この場合は `gh pr merge <N> --merge --admin --delete-branch` で通す。

## UI 目視

撮影手順（`shots:play` / `screenshots` / `?preview=` の値・出力先・**本人の dev を落とさない規約**）は **`shots` スキル**。

## リリース

**`npm run release -- <patch|minor|major>`**（自己点検→版上げ→check→PR→マージ→Release→デプロイ）。

原則は本人実行。ただし **`/release` コマンドを本人が呼んだ場合は例外**で、事前監査（bug-watcher / ddd-auditor）と自己点検が全てクリアなら AI がそのままリリースまで実行してよい（`/release` の呼び出し自体が明示指示）。異常があれば止めて報告する。

### リリース PR の head は `release/*` ブランチ
develop 直接にしない（マージ時の auto-delete で **develop が消える**ため）。マージ後は develop と master を揃え、不要ローカルブランチを削除。

### 版上げと GitHub Release
- **`package.json` の `version` を上げる**（TOP 表示に出る）
- master 反映後に **GitHub Release を作成**（タグ `vX.Y.Z` ＝マージコミット、要約ノート）

```bash
env -u GITHUB_TOKEN gh release create vX.Y.Z --target <フルSHA> --latest --title ... --notes ...
```

**`--target` はフル SHA が必須。**

詳細は `docs/DEVELOPMENT.md`。
