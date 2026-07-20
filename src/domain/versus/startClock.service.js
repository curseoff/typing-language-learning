// #426 対戦基盤スライス1：ホストのレース開始時刻を各端末のローカル時刻に換算する。
// localStartTime({ hostStartAt, clockOffsetMs }) → number（= hostStartAt - offset）。
// 純ドメイン：performance.now()/Date 等を内部で呼ばない＝時刻は引数で受ける・決定的・副作用なし・入力非破壊。

// ホストの開始時刻からローカル開始時刻を求める。
//   hostStartAt … ホスト時刻でのレース開始時刻。非有限数（NaN/Infinity/undefined/非数）は TypeError。
//   clockOffsetMs … 自端末とホストの時計ずれ（自端末が進んでいれば正）。非有限は 0 に強制。
export function localStartTime({ hostStartAt, clockOffsetMs }) {
  if (typeof hostStartAt !== 'number' || !Number.isFinite(hostStartAt)) {
    throw new TypeError(`localStartTime: hostStartAt は有限数が必要: ${String(hostStartAt)}`)
  }
  // offset は信頼できない測定値なので非有限なら 0 として扱う（安全側）。
  const offset = Number.isFinite(clockOffsetMs) ? clockOffsetMs : 0
  return hostStartAt - offset
}
