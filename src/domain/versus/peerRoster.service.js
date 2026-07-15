// #426 対戦基盤スライス1：イミュータブルな参加者名簿（roster）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。全 API は入力非破壊で新オブジェクトを返す。
//
// 内部表現：
//   { order: [id,...],                    … 追加順を保つ id 配列（left でも残す＝順序台帳）
//     peers: { [id]: { self, left, finished } } }  … 参加者ごとの状態
// self … 自分自身か（remove しても残る）／left … 離脱したか（activeIds から除外）／finished … 完了したか。

// 参加者1人ぶんの初期状態を作る。
function makePeer(self) {
  return { self, left: false, finished: false }
}

// 自分（selfId）だけを含む名簿を作る。
export function makeRoster(selfId) {
  return {
    order: [selfId],
    peers: { [selfId]: makePeer(true) },
  }
}

// 参加者を追加する（冪等：既存 id・自分自身の再追加は不変）。
export function addPeer(roster, peerId) {
  if (roster.peers[peerId]) return { order: [...roster.order], peers: { ...roster.peers } }
  return {
    order: [...roster.order, peerId],
    peers: { ...roster.peers, [peerId]: makePeer(false) },
  }
}

// 参加者を離脱（left）させる。不在 id は不変。自分（self）は remove しても残す。
export function removePeer(roster, peerId) {
  const peer = roster.peers[peerId]
  if (!peer || peer.self) return { order: [...roster.order], peers: { ...roster.peers } }
  return {
    order: [...roster.order],
    peers: { ...roster.peers, [peerId]: { ...peer, left: true } },
  }
}

// 参加者を完了（finished）マークする。不在 id は不変。active 判定（activeIds）には残る。
export function markFinished(roster, peerId) {
  const peer = roster.peers[peerId]
  if (!peer) return { order: [...roster.order], peers: { ...roster.peers } }
  return {
    order: [...roster.order],
    peers: { ...roster.peers, [peerId]: { ...peer, finished: true } },
  }
}

// 離脱していない参加者の id を追加順で返す。
export function activeIds(roster) {
  return roster.order.filter((id) => !roster.peers[id].left)
}

// active が1人以上かつ active 全員が完了なら true（active 0 は false）。
export function allFinished(roster) {
  const active = activeIds(roster)
  if (active.length === 0) return false
  return active.every((id) => roster.peers[id].finished)
}
