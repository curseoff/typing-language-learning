// 単語問題の出題セット生成（レベル×テーマで絞り込み・シャッフル）。
// 単語データ(words)は遅延読み込みのため呼び出し側から渡す（純関数）。
import { romajiVariants } from '../romaji/romaji.service.js'
import { buildUnits } from '../typing/units.service.js'
import { PASSAGE_KEYS } from '../marathon/passage.service.js'
import { poolForRange } from './wordRange.service.js'

export const WORD_COUNT = 30 // 4択クイズの問題数

// level×theme のプール選択（#412・純粋・非破壊）。dict も同じ形なので共用する。
//   fallback:false（既定）… level 一致 && (theme==='すべて' || item.theme===theme)（＝strict）。
//   fallback:true        … strict が空なら level 一致のみ（全テーマ）へフォールバックする。
// theme==='すべて' は fallback に依らず level 一致の全テーマ。3段目（同レベルも空→全件）は
// 呼び出し側（levelThemePool 等）に残す＝既存の出題フォールバックを byte 同一に保つ。
export function selectPool(items, level, theme, { fallback = false } = {}) {
  const strict = items.filter((it) => it.level === level && (theme === 'すべて' || it.theme === theme))
  if (strict.length > 0 || !fallback) return strict
  return items.filter((it) => it.level === level)
}

function levelThemePool(words, level, theme) {
  let pool = selectPool(words, level, theme, { fallback: true })
  if (pool.length === 0) pool = words
  return pool
}

// 4択クイズ用：count語（既定30）。rng は乱数源（既定 Math.random）。
// #362 range 有り（単語固定範囲）→ プールを poolForRange（strict・freq 順・決定的）へ差し替え、
// rng シャッフルを掛けない（本人決定＝範囲内は freq 順固定）。出題列は poolForRange の順そのまま
// （100語未満の端数はその数）。無効 range（該当語なし）は従来のランダム全体出題へフォールバック。
export function buildWordSet(words, level, theme, count = WORD_COUNT, { rng = Math.random, range } = {}) {
  if (range != null) {
    const ranged = poolForRange(words, level, theme, range)
    if (ranged.length > 0) return ranged
  }
  const pool = levelThemePool(words, level, theme)
  const shuffled = [...pool].sort(() => rng() - 0.5)
  const out = []
  for (let i = 0; i < count; i++) out.push(shuffled[i % shuffled.length])
  return out
}

// 1セグメントを打つのに最低限必要なキー数（最短の綴り）
const minKeys = (seg) => Math.min(...seg.variants.map((v) => v.length))

// pool を先頭から順に（足りなければ循環）並べ、最短綴りで測った合計キー数が target を超えるまで積む。
// unitsOpts は buildUnits へ渡す（rng を含む／range モードは rng 不使用＝{}）。
function fillToTarget(pool, mode, target, unitsOpts) {
  const out = []
  let chars = 0
  let i = 0
  while (chars < target + 30 && i < 8000) {
    const w = pool[i % pool.length]
    out.push(w)
    chars += buildUnits(w, mode, unitsOpts).reduce((s, seg) => s + minKeys(seg), 0)
    i++
  }
  return out
}

// 入力モード用：最短の綴りで打っても target(既定 PASSAGE_KEYS=2000) を超えるよう語を並べる（足りなければ循環）。
// canonical長でなく最短綴り長で測ることで、shi→si 等で短く打っても60秒の間に打ち尽くさない。
// #362 range 有り → poolForRange（freq 順・決定的）を rng を使わず順番に継ぎ足す（範囲内は毎回同じ並び）。
// 無効 range（該当語なし）は従来のランダム全体出題へフォールバック。
export function buildWordPassage(words, level, theme, mode, { rng = Math.random, target = PASSAGE_KEYS, range } = {}) {
  if (range != null) {
    const ranged = poolForRange(words, level, theme, range)
    if (ranged.length > 0) return fillToTarget(ranged, mode, target, {})
  }
  const pool = levelThemePool(words, level, theme)
  const shuffled = [...pool].sort(() => rng() - 0.5)
  return fillToTarget(shuffled, mode, target, { rng })
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
export function makeQuiz(words, pool, dir, optionCount = 4, { rng = Math.random } = {}) {
  return words.map((w) => {
    const chosen = [w]
    const chosenVars = [optVariants(w, dir)]
    const candidates = [...pool].filter((p) => p.en !== w.en).sort(() => rng() - 0.5)
    for (const p of candidates) {
      if (chosen.length >= optionCount) break
      const vars = optVariants(p, dir)
      if (chosenVars.some((cv) => variantsCollide(cv, vars))) continue
      chosen.push(p)
      chosenVars.push(vars)
    }
    const opts = [...chosen].sort(() => rng() - 0.5)
    return {
      prompt: dir === 'ja' ? w.en : w.ja, // 出題（表示する側）
      promptKana: dir === 'ja' ? undefined : w.kana, // 英語訳=和訳が出題→ルビ用の読み
      answerDisplay: optDisplay(w, dir),
      options: opts.map((o) => ({
        display: optDisplay(o, dir),
        variants: optVariants(o, dir),
        kana: dir === 'ja' ? o.kana : undefined, // 漢字選択肢の進捗色付け用
        answer: o.en === w.en,
        // 回答後に「反対側」を出すための元エントリの値（#221）
        en: o.en,
        ja: o.ja,
        jaKana: o.kana,
      })),
    }
  })
}
