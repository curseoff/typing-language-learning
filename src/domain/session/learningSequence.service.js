// 穴埋め学習モードの出題順（#402）。純粋・React/DOM 非依存。
// 「まず通常入力で覚え → 同じ順で穴埋めで定着」を1ブロック単位で繰り返す。

// items を blockSize ごとのブロックに区切り、各ブロックを
// 「normal 全部 → 同じ順で cloze 全部」に展開する（末尾端数は単独ブロック）。
// blockSize は 1 未満・非有限なら 1 に丸める（throw しない）。
// 非破壊・冪等。出力長は常に 2×items.length。
export function tagLearningBlocks(items, { blockSize = 5 } = {}) {
  const size = Number.isFinite(blockSize) && blockSize >= 1 ? Math.floor(blockSize) : 1
  const out = []
  for (let i = 0; i < items.length; i += size) {
    const block = items.slice(i, i + size)
    for (const item of block) out.push({ item, phase: 'normal' })
    for (const item of block) out.push({ item, phase: 'cloze' })
  }
  return out
}

// items 系の終了条件が要求する「消化すべき問題数」。cloze は各問題を
// normal→cloze の2回消化するため value を 2 倍にする。items 以外は null。
// learningMode 未指定は normal 扱い（2 倍しない）。
export function itemsTargetFor(endCondition, learningMode) {
  if (!endCondition || endCondition.kind !== 'items') return null
  return learningMode === 'cloze' ? endCondition.value * 2 : endCondition.value
}
