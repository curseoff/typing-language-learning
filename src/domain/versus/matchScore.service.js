// #432 P2P穴埋め対戦：勝敗判定（N人・正解問題数 correct のみで判定）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。
//
// scores は { [peerId]: { correct, ... } }。correct のみで判定し、他フィールド（speed/mistakes/time 等）は無視する。

// correct 降順で [{ peerId, correct }] を返す。同数は入力の列挙順（Object.keys 順）を保つ安定ソート。
export function rankByCorrect(scores) {
  return Object.keys(scores)
    .map((peerId, index) => ({ peerId, correct: scores[peerId].correct, index }))
    .sort((a, b) => b.correct - a.correct || a.index - b.index)
    .map(({ peerId, correct }) => ({ peerId, correct }))
}

// correct 最多の peerId 配列（同点は全員＝ドロー・全員0なら全員）。空 scores は []。
export function winners(scores) {
  const ids = Object.keys(scores)
  if (ids.length === 0) return []
  const max = Math.max(...ids.map((id) => scores[id].correct))
  return ids.filter((id) => scores[id].correct === max)
}
