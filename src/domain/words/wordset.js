// 単語問題の出題セット生成（レベル×テーマで絞り込み・シャッフル）。
// 単語データ(words)は遅延読み込みのため呼び出し側から渡す（純関数）。
import { romajiVariants } from '../romaji/romaji.js'
import { buildUnits } from '../typing/units.js'
import { TARGET_KEYS } from '../marathon/passage.js'

export const WORD_COUNT = 30 // 4択クイズの問題数

function levelThemePool(words, level, theme) {
  let pool = words.filter((w) => w.level === level && (theme === 'すべて' || w.theme === theme))
  if (pool.length === 0) pool = words.filter((w) => w.level === level)
  if (pool.length === 0) pool = words
  return pool
}

// 4択クイズ用：count語（既定30）
export function buildWordSet(words, level, theme, count = WORD_COUNT) {
  const pool = levelThemePool(words, level, theme)
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const out = []
  for (let i = 0; i < count; i++) out.push(shuffled[i % shuffled.length])
  return out
}

// 1セグメントを打つのに最低限必要なキー数（最短の綴り）
const minKeys = (seg) => Math.min(...seg.variants.map((v) => v.length))

// 入力モード用：最短の綴りで打っても TARGET_KEYS(600) を超えるよう語を並べる（足りなければ循環）。
// canonical長でなく最短綴り長で測ることで、shi→si 等で短く打っても600前に打ち尽くさない。
export function buildWordPassage(words, level, theme, mode) {
  const pool = levelThemePool(words, level, theme)
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
export function levelWords(words, level) {
  return words.filter((w) => w.level === level)
}

// dir='en'(英語訳: 和訳→英単語をタイプ) / 'ja'(日本語訳: 英単語→和訳をローマ字タイプ)
const optDisplay = (w, dir) => (dir === 'ja' ? w.ja : w.en) // 選択肢の表示
const optVariants = (w, dir) => (dir === 'ja' ? romajiVariants(w.kana) : [w.en]) // 打鍵で受理する綴り

// 2語の打鍵綴りが前方一致で衝突するか（どれかの variant 同士が一方の接頭辞）。
const variantsCollide = (va, vb) =>
  va.some((a) => vb.some((b) => a.startsWith(b) || b.startsWith(a)))

// 各語に4択を作る。打って選ぶので、正解・誤答すべての選択肢が
// 互いに前方一致で衝突しないよう、variant 単位で誤答を選ぶ。
export function makeQuiz(words, pool, dir, optionCount = 4) {
  return words.map((w) => {
    const chosen = [w]
    const chosenVars = [optVariants(w, dir)]
    const candidates = [...pool].filter((p) => p.en !== w.en).sort(() => Math.random() - 0.5)
    for (const p of candidates) {
      if (chosen.length >= optionCount) break
      const vars = optVariants(p, dir)
      if (chosenVars.some((cv) => variantsCollide(cv, vars))) continue
      chosen.push(p)
      chosenVars.push(vars)
    }
    const opts = [...chosen].sort(() => Math.random() - 0.5)
    return {
      prompt: dir === 'ja' ? w.en : w.ja, // 出題（表示する側）
      promptKana: dir === 'ja' ? undefined : w.kana, // 英語訳=和訳が出題→ルビ用の読み
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
