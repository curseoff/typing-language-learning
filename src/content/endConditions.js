// 終了条件セレクタの選択肢とラベル（TOP用）。#208 段2b：時間/文字数の2種別。
// domain/session/endCondition.js の {kind,value} モデルに対応する（value は数値）。
// 将来 items/life/endless も同じ構造（種別ごとに値・ラベル・単位・既定値）で足せる。
export const END_TIME_VALUES = [30, 60, 120, 180] // 時間制の秒数（既定60＝従来挙動）
export const END_CHARS_VALUES = [300, 600, 1200] // 文字数制の文字数

// 種別の定義（表示順）。label=種別名、unit=値の単位、values=選べる値、defaultValue=種別切替時の既定。
export const END_KINDS = [
  { kind: 'time', label: '時間', unit: '秒', values: END_TIME_VALUES, defaultValue: 60 },
  { kind: 'chars', label: '文字数', unit: '文字', values: END_CHARS_VALUES, defaultValue: 600 },
]

export const DEFAULT_END_CONDITION = { kind: 'time', value: 60 }

// 種別定義を引く（未知は先頭＝時間にフォールバック）。
export function endKind(kind) {
  return END_KINDS.find((k) => k.kind === kind) ?? END_KINDS[0]
}

// 時間制の終了条件を作る。
export function timeEndCondition(value) {
  return { kind: 'time', value }
}

// 文字数制の終了条件を作る。
export function charsEndCondition(value) {
  return { kind: 'chars', value }
}

// 種別の既定値で終了条件を作る（種別チップの切替時に使う）。
export function endConditionForKind(kind) {
  const k = endKind(kind)
  return { kind: k.kind, value: k.defaultValue }
}

// 値チップのラベル（例: "60秒" / "600文字"）。
export function endValueLabel(kind, value) {
  return `${value}${endKind(kind).unit}`
}

// 説明文用の終了サマリ（例: "60秒で終了" / "600文字打ったら終了"）。null は既定に落とす。
export function endConditionSummary(endCondition) {
  const kind = endCondition?.kind ?? 'time'
  const value = endCondition?.value ?? 60
  if (kind === 'chars') return `${value}文字打ったら終了`
  return `${value}秒で終了`
}
