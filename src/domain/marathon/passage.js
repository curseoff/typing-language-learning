// マラソンの出題（パッセージ）生成。
import { buildUnits } from '../typing/units.js'
import { WORD_SENTENCES } from '../../content/wordSentences.js'

export const TARGET_KEYS = 600 // この文字数を打ち切ったら終了

// 単語例文（WORD_SENTENCES）からレベル別にセグメント列を作る。各文は buildUnits で
// セグメント化し、sentenceIndex を付与して連結（600文字を超えるまで）。rank=対象語レベル。
export function buildPassage(mode, rank) {
  const pool = WORD_SENTENCES.filter((s) => s.level === rank)
  const base = pool.length > 0 ? pool : WORD_SENTENCES
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
