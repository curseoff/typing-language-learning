// 英英辞典の出題生成（レベル×テーマで絞り込み）。
import { DICT } from '../../content/dictionary.js'

export const DICT_TYPE_COUNT = 12 // 入力モードの出題数（定義文を打つ）
export const DICT_QUIZ_COUNT = 20 // 4択の問題数

// 実際にエントリがあるレベルだけ（スターターは L1-L2）
export const DICT_AVAILABLE_LEVELS = [...new Set(DICT.map((d) => d.level))].sort((a, b) => a - b)

function pool(level, theme) {
  let p = DICT.filter((d) => d.level === level && (theme === 'すべて' || d.theme === theme))
  if (p.length === 0) p = DICT.filter((d) => d.level === level)
  if (p.length === 0) p = DICT
  return p
}

export function levelEntries(level) {
  return DICT.filter((d) => d.level === level)
}

// count 件（不足なら循環）。各エントリは {word, def, ja, kana} をそのまま返す。
export function buildDictSet(level, theme, count) {
  const shuffled = [...pool(level, theme)].sort(() => Math.random() - 0.5)
  const out = []
  for (let i = 0; i < count; i++) out.push(shuffled[i % shuffled.length])
  return out
}

// 4択：英語の定義(prompt)に対し、4つの英単語から正解(word)を選ぶ。
// options=[{display, variants, answer}], ja=和訳(回答後に開示)
export function makeDictQuiz(entries, distractorPool, count = DICT_QUIZ_COUNT, optionCount = 4) {
  const items = []
  for (let i = 0; i < count; i++) {
    const e = entries[i % entries.length]
    const others = distractorPool.filter(
      (p) => p.word !== e.word && !p.word.startsWith(e.word) && !e.word.startsWith(p.word),
    )
    const distractors = [...others].sort(() => Math.random() - 0.5).slice(0, optionCount - 1)
    const opts = [e, ...distractors].sort(() => Math.random() - 0.5)
    items.push({
      prompt: e.def,
      ja: e.ja,
      answerDisplay: e.word,
      options: opts.map((o) => ({ display: o.word, variants: [o.word], answer: o.word === e.word })),
    })
  }
  return items
}

// 説明文4択：単語(prompt)+和訳(ja)に合う英語の定義を「打って」選ぶ。
// options=[{display=定義, variants=[定義], answer}]（4択クイズと同じ形）
export function makeDictPick(entries, distractorPool, count = DICT_TYPE_COUNT, optionCount = 4) {
  const items = []
  for (let i = 0; i < count; i++) {
    const e = entries[i % entries.length]
    const aDef = e.def
    const others = distractorPool.filter(
      (p) => p.word !== e.word && !p.def.startsWith(aDef) && !aDef.startsWith(p.def),
    )
    const distractors = [...others].sort(() => Math.random() - 0.5).slice(0, optionCount - 1)
    const opts = [e, ...distractors].sort(() => Math.random() - 0.5)
    items.push({
      prompt: e.word,
      ja: e.ja,
      answerDisplay: e.def,
      options: opts.map((o) => ({ display: o.def, variants: [o.def], answer: o.word === e.word })),
    })
  }
  return items
}
