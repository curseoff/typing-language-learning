---
name: issue-sync
description: 着地したコミットを GitHub Issue のチェック項目 `- [x]` に反映する具体手順。コミットした直後、複数コミットをまとめて Issue に反映したいとき、サブエージェントのコミットを司令塔が拾うとき、どのコミットがどの項目に当たるか対応づけたいときに読む。本文の書き換えを事故なく行う gh コマンドと、候補一覧の表など本文の他の箇所も同期させる手順を含む。
---

# コミット → Issue チェック反映

**「Issue が要るか」「いつ Close するか」は `issue-driven` スキル。** ここは反映作業そのものの手順。

## 基本の3手

```bash
N=445   # Issue 番号
env -u GITHUB_TOKEN gh issue view $N --json body -q .body > /tmp/issue-$N.md
# /tmp/issue-$N.md を編集（該当行を - [ ] → - [x]）
env -u GITHUB_TOKEN gh issue edit $N --body-file /tmp/issue-$N.md
```

**必ず「取得 → 編集 → 全文で上書き」**。`gh issue edit --body "…"` に手書きの本文を渡すと、書いていない部分が消える。本文は常に取得したものを起点にする。

## 反映すべきコミットを洗い出す

develop に未マージのぶん：

```bash
git log origin/develop..HEAD --oneline
```

コミットメッセージの `(#N)` が対応 Issue。番号が無いコミットは、ブランチ名か diff の中身から対応づける。

**サブエージェント（coder / test-author / content-author）のコミットも司令塔が拾う。** 各役は自分のコミットを Issue に反映しないので、委任が終わったら上のログを必ず見る。どのコミットがどの項目に当たるかの対応づけは司令塔の仕事。

## 編集を事故なくやる

チェック行はテキストが長く、手で書き換えると別の行を巻き込みやすい。**置換したことを検証してから push する**のが安全。

```bash
python3 - <<'EOF'
import pathlib
p = pathlib.Path('/tmp/issue-445.md')
s = p.read_text()
for item in ['#14 `test-locate`', '#24 `issue-sync`']:
    before = f'- [ ] {item}'
    assert before in s, f'見つからない: {before}'      # ← 空振りを検出
    s = s.replace(before, f'- [x] {item}')
p.write_text(s)
EOF
```

`assert` を入れるのが要点。**チェック行の文言が記憶とズレていると `replace` は黙って何もしない**ので、成功したつもりで未更新のまま進んでしまう。

書き換え後に目視するなら：

```bash
grep -n '^- \[' /tmp/issue-445.md
```

## 本文の他の箇所も同期する

長い Issue には**チェックリスト以外にも状態を書いた箇所**がある（候補一覧の表、実装済みリスト、効果の実測値など）。チェックだけ更新すると表が古いまま残り、どちらが正かが読めなくなる。

反映のたびに本文全体を見て、次を揃える：

| 箇所 | やること |
|---|---|
| チェックリスト | `- [ ]` → `- [x]` |
| 候補一覧の表 | 採用マーク（`★`）→ 完了マーク（`✅`）など |
| 「実装済み」の列挙 | 今回ぶんを追記 |
| 効果の実測値 | 実測し直して更新（サイズ・件数など） |

## 反映後の確認

```bash
env -u GITHUB_TOKEN gh issue view $N --json body -q .body | grep -n '^- \['
```

**未完の項目が残っていれば Close しない。** 全項目が `- [x]` かつ develop にマージ済みのときだけ：

```bash
env -u GITHUB_TOKEN gh issue close $N
```

## Issue に無い作業をしてしまったら

黙って通さず、**本文のチェックリストに項目を追加**してから `- [x]` にする（経緯の説明が要るならコメントで補足）。追加も上と同じ「取得 → 編集 → 上書き」で行う。

---

`gh` は必ず `env -u GITHUB_TOKEN` を付ける（→ `git-flow` スキル）。
