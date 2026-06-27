// 記録ランキングのルール（純粋）。
export const MAX_RECORDS = 15

// モード×ランクの記録キー。source で出題元を分ける（文章=sentence / 単語例文=wsent）。
export function recKey(mode, rank, source = 'sentence') {
  return source === 'sentence' ? `${mode}__r${rank}` : `${mode}__${source}${rank}`
}

// 記録を追加し、タイピング数(keys)の多い順で上位 max 件に絞った新しい配列を返す。
// 60秒固定なので keys が成績そのもの。同数はミスの少ない順。古い記録(keys 無し)は 0 扱い。
export function rankInsert(list, record, max = MAX_RECORDS) {
  const next = [...(list || []), record]
  next.sort((a, b) => (b.keys ?? 0) - (a.keys ?? 0) || (a.mistakes ?? 0) - (b.mistakes ?? 0))
  return next.slice(0, max)
}
