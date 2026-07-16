// #432 P2P穴埋め対戦：承認フローの純状態機械。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。全 API は入力非破壊で新オブジェクトを返す。
//
// state：{ phase:'proposed', proposer, config, votes }
//   votes … { [peerId]: 'pending'|'accept'|'reject' }。proposer は初期から 'accept'、他メンバーは 'pending'。

const VALID_VOTES = ['accept', 'reject']

// 承認フローの初期状態を作る。memberIds は proposer を含む全参加者。
export function initApproval({ config, memberIds, proposer }) {
  const votes = {}
  for (const id of memberIds) {
    votes[id] = id === proposer ? 'accept' : 'pending'
  }
  return { phase: 'proposed', proposer, config, votes }
}

// 投票を反映した新 state を返す。無効な vote 値・votes に無い peerId は無視（等価な新 state）。再投票は上書き。
export function castVote(state, peerId, vote) {
  const next = { ...state, votes: { ...state.votes } }
  if (VALID_VOTES.includes(vote) && peerId in next.votes) {
    next.votes[peerId] = vote
  }
  return next
}

// votes が空でなく全員 accept なら true。
export function isAllAccepted(state) {
  const values = Object.values(state.votes)
  return values.length > 0 && values.every((v) => v === 'accept')
}

// 誰か1人でも reject していれば true。
export function isRejected(state) {
  return Object.values(state.votes).some((v) => v === 'reject')
}

// reject した peerId の配列（無ければ []）。
export function rejectedBy(state) {
  return Object.keys(state.votes).filter((id) => state.votes[id] === 'reject')
}

// 指定 peer を votes から除外した新 state を返す。存在しない peer は等価な新 state。
export function removeMember(state, peerId) {
  const votes = { ...state.votes }
  delete votes[peerId]
  return { ...state, votes }
}
