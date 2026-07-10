// #273 Phase3b: 副タブの BroadcastChannel 受信判断（純関数・DOM/infra 非依存）。
// BroadcastChannel はベストエフォート（change 欠落あり）＋主不在の過渡がある前提で、
// 「古いエポックのメッセージは棄却（安全側）」「変更/主交代は必ず snapshot 再取得の契機」に寄せる。
//   state = { epoch:number }（副が把握している最新 epoch）
//   戻り値 = { nextState, effect } / effect ∈ 'request-snapshot' | 'replace-image' | 'ignore'
// 入力 state は破壊しない（常に新オブジェクトを返す）。

// 古いエポックのメッセージ棄却判定。msgEpoch < myEpoch なら stale=true。
// epoch 不明（null/undefined）は安全側で stale 扱い（＝棄却）。
export function isStale(msgEpoch, myEpoch) {
  if (msgEpoch == null) return true
  return msgEpoch < myEpoch
}

const max = (a, b) => (b > a ? b : a)

export function handleSecondaryMessage(state, msg) {
  const epoch = state.epoch
  const type = msg && msg.type

  // 主交代の告知：常に snapshot 再取得の契機。epoch は下げない（max）。
  if (type === 'primary-changed') {
    return { nextState: { epoch: max(epoch, msg.epoch) }, effect: 'request-snapshot' }
  }

  // 像の受領：stale（epoch < 自分）は棄却、そうでなければ差し替えて epoch を snapshot 値へ。
  if (type === 'snapshot') {
    if (isStale(msg.epoch, epoch)) return { nextState: { epoch }, effect: 'ignore' }
    return { nextState: { epoch: msg.epoch }, effect: 'replace-image' }
  }

  // 主の変更通知：stale は棄却、そうでなければ snapshot を要求し epoch を max へ。
  if (type === 'change') {
    if (isStale(msg.epoch, epoch)) return { nextState: { epoch }, effect: 'ignore' }
    return { nextState: { epoch: max(epoch, msg.epoch) }, effect: 'request-snapshot' }
  }

  // 未知 type は据え置きで ignore。
  return { nextState: { epoch }, effect: 'ignore' }
}
