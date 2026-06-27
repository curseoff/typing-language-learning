// マラソンの出題（パッセージ）生成。
import { buildUnits } from '../typing/units.js'

export const TARGET_KEYS = 600 // （旧）この文字数を打ち切ったら終了。現在は時間制（TIME_LIMIT_MS）。
export const TIME_LIMIT_MS = 60000 // 最初の打鍵から60秒で終了（全モード共通）

// 60秒で打ち切れないよう十分に長い出題を作るための目安文字数。
// 60秒×想定上限打速でも尽きないだけの長さ（≒2000打分）を生成する。
export const PASSAGE_KEYS = 2000

// pool（出題対象の文配列。呼び出し側がレベル別に遅延読み込みして渡す）からセグメント列を作る。
// 各文は buildUnits でセグメント化し、sentenceIndex を付与して連結（target 文字を超えるまで）。
// 60秒制では尽きないよう target を大きく取る（既定 PASSAGE_KEYS）。
export function buildPassage(mode, pool, { rng = Math.random, target = PASSAGE_KEYS } = {}) {
  const base = pool && pool.length ? pool : []
  if (base.length === 0) return []
  const shuffled = [...base].sort(() => rng() - 0.5)
  const segments = []
  let approx = 0
  let si = 0 // 文の通し番号
  let idx = 0
  while (approx < target + 60) {
    const s = shuffled[idx % shuffled.length]
    for (const seg of buildUnits(s, mode, { rng })) {
      segments.push({ ...seg, sentenceIndex: si })
      approx += seg.canonical.length
    }
    si += 1
    idx += 1
  }
  return segments
}
