// #362 単語の固定範囲（range）を切り出す決定的な純ロジック。
// rng/DOM 非依存・入力非破壊。頻度(freq)を主キーに正準採番し、100語区切りの
// 固定範囲を1始まりで切り出す（毎回同じ範囲＝復習しやすい）。Word={en,ja,kana,level,theme,freq?}。
// levelThemePool（フォールバック有り）とは別に、poolForRange は strict な level×theme を使う。

// 正準順の全順序コンパレータ：
//   ①freq!=null が先（有り<無し）②freq 有り同士は freq 昇順（小=高頻度が先）
//   ③freq 同値／freq 無し同士は en 昇順（en は一意なので全順序になる）。
const byCanonical = (a, b) => {
  const aHas = a.freq != null
  const bHas = b.freq != null
  if (aHas !== bHas) return aHas ? -1 : 1
  if (aHas && a.freq !== b.freq) return a.freq - b.freq
  return a.en < b.en ? -1 : a.en > b.en ? 1 : 0
}

// 正準順で安定ソートした新配列を返す（入力非破壊・決定的）。
export function numberedWords(pool) {
  return [...pool].sort(byCanonical)
}

// numberedWords の [(i-1)*size, i*size) スライス（rangeIndex は1始まり）。
// 0/負/非整数/範囲外・空 pool は []（全域性を保つ）。
export function wordsInRange(pool, rangeIndex, size = 100) {
  if (!Number.isInteger(rangeIndex) || rangeIndex < 1) return []
  const start = (rangeIndex - 1) * size
  return numberedWords(pool).slice(start, start + size)
}

// 総数から範囲数を導く（端数繰り上げ）。0→0。
export function rangeCount(total, size = 100) {
  return Math.ceil(total / size)
}

// 範囲の表示ラベル `${(i-1)*size+1}-${i*size}`。total 指定時は末尾範囲を実長に丸める。
export function rangeLabel(rangeIndex, size = 100, total) {
  const start = (rangeIndex - 1) * size + 1
  const end = total != null ? Math.min(rangeIndex * size, total) : rangeIndex * size
  return `${start}-${end}`
}

// strict な level×theme プール（theme='すべて'→全テーマ／else theme 一致・空でも level 全体へ
// フォールバックしない）に wordsInRange を当てる。
export function poolForRange(words, level, theme, rangeIndex, size = 100) {
  const pool = words.filter(
    (w) => w.level === level && (theme === 'すべて' || w.theme === theme),
  )
  return wordsInRange(pool, rangeIndex, size)
}
