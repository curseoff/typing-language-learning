// 英英辞典の出題生成（レベル×テーマで絞り込み）。
// 英英データ(dict)は遅延読み込みのため呼び出し側から渡す（純関数）。
export const DICT_TYPE_COUNT = 12 // 入力モードの出題数（定義文を打つ）
export const DICT_QUIZ_COUNT = 20 // 4択の問題数

function pool(dict, level, theme) {
  let p = dict.filter((d) => d.level === level && (theme === 'すべて' || d.theme === theme))
  if (p.length === 0) p = dict.filter((d) => d.level === level)
  if (p.length === 0) p = dict
  return p
}

export function levelEntries(dict, level) {
  return dict.filter((d) => d.level === level)
}

// count 件（不足なら循環）。各エントリは {word, def, ja, kana} をそのまま返す。
// rng は乱数源（既定 Math.random）。
export function buildDictSet(dict, level, theme, count, { rng = Math.random } = {}) {
  const shuffled = [...pool(dict, level, theme)].sort(() => rng() - 0.5)
  const out = []
  for (let i = 0; i < count; i++) out.push(shuffled[i % shuffled.length])
  return out
}

// 4択：英語の定義(prompt)に対し、4つの英単語から正解(word)を選ぶ。
// options=[{display, variants, answer}], ja=和訳(回答後に開示)
export function makeDictQuiz(
  entries,
  distractorPool,
  count = DICT_QUIZ_COUNT,
  optionCount = 4,
  { rng = Math.random } = {},
) {
  const items = []
  for (let i = 0; i < count; i++) {
    const e = entries[i % entries.length]
    const others = distractorPool.filter(
      (p) => p.word !== e.word && !p.word.startsWith(e.word) && !e.word.startsWith(p.word),
    )
    // 誤答同士の前方一致も避ける（どの選択肢を打っても一意に確定するため）。
    const distractors = []
    for (const p of [...others].sort(() => rng() - 0.5)) {
      if (distractors.length >= optionCount - 1) break
      if (distractors.some((d) => p.word.startsWith(d.word) || d.word.startsWith(p.word))) continue
      distractors.push(p)
    }
    const opts = [e, ...distractors].sort(() => rng() - 0.5)
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
export function makeDictPick(
  entries,
  distractorPool,
  count = DICT_TYPE_COUNT,
  optionCount = 4,
  { rng = Math.random } = {},
) {
  const items = []
  for (let i = 0; i < count; i++) {
    const e = entries[i % entries.length]
    const aDef = e.def
    const others = distractorPool.filter(
      (p) => p.word !== e.word && !p.def.startsWith(aDef) && !aDef.startsWith(p.def),
    )
    // 誤答同士の前方一致も避ける（どの選択肢を打っても一意に確定するため）。
    const distractors = []
    for (const p of [...others].sort(() => rng() - 0.5)) {
      if (distractors.length >= optionCount - 1) break
      if (distractors.some((d) => p.def.startsWith(d.def) || d.def.startsWith(p.def))) continue
      distractors.push(p)
    }
    const opts = [e, ...distractors].sort(() => rng() - 0.5)
    items.push({
      prompt: e.word,
      ja: e.ja,
      answerDisplay: e.def,
      options: opts.map((o) => ({ display: o.def, variants: [o.def], answer: o.word === e.word })),
    })
  }
  return items
}
