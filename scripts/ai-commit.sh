#!/usr/bin/env bash
# AI（サブエージェント/司令塔）が AI 名義・SSHローカル鍵署名（Verified付き・1Password非依存）で
# コミットするためのヘルパ。氏名/メール等の個人情報は committed ファイルに書かず、
# ローカルの git config（ai.*）から読む。push はしない（push/PR は本人指示で司令塔が行う）。
#
# 使い方:  scripts/ai-commit.sh -m "簡潔な日本語・辞書形のメッセージ"
#   （-m 以外の git commit 引数もそのまま渡せる。ステージングは事前に git add で行う）
#
# 一度だけのローカル設定（.git/config に保存・コミットされない）:
#   git config ai.name         "<氏名> (AI)"          # 例: 名前 (AI)
#   git config ai.committerEmail "<検証済みメール>"     # GitHub 検証済み＝Verified の要件
#   git config ai.authorEmail    "<+ai 別名メール>"     # 例 name+ai@…
#   git config ai.signingKey     "~/.ssh/ai-signing.pub" # SSH 署名公開鍵（Signing key 登録済み）
set -euo pipefail

need() { git config "ai.$1" 2>/dev/null || { echo "✖ git config ai.$1 が未設定です。docs/DEVELOPMENT.md「Git コミット（AI署名）」の初回設定を実施してください。" >&2; exit 1; }; }

name="$(need name)"
committer_email="$(need committerEmail)"
author_email="$(need authorEmail)"
key="$(need signingKey)"
# ~ を展開
key="${key/#\~/$HOME}"

GIT_COMMITTER_NAME="$name" GIT_COMMITTER_EMAIL="$committer_email" \
  git -c gpg.format=ssh -c commit.gpgsign=true -c gpg.ssh.program=ssh-keygen \
      -c user.signingkey="$key" \
      commit --author="$name <$author_email>" "$@"
