#!/bin/bash
# Claude Code ステータスライン：稼働台帳(tmp/agent-status.tsv)を
# 「誰の番か」サマリ＋列を揃えた表で表示する薄いラッパ。
#   読み取りロジックは scripts/team-show.mjs に一本化（statusline はそれを呼ぶだけ）。
#   台帳が無ければ team-show 側が「台帳なし（未稼働）」を短く表示する。
# ※ 台帳はローカル運用ファイル(gitignore)。本スクリプトは git 管理対象(scripts/)。
cat >/dev/null 2>&1   # stdin(セッションJSON)は使わないので捨てる
node "$(dirname "$0")/team-show.mjs" 2>/dev/null || printf '台帳なし（未稼働）'
