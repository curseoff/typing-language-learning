// 採点結果（Score）の Value Object（不変・自己検証・値等価）。#311 スライス。
// これまで {speed, accuracy, seconds} という生リテラルが marathon/scoring.service.js の score() から
// 層をまたいで流れ、採点式が1箇所に閉じていなかった。makeScore に採点式を内包し、
// 消費側（分割代入 const {speed,accuracy,seconds} = ...）と形状互換の凍結オブジェクトを返す。
// 公開は speed/accuracy/seconds の3項目のみ（メソッドを持たない＝形状互換）。
// 純ドメイン：React/DOM/Date/performance/乱数 非依存・副作用なし・決定的。

// 打鍵カウンタ（keys/mistakes）の入力制約：非負整数。
function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

// elapsedMs の入力制約：非負の有限数（小数許容）。
function isNonNegativeFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

// 打鍵/分（速度）の正準式（#412）。ms>0 のとき keys/(ms/60000) を四捨五入、さもなくば 0（ゼロ除算回避）。
// makeScore の speed・segmentStats の segmentScore/quizScore・ライブ HUD が全てこの1式に寄る。
export function keysPerMinute(keys, ms) {
  return ms > 0 ? Math.round(keys / (ms / 60000)) : 0
}

// Score のファクトリ＋採点式＋自己検証＋不変（凍結）。不変条件違反は throw する。
//   keys/mistakes … 非負整数（負/非整数/NaN/Infinity/非数は throw）。
//   elapsedMs … 非負の有限数（負/NaN/Infinity/非数は throw、小数は許容）。
// 採点式（marathon/scoring.service.js と一致・形状互換）：
//   speed    … elapsedMs>0 のとき keys/分を四捨五入、さもなくば 0（ゼロ除算回避）。
//   accuracy … keys+mistakes>0 のとき keys/(keys+mistakes)*100 を四捨五入、さもなくば 100。
//   seconds  … elapsedMs を 0.1 秒刻みに四捨五入（Math.round(elapsedMs/100)/10）。
export function makeScore({ keys, mistakes, elapsedMs }) {
  if (!isNonNegativeInteger(keys)) {
    throw new Error(`makeScore: keys は非負整数が必要: ${String(keys)}`)
  }
  if (!isNonNegativeInteger(mistakes)) {
    throw new Error(`makeScore: mistakes は非負整数が必要: ${String(mistakes)}`)
  }
  if (!isNonNegativeFinite(elapsedMs)) {
    throw new Error(`makeScore: elapsedMs は非負の有限数が必要: ${String(elapsedMs)}`)
  }

  const speed = keysPerMinute(keys, elapsedMs) // 打/分
  const denom = keys + mistakes
  const accuracy = denom > 0 ? Math.round((keys / denom) * 100) : 100
  const seconds = Math.round(elapsedMs / 100) / 10

  return Object.freeze({ speed, accuracy, seconds })
}

// 型ガード（throw しない）。x がオブジェクトで各項目が妥当なら true。
//   speed … 非負整数、accuracy … 0..100 の整数、seconds … 非負の有限数。
// null/非オブジェクト/範囲外/不正値は false。
export function isScore(x) {
  if (x == null || typeof x !== 'object') return false
  const { speed, accuracy, seconds } = x
  if (!isNonNegativeInteger(speed)) return false
  if (!Number.isInteger(accuracy) || accuracy < 0 || accuracy > 100) return false
  return isNonNegativeFinite(seconds)
}

// 値等価（throw しない）。両者が妥当な Score で speed/accuracy/seconds が厳密一致すれば true。
// 相違/不正/null は false。
export function scoreEquals(a, b) {
  if (!isScore(a) || !isScore(b)) return false
  return a.speed === b.speed && a.accuracy === b.accuracy && a.seconds === b.seconds
}
