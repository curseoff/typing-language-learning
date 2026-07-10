// 記録レコード（ScoreRecord）の Value Object（不変・自己検証・値等価的な形状）。#311 スライス。
// これまで {...meta, keys, mistakes, speed, accuracy, seconds} という生リテラルを
// sessionToRecord が手組みしており、採点式・入力検証がレコード生成側に散っていた。
// makeScore（score.vo.js）を内包して採点を1箇所に委ね、外部メタ(meta)を重ねた凍結レコードを返す。
// 公開は meta の各項目＋コア5項目（keys/mistakes/speed/accuracy/seconds）。elapsedMs は採点の入力のみで出力しない。
// 純ドメイン：React/DOM/Date/performance/乱数 非依存・副作用なし・決定的。
import { makeScore, isScore } from './score.vo.js'

// 打鍵カウンタ（keys/mistakes）の制約：非負整数。
function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

// ScoreRecord のファクトリ＋採点（makeScore 内包）＋meta マージ＋不変（凍結）。
//   keys/mistakes … 非負整数（負/非整数/NaN/Infinity/非数は throw）。← makeScore 由来の検証。
//   elapsedMs … 非負の有限数（負/NaN/Infinity/非数は throw、小数は許容）。← makeScore 由来の検証。
//   meta … 記録に重ねる外部文脈（mode/rank/source/theme/date 等）。任意。
// meta を先に展開し、コア項目（keys/mistakes/speed/accuracy/seconds）で上書きする
// ＝meta が採点/進捗の値を汚染できない。elapsedMs は採点の入力のみで出力に含めない。
export function makeScoreRecord({ keys, mistakes, elapsedMs, meta = {} }) {
  const { speed, accuracy, seconds } = makeScore({ keys, mistakes, elapsedMs })
  return Object.freeze({ ...meta, keys, mistakes, speed, accuracy, seconds })
}

// 型ガード（throw しない）。x がオブジェクトで keys/mistakes が非負整数、かつ
// 内包する {speed, accuracy, seconds} が妥当な Score（isScore）なら true。余分な meta 項目は許容（寛容）。
// null/非オブジェクト/不正値は false。
export function isScoreRecord(x) {
  if (x == null || typeof x !== 'object') return false
  if (!isNonNegativeInteger(x.keys) || !isNonNegativeInteger(x.mistakes)) return false
  return isScore({ speed: x.speed, accuracy: x.accuracy, seconds: x.seconds })
}
