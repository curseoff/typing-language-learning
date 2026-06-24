// マラソンの出題（パッセージ）生成。
import { buildUnits } from '../typing/units.js'

export const TARGET_KEYS = 600 // この文字数を打ち切ったら終了

// pool（出題対象の文配列。呼び出し側がレベル別に遅延読み込みして渡す）からセグメント列を作る。
// 各文は buildUnits でセグメント化し、sentenceIndex を付与して連結（600文字を超えるまで）。
export function buildPassage(mode, pool) {
  const base = pool && pool.length ? pool : []
  if (base.length === 0) return []
  const shuffled = [...base].sort(() => Math.random() - 0.5)
  const segments = []
  let approx = 0
  let si = 0 // 文の通し番号
  let idx = 0
  while (approx < TARGET_KEYS + 60) {
    const s = shuffled[idx % shuffled.length]
    for (const seg of buildUnits(s, mode)) {
      segments.push({ ...seg, sentenceIndex: si })
      approx += seg.canonical.length
    }
    si += 1
    idx += 1
  }
  return segments
}
