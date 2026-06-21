// 単語問題の出題セット生成（レベル×テーマで絞り込み・シャッフル・N語）。
import { WORDS } from '../../content/words.js'

export const WORD_COUNT = 30 // 1ゲームの語数

// theme は 'すべて' または WORD_THEMES のいずれか
export function buildWordSet(level, theme, count = WORD_COUNT) {
  let pool = WORDS.filter((w) => w.level === level && (theme === 'すべて' || w.theme === theme))
  if (pool.length === 0) pool = WORDS.filter((w) => w.level === level)
  if (pool.length === 0) pool = WORDS
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  // count に満たなければ循環して埋める
  const out = []
  for (let i = 0; i < count; i++) out.push(shuffled[i % shuffled.length])
  return out
}
