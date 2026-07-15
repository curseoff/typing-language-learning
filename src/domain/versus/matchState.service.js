// #426 対戦基盤スライス1：対戦の状態機械 transition(state, event) → newState。
// 対戦フェーズ（waiting → connecting → countdown → running → finished）の遷移を司る純ロジック。
// 純ドメイン：React/DOM/Date/performance/乱数 非依存・副作用なし・決定的・入力非破壊（新オブジェクト返却）。

// 正常遷移表：{ 現在 phase: { event.type: 次 phase } }。表に無い (phase, type) は現状維持。
// aborted はどの phase からでも finished へ落とす特別遷移なので、ここには載せず下で個別に扱う。
const TRANSITIONS = {
  waiting: { connectStarted: 'connecting' },
  connecting: { allConnected: 'countdown' },
  countdown: { raceStarted: 'running' },
  running: { allFinished: 'finished' },
  // finished は終端（どの event でも遷移しない）。
  finished: {},
}

// state と event から次の state を返す。未定義遷移・未知 type は現状維持（throw しない）。
// finished は終端。aborted は finished 以外の任意 phase から finished へ（event.reason を state.reason に伝播）。
export function transition(state, event) {
  const phase = state?.phase
  const type = event?.type

  // aborted は表外の特別遷移。finished（終端）からは動かさない。
  if (type === 'aborted' && phase !== 'finished') {
    const next = { ...state, phase: 'finished' }
    // reason が指定されていれば載せる（無ければ載せない＝undefined のまま）。
    if (event.reason !== undefined) next.reason = event.reason
    return next
  }

  const nextPhase = TRANSITIONS[phase]?.[type]
  // 未定義遷移・未知 type・終端は現状維持（別オブジェクトで返し入力を破壊しない）。
  if (nextPhase === undefined) return { ...state }

  return { ...state, phase: nextPhase }
}
