// #443 対戦：「相手の完了を待っています…」の待機メッセージを出してよいかの判定。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的・入力非破壊。

// shouldWaitForOthers({ phase, selfFinished, allFinished }) -> boolean
// レース中（phase==='running'）に自分だけ完了していて、まだ全員は完了していないときだけ true。
// 開始前（waiting/connecting/countdown）と決着後（finished）は false＝待つ相手はもういない。
// 不正・欠落入力（引数なし/null/未知の phase）も throw せず false（安全側＝迷ったら出さない）。
export function shouldWaitForOthers(state) {
  if (!state || typeof state !== 'object') return false
  return state.phase === 'running' && state.selfFinished === true && state.allFinished !== true
}
