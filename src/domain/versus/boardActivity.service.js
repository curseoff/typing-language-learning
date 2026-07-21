// #443 対戦：自分の盤面がキー入力を受け付けてよいかの判定。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的・入力非破壊。

// isBoardActive({ phase, eliminated }) -> boolean
// レース中（phase==='running'）かつ自分が未脱落のときだけ true。
// 開始前（waiting/connecting/countdown）と決着後（finished）は false＝安全側で打鍵を止める。
// 不正・欠落入力（引数なし/null/未知の phase）も throw せず false。
export function isBoardActive(state) {
  if (!state || typeof state !== 'object') return false
  return state.phase === 'running' && state.eliminated !== true
}
