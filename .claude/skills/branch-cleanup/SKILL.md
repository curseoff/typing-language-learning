---
name: branch-cleanup
description: マージ済みローカルブランチの片付け手順。PR をマージした直後、`git branch` が溜まったとき、どれを消してよいか判断したいときに読む。削除可否の確かめ方と、消してはいけない例外ブランチを含む。
---

# ブランチの片付け

**リモートは GitHub の auto-delete が消す。ローカルは自分で消す。**

## PR マージ直後の定型

```bash
git checkout develop
git pull --ff-only origin develop
git branch -D <消すブランチ>
git fetch origin --prune
```

`-D`（大文字）を使うのは、マージコミット方式だと `-d` が「未マージ」と誤判定することがあるため。**だから消す前に到達確認をする**（下記）。

## 消してよいか確かめる

`-D` は問答無用で消すので、**中身が develop に入っているかを先に確認**する。

```bash
# develop から見て未マージのコミットが残っていないか（空なら安全）
git log origin/develop..<ブランチ> --oneline
```

出力が**空なら削除可**。行が出たら、それは develop に届いていないコミット＝**消すと失われる**。

一覧で見るなら：

```bash
git branch --merged origin/develop        # develop に入り切っているローカルブランチ
git branch -vv | grep ': gone]'           # リモートが消えている（＝マージ後 auto-delete 済み）
```

`: gone]` が付いているものは**リモート側で既にマージ＆削除されている**ので、片付け候補として最も確実。

## 消してはいけない例外

| ブランチ | 理由 |
|---|---|
| `issue-assets` | Issue に貼る画像のホスティング用。**PR を出さない＝永久にマージされない**ので、判定上は常に「未マージ」に見える |
| `feature/srs-review` (#85) | 保留中の作業。まだ着地していない |
| 作業中の feature ブランチ | 言うまでもなく |

**`develop` と `master` は絶対に消さない。**

## まとめて片付けるとき

一括削除は事故りやすいので、**まず一覧を出して目で確認してから**消す。

```bash
git fetch origin --prune
git branch --merged origin/develop | grep -vE '^\*|develop|master|issue-assets|srs-review'
```

出た一覧に**残すべきものが混ざっていないか確認**してから、必要なものだけ `git branch -D` する。パイプで `xargs` に直結して消さない。

## 消してしまったとき

`git branch -D` の出力にハッシュが表示されているので、それで復活できる。

```bash
git branch <名前> <表示されたハッシュ>
# 出力を控えていない場合
git reflog
```

reflog の保持期間内（既定 90 日）なら拾える。

---

ブランチ運用そのもの（`feature/*` → `develop` → `master`、develop と master の乖離、PR の作り方）は `git-flow` スキル。
