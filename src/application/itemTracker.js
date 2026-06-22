// 問題ごとの打鍵・ミス・時間を集計し、問題が切り替わる時/終了時に記録する。
// 入力フック(useMarathon/useWords/useDict)から使う。id は問題ごとに一意な文字列。
import { recordItemStat } from '../infrastructure/itemStatsRepository.js'

export const newTracker = () => ({ cur: null, keys: 0, mistakes: 0, start: 0, last: 0 })

// 正しい打鍵ごとに呼ぶ。id が変わったら前の問題を記録して新しい問題を開始。
export function trackKey(tr, id) {
  const now = performance.now()
  if (tr.cur !== id) {
    flushTracker(tr)
    tr.cur = id
    tr.start = now
  }
  tr.keys += 1
  tr.last = now
}

export function trackMiss(tr) {
  if (tr.cur) tr.mistakes += 1
}

// 現在の問題を記録してリセット（問題切替・終了時）。
export function flushTracker(tr) {
  if (tr.cur && tr.keys > 0) {
    recordItemStat(tr.cur, { keys: tr.keys, mistakes: tr.mistakes, ms: Math.max(0, tr.last - tr.start) })
  }
  tr.cur = null
  tr.keys = 0
  tr.mistakes = 0
  tr.start = 0
  tr.last = 0
}
