// 物語フロー（ticker カード型）の進捗を、現在ノード・入力状態から算出する純関数。
// wsent(TopFlow) と同じ考え方：英語入力中は入力分、both で和文入力中は英語完了済み、
// 和文入力中は漢字位置(jaDone)＋読みのかな進捗(jaKanaDone)を出す（ルビのかな単位着色用）。
import { alignJaToKana, kanaConsumed } from '../typing/progress.js'

// node: { en, ja, kana }, opts: { stage, mode, activeType, input }
// 返り値: { enDone, jaDone, jaKanaDone, activeRow } activeRow='en'|'ja'|null
export function storyFlowProgress(node, { stage, mode, activeType, input }) {
  const isBoth = mode === 'both'
  // choice 段階はノードを打ち終えているので満杯表示。
  if (stage === 'choice') {
    return {
      enDone: node.en.length,
      jaDone: [...node.ja].length,
      jaKanaDone: [...node.kana].length,
      activeRow: null,
    }
  }
  const enActive = activeType === 'en'
  const jaActive = activeType === 'ja'
  let enDone = 0
  if (enActive) enDone = Math.min(input.length, node.en.length)
  else if (isBoth) enDone = node.en.length // 英語は入力済み、和文入力中
  let jaDone = 0
  let jaKanaDone = 0
  if (jaActive) {
    const consumed = kanaConsumed(node.kana, input)
    const ends = alignJaToKana(node.ja, node.kana)
    let count = 0
    for (const e of ends) if (e <= consumed) count++
    jaDone = count
    jaKanaDone = consumed
  }
  return { enDone, jaDone, jaKanaDone, activeRow: enActive ? 'en' : jaActive ? 'ja' : null }
}
