// 記録レコード {speed, accuracy, seconds, ...} に対する具体 Specification。
// makeSpec で単純な条件を組み立て、and/or/not で「良い記録」等の条件を
// 宣言的に合成する例。分岐（速い/正確/長い）をドメインに閉じ込める。
import { makeSpec } from '../spec/combinators.specification.js'

// speed が minSpeed を超過（>）する記録。
export function fasterThan(minSpeed) {
  return makeSpec((r) => r.speed > minSpeed)
}

// accuracy が minPct 以上（>=）の記録。
export function atLeastAccuracy(minPct) {
  return makeSpec((r) => r.accuracy >= minPct)
}

// seconds が minSeconds 以上（>=）の記録。
export function longerThan(minSeconds) {
  return makeSpec((r) => r.seconds >= minSeconds)
}

// 「良い記録」＝速くて正確（speed>300 かつ accuracy>=95）を部品の合成で表す。
export const isGreatRecord = fasterThan(300).and(atLeastAccuracy(95))
