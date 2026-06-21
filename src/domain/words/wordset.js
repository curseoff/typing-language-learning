// 単語問題の出題セット生成（レベル×テーマで絞り込み・シャッフル・N語）。
import { WORDS } from '../../content/words.js'

export const WORD_COUNT = 30 // 1ゲームの語数

// theme は 'すべて' または WORD_THEMES のいずれか
export function buildWordSet(level, theme, count = WORD_COUNT) {
  let pool = WORDS.filter((w) => w.level === level && (theme === 'すべて' || w.theme === theme))
  if (pool.length === 0) pool = WORDS.filter((w) => w.level === level)
  if (pool.length === 0) pool = WORDS
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const out = []
  for (let i = 0; i < count; i++) out.push(shuffled[i % shuffled.length])
  return out
}

// 同レベルの全語（4択の誤答候補に使う）
export function levelWords(level) {
  return WORDS.filter((w) => w.level === level)
}

// 各語に4択を作る。pool=誤答候補, options=和訳の配列, correct=正解index
export function makeQuiz(words, pool, optionCount = 4) {
  return words.map((w) => {
    const others = pool.filter((p) => p.en !== w.en && p.ja !== w.ja)
    const distractors = [...others].sort(() => Math.random() - 0.5).slice(0, optionCount - 1)
    const opts = [w, ...distractors].sort(() => Math.random() - 0.5)
    return { word: w, options: opts.map((o) => o.ja), correct: opts.findIndex((o) => o.en === w.en) }
  })
}
