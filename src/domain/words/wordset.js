// 単語問題の出題セット生成（レベル×テーマで絞り込み・シャッフル）。
import { WORDS } from '../../content/words.js'
import { romajiVariants, toRomaji } from '../romaji/romaji.js'
import { buildUnits } from '../typing/units.js'
import { TARGET_KEYS } from '../marathon/passage.js'

export const WORD_COUNT = 30 // 4択クイズの問題数

function levelThemePool(level, theme) {
  let pool = WORDS.filter((w) => w.level === level && (theme === 'すべて' || w.theme === theme))
  if (pool.length === 0) pool = WORDS.filter((w) => w.level === level)
  if (pool.length === 0) pool = WORDS
  return pool
}

// 4択クイズ用：count語（既定30）
export function buildWordSet(level, theme, count = WORD_COUNT) {
  const pool = levelThemePool(level, theme)
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const out = []
  for (let i = 0; i < count; i++) out.push(shuffled[i % shuffled.length])
  return out
}

// 1セグメントを打つのに最低限必要なキー数（最短の綴り）
const minKeys = (seg) => Math.min(...seg.variants.map((v) => v.length))

// 入力モード用：最短の綴りで打っても TARGET_KEYS(600) を超えるよう語を並べる（足りなければ循環）。
// canonical長でなく最短綴り長で測ることで、shi→si 等で短く打っても600前に打ち尽くさない。
export function buildWordPassage(level, theme, mode) {
  const pool = levelThemePool(level, theme)
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const out = []
  let chars = 0
  let i = 0
  while (chars < TARGET_KEYS + 30 && i < 4000) {
    const w = shuffled[i % shuffled.length]
    out.push(w)
    chars += buildUnits(w, mode).reduce((s, seg) => s + minKeys(seg), 0)
    i++
  }
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
        kana: dir === 'ja' ? o.kana : undefined, // 漢字選択肢の進捗色付け用
        answer: o.en === w.en,
      })),
    }
  })
}
