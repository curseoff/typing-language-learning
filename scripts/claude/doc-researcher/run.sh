#!/usr/bin/env bash
# claude 公式ドキュメントだけを根拠に質問へ答える調査モードで claude を起動する。
# 使い方:  npm run claude:doc-researcher
#          npm run claude:doc-researcher -- "ループ開発のやり方は？"   # 引数は初回プロンプトとして渡る
# 自動メモリと外部設定ソースを無効化し、Web 取得系のみ許可する。
set -euo pipefail

# このスクリプトからの相対で instructions.md を解決する（呼び出し元 cwd に依存しない）。
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 exec claude \
  --setting-sources "" \
  --append-system-prompt-file "$DIR/instructions.md" \
  --allowed-tools "WebFetch,WebSearch" \
  "$@"
