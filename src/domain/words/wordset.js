// 単語問題の出題セット生成（レベル×テーマで絞り込み・シャッフル・N語）。
import { WORDS } from '../../content/words.js'
import { romajiVariants, toRomaji } from '../romaji/romaji.js'

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

// dir='en'(英語訳: 和訳→英単語をタイプ) / 'ja'(日本語訳: 英単語→和訳をローマ字タイプ)
const optDisplay = (w, dir) => (dir === 'ja' ? w.ja : w.en) // 選択肢の表示
const optVariants = (w, dir) => (dir === 'ja' ? romajiVariants(w.kana) : [w.en]) // 打鍵で受理する綴り
const optCanon = (w, dir) => (dir === 'ja' ? toRomaji(w.kana) : w.en) // 衝突判定用の代表綴り

// 各語に4択を作る。打って選ぶので、前方一致が衝突しない語を誤答に選ぶ。
export function makeQuiz(words, pool, dir, optionCount = 4) {
  return words.map((w) => {
    const aCanon = optCanon(w, dir)
    const others = pool.filter((p) => {
      if (p.en === w.en) return false
      const c = optCanon(p, dir)
      return !c.startsWith(aCanon) && !aCanon.startsWith(c)
    })
    const distractors = [...others].sort(() => Math.random() - 0.5).slice(0, optionCount - 1)
    const opts = [w, ...distractors].sort(() => Math.random() - 0.5)
    return {
      prompt: dir === 'ja' ? w.en : w.ja, // 出題（表示する側）
      answerDisplay: optDisplay(w, dir),
      options: opts.map((o) => ({
        display: optDisplay(o, dir),
        variants: optVariants(o, dir),
        answer: o.en === w.en,
      })),
    }
  })
}
