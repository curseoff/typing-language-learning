#!/bin/bash
# Claude Code ステータスライン：稼働台帳(tmp/agent-status.md)を
# 「エージェントごとに1行（重複なし・最新の行）」で、列を揃えて表示する。
#   列: <状態マーク> <エージェント名> ｜ <最終実行日時> ｜ <状態> ｜ <結果・備考>
#   最終実行日時は台帳の「開始」列(YYYY-MM-DD HH:MM:SS まで対応・秒まで表示)。
#   旧形式の日付のみ行はそのまま日付で表示（列は19幅で揃える）。
#   状態が完了でも表示（最終実行日の新しい順）。司令塔・セットアップ等の主導役行は除外。
#   状態マーク: 🟢実行中 / 🟡要承認・要判断 / ✅完了 / ⚪その他
# ※ 台帳はローカル運用ファイル(gitignore)。本スクリプトは git 管理対象(scripts/)。
cat >/dev/null 2>&1   # stdin(セッションJSON)は使わないので捨てる
ledger="$(dirname "$0")/../tmp/agent-status.md"
[ -f "$ledger" ] || { printf '🤝 台帳なし'; exit 0; }

awk -F'|' '
  function trim(s){ gsub(/^ +| +$/, "", s); return s }
  /^\| *20[0-9][0-9]-/ {
    ag = trim($3)
    if (ag ~ /司令塔|セットアップ/) next          # 主導役・設定行は除外
    d = trim($2)                                  # 開始日時（ISO＝文字列比較で時系列一致）
    if (!(ag in recd) || d >= recd[ag]) {         # 新しい開始日時を採用（同日タイは追記順で後勝ち＝旧行の慣習）
      recd[ag] = d
      rec[ag] = d "\t" trim($5) "\t" trim($6)
    }
  }
  END { for (a in rec) print rec[a] "\t" a }       # date \t state \t note \t agent
' "$ledger" \
| sort -t "$(printf '\t')" -k1,1r \
| awk -F'\t' '
  BEGIN {
    # 状態の表示幅(全角=2)。列を揃えるため既知の状態は固定幅に詰める。
    sw["完了"]=4; sw["実行中"]=6; sw["要承認"]=6; sw["要判断"]=6; sw["転換"]=4; sw["保留"]=4; W=6
  }
  {
    date=$1; st=$2; note=$3; ag=$4
    mark = (st ~ /実行中/) ? "🟢" : (st ~ /要承認|要判断/) ? "🟡" : (st ~ /完了/) ? "✅" : "⚪"
    w = (st in sw) ? sw[st] : W           # 未知状態は詰めない(既定幅扱い)
    pad = W - w; sp=""; while (pad-- > 0) sp = sp " "
    printf "%s %-18s ｜ %-19s ｜ %s%s ｜ %s\n", mark, ag, date, st, sp, note
  }
  END { if (NR == 0) print "🤝 エージェント履歴なし" }
'
