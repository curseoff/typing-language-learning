// #362 単語の固定範囲（range）を切り出す決定的な純ロジック。
// rng/DOM 非依存・入力非破壊。頻度(freq)を主キーに正準採番し、100語区切りの
// 固定範囲を1始まりで切り出す（毎回同じ範囲＝復習しやすい）。Word={en,ja,kana,level,theme,freq?}。
// levelThemePool（フォールバック有り）とは別に、poolForRange は strict な level×theme を使う。

// range の刻み（単一ソース）。全 API の size 既定・呼び出し側の直書きはこれを参照する。
export const RANGE_SIZE = 100

// #364 freqOf/keyOf を注入する正準順の全順序コンパレータ（dict/wsent でも再利用）：
//   ①freqOf(e)!=null が先（有り<無し）②freq 有り同士は freqOf 昇順（小=高頻度が先）
//   ③freq 同値／freq 無し同士は keyOf 昇順（keyOf は一意前提で全順序になる。words は en、
//     dict/wsent は本文が衝突しうるため word を渡す）。null/undefined はどちらも「freq 無し」扱い。
const byCanonicalBy = (freqOf, keyOf) => (a, b) => {
  const fa = freqOf(a)
  const fb = freqOf(b)
  const aHas = fa != null
  const bHas = fb != null
  if (aHas !== bHas) return aHas ? -1 : 1
  if (aHas && fa !== fb) return fa - fb
  const ka = keyOf(a)
  const kb = keyOf(b)
  return ka < kb ? -1 : ka > kb ? 1 : 0
}

// #364 freqOf/keyOf 注入版：正準順で安定ソートした新配列を返す（入力非破壊・決定的）。
export function numberedBy(pool, freqOf, keyOf) {
  return [...pool].sort(byCanonicalBy(freqOf, keyOf))
}

// #364 numberedBy の [(i-1)*size, i*size) スライス（rangeIndex は1始まり）。
// 0/負/非整数/範囲外・空 pool は []（全域性を保つ）。
export function wordsInRangeBy(pool, rangeIndex, size, freqOf, keyOf) {
  if (!Number.isInteger(rangeIndex) || rangeIndex < 1) return []
  const start = (rangeIndex - 1) * size
  return numberedBy(pool, freqOf, keyOf).slice(start, start + size)
}

// #364 strict な level×theme（theme='すべて'→全テーマ／else theme 一致・フォールバック無し）に
// wordsInRangeBy を当てる freqOf/keyOf 注入版。
export function poolForRangeBy(entries, level, theme, rangeIndex, size, freqOf, keyOf) {
  const pool = entries.filter(
    (w) => w.level === level && (theme === 'すべて' || w.theme === theme),
  )
  return wordsInRangeBy(pool, rangeIndex, size, freqOf, keyOf)
}

// words 版の正準キー（freq 主キー・en タイブレーク）。一般化 API の特殊化として下記 words API を再実装。
const freqOfWord = (e) => e.freq
const keyOfWord = (e) => e.en

// 正準順で安定ソートした新配列を返す（入力非破壊・決定的）。
export function numberedWords(pool) {
  return numberedBy(pool, freqOfWord, keyOfWord)
}

// numberedWords の [(i-1)*size, i*size) スライス（rangeIndex は1始まり）。
// 0/負/非整数/範囲外・空 pool は []（全域性を保つ）。
export function wordsInRange(pool, rangeIndex, size = RANGE_SIZE) {
  return wordsInRangeBy(pool, rangeIndex, size, freqOfWord, keyOfWord)
}

// 総数から範囲数を導く（端数繰り上げ）。0→0。
export function rangeCount(total, size = RANGE_SIZE) {
  return Math.ceil(total / size)
}

// 範囲の表示ラベル `${(i-1)*size+1}-${i*size}`。total 指定時は末尾範囲を実長に丸める。
export function rangeLabel(rangeIndex, size = RANGE_SIZE, total) {
  const start = (rangeIndex - 1) * size + 1
  const end = total != null ? Math.min(rangeIndex * size, total) : rangeIndex * size
  return `${start}-${end}`
}

// strict な level×theme プール（theme='すべて'→全テーマ／else theme 一致・空でも level 全体へ
// フォールバックしない）に wordsInRange を当てる。
export function poolForRange(words, level, theme, rangeIndex, size = RANGE_SIZE) {
  return poolForRangeBy(words, level, theme, rangeIndex, size, freqOfWord, keyOfWord)
}
