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

// 各語に4択を作る。和訳(prompt)に対し、英単語の選択肢を出す。
// options=英単語の配列, answer=正解の英単語。打って選ぶので前方一致が衝突しない語を誤答に選ぶ。
export function makeQuiz(words, pool, optionCount = 4) {
  return words.map((w) => {
    const others = pool.filter(
      (p) => p.en !== w.en && !p.en.startsWith(w.en) && !w.en.startsWith(p.en),
    )
    const distractors = [...others].sort(() => Math.random() - 0.5).slice(0, optionCount - 1)
    const opts = [w, ...distractors].sort(() => Math.random() - 0.5)
    return { word: w, options: opts.map((o) => o.en), answer: w.en }
  })
}
