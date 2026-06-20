// 記録ランキングのルール（純粋）。
export const MAX_RECORDS = 15

// モード×ランクの記録キー
export function recKey(mode, rank) {
  return `${mode}__r${rank}`
}

// 記録を追加し、速い順で上位 max 件に絞った新しい配列を返す
export function rankInsert(list, record, max = MAX_RECORDS) {
  const next = [...(list || []), record]
  next.sort((a, b) => b.speed - a.speed) // 速い順
  return next.slice(0, max)
}
