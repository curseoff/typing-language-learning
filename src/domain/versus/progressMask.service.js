// #437 対戦：相手のリアルタイム入力進捗を「伏せ字マスバー」で可視化する純ドメイン。
// 送信側は実長 curLen を cap マスへ量子化した cells（0..cap 整数）だけを流し、実長はワイヤに載せない。
// 受信側は cells を長さ cap の可視化配列へ展開する。sender/receiver で上限（cap）を単一ソース化する。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的・入力非破壊。

// sender/receiver 単一ソースのマス上限。
export const PROGRESS_MASK_CAP = 12

// 値を [lo, hi] に収める（防御的）。
function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi)
}

// 実長 curLen を cap マスへ floor 量子化した 0..cap 整数を返す（送信側）。
//   floor 採用で「curPos<curLen の間は必ず fill<cap＝満杯⇔完了」の不変条件を満たす。
//   curLen<=0 は 0。cap<=0 は防御的に 0（throw しない）。負値・curPos>curLen は clamp で吸収。
export function maskFill({ curPos, curLen, cap }) {
  if (!(cap > 0)) return 0
  if (!(curLen > 0)) return 0
  return clamp(Math.floor((curPos / curLen) * cap), 0, cap)
}

// 現在セグの入力状況から、伏せ字マス用の実長 { curPos, curLen } を導く（送信側・量子化前）。
//   variants … 現在セグの許容解（複数可・長さが異なりうる＝色/colour, し=shi/si など）。
//   prefix   … いま正しく打てている接頭辞（正打＝候補、ミス＝据え置きの直近正解接頭辞、完了＝完成解）。
// curLen は「prefix と整合する（prefix を接頭辞に持つ）最短の許容解の長さ」＝いま完成に向かっている対象。
//   prefix に整合する解が無い異常時は先頭 variant にフォールバック（防御的・実運用では起きない）。
// curPos は prefix.length を curLen で頭打ち（clamp）＝curPos<=curLen を保証（maskFill の不変条件と整合）。
// 純関数：入力非破壊・副作用/時刻/乱数なし。
export function segMaskLen({ variants, prefix }) {
  const list = Array.isArray(variants) ? variants : []
  const p = typeof prefix === 'string' ? prefix : ''
  const matching = list.filter((v) => v.startsWith(p))
  const pool = matching.length ? matching : list
  const curLen = pool.reduce((min, v) => (min == null || v.length < min ? v.length : min), null) ?? 0
  return { curPos: Math.min(p.length, curLen), curLen }
}

// fill マスを可視化する長さ cap の配列を返す（受信側）。
//   先頭 clamp(fill,0,cap) 個が filled・残りが pending。state（'ok'|'miss'）は全マスへ一様付与。
export function maskedCells({ fill, cap, state }) {
  const filled = clamp(fill, 0, cap)
  const cells = []
  for (let i = 0; i < cap; i++) {
    cells.push({ kind: i < filled ? 'filled' : 'pending', state })
  }
  return cells
}
