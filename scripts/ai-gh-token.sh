#!/usr/bin/env bash
# AI（サブエージェント/司令塔）が GitHub App bot 名義で GitHub を操作するための
# インストールトークン（約1時間有効）を stdout に発行するヘルパ。
# App ID / 秘密鍵パス等の個人・環境固有値は committed ファイルに書かず、
# ローカルの git config（ai-gh.*）から読む（scripts/ai-commit.sh と同じ流儀）。
#
# 使い方:
#   GH_TOKEN=$(scripts/ai-gh-token.sh) env -u GITHUB_TOKEN gh issue create ...
#   GH_TOKEN=$(scripts/ai-gh-token.sh <owner> <repo>) env -u GITHUB_TOKEN gh pr merge ...
#   （owner/repo は省略時 curseoff / typing-language-learning。トークンは約1時間で失効するので都度発行する）
#
# 一度だけのローカル設定（.git/config に保存・コミットされない。詳細は docs/DEVELOPMENT.md）:
#   git config ai-gh.appId   "<App ID>"
#   git config ai-gh.keyPath "~/.config/curseoff-ai/<App>.private-key.pem"  # repo 外・600
set -euo pipefail

need() { git config "ai-gh.$1" 2>/dev/null || { echo "✖ git config ai-gh.$1 が未設定です。docs/DEVELOPMENT.md「AI の GitHub 操作（App bot）」の初回設定を実施してください。" >&2; exit 1; }; }

app_id="$(need appId)"
key="$(need keyPath)"
# ~ を展開
key="${key/#\~/$HOME}"

repo_owner="${1:-curseoff}"
repo_name="${2:-typing-language-learning}"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

now=$(date +%s)
header='{"alg":"RS256","typ":"JWT"}'
payload=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$((now-60))" "$((now+540))" "$app_id")

h=$(printf '%s' "$header"  | b64url)
p=$(printf '%s' "$payload" | b64url)
sig=$(printf '%s' "$h.$p" | openssl dgst -sha256 -sign "$key" | b64url)
jwt="$h.$p.$sig"

# このリポジトリのインストールIDを取得
inst_id=$(curl -fsSL -H "Authorization: Bearer $jwt" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$repo_owner/$repo_name/installation" \
  | grep -m1 '"id"' | grep -oE '[0-9]+')

# インストールトークンを発行して stdout に出す
curl -fsSL -X POST -H "Authorization: Bearer $jwt" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/app/installations/$inst_id/access_tokens" \
  | grep -m1 '"token"' | sed -E 's/.*"token": *"([^"]+)".*/\1/'
