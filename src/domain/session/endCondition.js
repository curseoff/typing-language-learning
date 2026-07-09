// セッションの終了条件（EndCondition）。#208 段0 の判定関数群＋#290 Phase1 の Value Object。
// EndCondition は Value Object（不変・自己検証・値等価）＝生成は makeEndCondition に集約する。
// endCondition={kind,value}、progress={elapsedMs,keys,items,missedItems}。
// React/DOM/Date/performance 非依存・副作用なし・決定的に保つ（時間の計測は呼び出し側で行い、
// この層は渡された progress の数値だけで判定する）。
//
// kind の意味：
//   time    … value 秒の経過で終了（elapsedMs はミリ秒）
//   chars   … value 文字の打鍵で終了（keys）
//   items   … value 問題の消化で終了（items）
//   life    … value 個の「ミスした問題」で終了（missedItems）＝ライフ制。
//             打鍵ミス総数(mistakes)ではなく問題単位で数える（同一問題内の複数ミスは1）。
//   endless … 終了条件なし（常に false）。value は持たない（null）。

// value を持つ「counted 系」kind（endless 以外の既知 kind）。
const COUNTED_KINDS = ['time', 'chars', 'items', 'life']

// counted 系の value 制約：正の有限数。
function isPositiveFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

// EndCondition のファクトリ＋自己検証＋不変（凍結）。不変条件違反は throw する。
//   endless … value を無視して null。
//   counted系 … value は正の有限数が必須（0/負/NaN/Infinity/非数は throw）。
//   未知 kind … throw。
export function makeEndCondition(kind, value) {
  if (kind === 'endless') return Object.freeze({ kind: 'endless', value: null })
  if (!COUNTED_KINDS.includes(kind)) {
    throw new Error(`makeEndCondition: 未知の kind: ${String(kind)}`)
  }
  if (!isPositiveFinite(value)) {
    throw new Error(`makeEndCondition: ${kind} の value は正の有限数が必要: ${String(value)}`)
  }
  return Object.freeze({ kind, value })
}

// 型ガード（throw しない）。x がオブジェクトで kind が既知・value が kind と整合なら true。
//   endless … value===null、counted系 … value が正の有限数。
export function isEndCondition(x) {
  if (x == null || typeof x !== 'object') return false
  const { kind, value } = x
  if (kind === 'endless') return value === null
  if (!COUNTED_KINDS.includes(kind)) return false
  return isPositiveFinite(value)
}

// 値等価（throw しない）。両者が妥当な EndCondition で kind・value が一致すれば true。
// 不正/null は false（endless は value=null===null で一致）。
export function endConditionEquals(a, b) {
  if (!isEndCondition(a) || !isEndCondition(b)) return false
  return a.kind === b.kind && a.value === b.value
}

// 既定の終了条件（60 秒）。ファクトリ生成の凍結 VO。
const DEFAULT_END_CONDITION = makeEndCondition('time', 60)

// 終了に達したか。未知 kind は false（勝手に終了させないフェイルセーフ）。
export function shouldFinish(endCondition, progress) {
  const { kind, value } = endCondition
  const elapsedMs = progress.elapsedMs ?? 0
  const keys = progress.keys ?? 0
  const items = progress.items ?? 0
  const missedItems = progress.missedItems ?? 0
  switch (kind) {
    case 'time':
      return elapsedMs >= value * 1000
    case 'chars':
      return keys >= value
    case 'items':
      return items >= value
    case 'life':
      return missedItems >= value
    case 'endless':
      return false
    default:
      return false
  }
}

// 未信頼入力を終了条件（凍結 VO）へ正規化する入口アダプタ。常に妥当な凍結 VO を返す（throw しない）。
//   null/undefined … 既定（time,60）。
//   妥当な {kind,value} … makeEndCondition で凍結 VO 化。
//   不正（value 不正/未知 kind）… その kind の妥当既定へ寛容フォールバック（不明なら time60）。
export function normalizeEndCondition(input) {
  if (input == null) return DEFAULT_END_CONDITION
  const { kind, value } = input
  if (kind === 'endless') return makeEndCondition('endless')
  if (!COUNTED_KINDS.includes(kind)) return DEFAULT_END_CONDITION
  if (isPositiveFinite(value)) return makeEndCondition(kind, value)
  // kind は妥当だが value が不正＝その kind の既定値へ寛容に落とす。
  return makeEndCondition(kind, DEFAULT_VALUE_BY_KIND[kind])
}

// counted 系 kind の寛容フォールバック用の既定値（value 不正時に落とす先）。
const DEFAULT_VALUE_BY_KIND = { time: 60, chars: 600, items: 25, life: 3 }

// カウントダウンタイマーの制限時間(ms)。時間制は value 秒＝value*1000。
// 非時間 kind（chars/items/life/endless）は「時間では終わらない」ので Infinity を返す
// ＝タイマー（useCountdownTimer）は決して発火せず、終了は進捗判定（shouldFinish）が担う（#208 段2a）。
export function endLimitMs(input) {
  const { kind, value } = normalizeEndCondition(input)
  if (kind === 'time') return value * 1000
  return Infinity
}

// 0..1 の進捗率。value<=0・endless・欠損は 0（ゼロ除算回避）、超過は 1 に clamp。
export function progressRatio(endCondition, progress) {
  const { kind, value } = endCondition
  const elapsedMs = progress.elapsedMs ?? 0
  const keys = progress.keys ?? 0
  const items = progress.items ?? 0
  const missedItems = progress.missedItems ?? 0
  let ratio
  switch (kind) {
    case 'time':
      ratio = value > 0 ? elapsedMs / (value * 1000) : 0
      break
    case 'chars':
      ratio = value > 0 ? keys / value : 0
      break
    case 'items':
      ratio = value > 0 ? items / value : 0
      break
    case 'life':
      ratio = value > 0 ? missedItems / value : 0
      break
    default:
      // endless・未知 kind は進捗率の概念が無い。
      return 0
  }
  return Math.min(1, Math.max(0, ratio))
}
