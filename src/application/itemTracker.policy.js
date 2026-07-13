// 問題ごとの打鍵・ミス・時間を集計する純関数（#355 方針A）。
// クロック(now)は引数で受け、記録は emit（{id,delta}）で返し、tr は破壊しない。
// 各関数は統一的に {next, emit} を返す（呼び出し側は next で ref 更新・emit で記録）。
// 呼び出し側（入力フック useMarathon/useWords/useDict/useStory）が now と IO を担う。id は問題ごとに一意な文字列。

export const newTracker = () => Object.freeze({ cur: null, keys: 0, mistakes: 0, start: 0, last: 0 })

// tr を emit（記録用 {id,delta}）へ写す。cur && keys>0 の時だけ emit、それ以外 null。
const toEmit = (tr) =>
  tr.cur && tr.keys > 0
    ? { id: tr.cur, delta: { keys: tr.keys, mistakes: tr.mistakes, ms: Math.max(0, tr.last - tr.start) } }
    : null

// 正しい打鍵ごとに呼ぶ。id が変わったら前の問題を emit して新しい問題を now で開始。
export function trackKey(tr, id, now) {
  if (tr.cur === id) {
    return { next: Object.freeze({ ...tr, keys: tr.keys + 1, last: now }), emit: null }
  }
  return {
    next: Object.freeze({ cur: id, keys: 1, mistakes: 0, start: now, last: now }),
    emit: toEmit(tr),
  }
}

// ミス時に呼ぶ。cur 有りなら mistakes+1、無しなら不変。emit は常に null。
export function trackMiss(tr) {
  if (!tr.cur) return { next: tr, emit: null }
  return { next: Object.freeze({ ...tr, mistakes: tr.mistakes + 1 }), emit: null }
}

// 現在の問題を emit してリセット（問題切替・終了時）。next は初期状態。
export function flushTracker(tr) {
  return { next: newTracker(), emit: toEmit(tr) }
}
