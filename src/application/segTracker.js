// 1プレイの「問題ごとの記録」(segStats)を作る共有ヘルパ。
// 各セグメント（語/文）の最初の打鍵時刻とミス数を追い、完了時に1件積む。
// 記録に segStats として保存し、結果ページ・記録詳細で表示する。
export const newSegTracker = () => ({ list: [], start: null, mistakes: 0 })

// セグメントの最初の打鍵時刻を記録（既に開始済みなら無視）
export function segMark(tr, t) {
  if (tr.start === null) tr.start = t
}

export function segMiss(tr) {
  tr.mistakes += 1
}

// セグメント完了（または打ち切り partial=true）で1件積む。keys=その語/文の打鍵数、t=完了時刻。
export function segPush(tr, { type, label, keys, t, partial = false }) {
  const ms = tr.start != null ? t - tr.start : 0
  tr.list.push({
    no: tr.list.length + 1,
    type,
    label,
    keys,
    mistakes: tr.mistakes,
    seconds: Math.round(ms / 100) / 10,
    speed: ms > 0 ? Math.round(keys / (ms / 60000)) : 0,
    partial,
  })
  tr.start = null
  tr.mistakes = 0
}
