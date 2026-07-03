// 終了条件セレクタの選択肢（TOP用）。段1は「時間」のみ。
// 将来 kind（文字数/問題数/ライフ/エンドレス…）を足せるよう、値だけでなく kind を持つ形に正規化して扱う。
export const END_TIME_VALUES = [30, 60, 120, 180] // 選べる秒数（既定60＝従来挙動）
export const DEFAULT_END_CONDITION = { kind: 'time', value: 60 }

// 時間制の終了条件を作る。段1は kind='time' 固定。
export function timeEndCondition(value) {
  return { kind: 'time', value }
}
