// 記録ランキングのルール（純粋）。
import { normalizeEndCondition } from '../session/endCondition.js'

export const MAX_RECORDS = 15

// 終了条件をランキングキーの識別トークンへ変換する（#208 段0b）。
// 既定 time60・endless・null/undefined は空文字＝従来キーと同一（後方互換）。
// それ以外は kind の頭文字＋value（例 T30/C600/I25/L3）。
export function endConditionToken(endCondition) {
  const { kind, value } = normalizeEndCondition(endCondition)
  if (kind === 'endless') return ''
  if (kind === 'time' && value === 60) return ''
  const prefix = { time: 'T', chars: 'C', items: 'I', life: 'L' }[kind]
  return `${prefix}${value}`
}

// 記録対象か（endless のみ非対象）（#208 段0b）。
export function isRecordable(endCondition) {
  return normalizeEndCondition(endCondition).kind !== 'endless'
}

// 終了条件ごとの成績比較（#208 段0b・Array.sort 準拠：負=a が上位/正=b/0=同着）。
// 入力レコードは読み取りのみ（非破壊）。欠損は不利側の既定へ落とす。
export function compareRecords(endCondition, a, b) {
  const { kind } = normalizeEndCondition(endCondition)
  switch (kind) {
    case 'chars':
      // 少ない秒数が上位＝速い方が上。同秒はミスの少ない順。
      return (
        (a.seconds ?? Infinity) - (b.seconds ?? Infinity) ||
        (a.mistakes ?? 0) - (b.mistakes ?? 0)
      )
    case 'items':
    case 'life':
      // 正解数の多い方が上位。同数は速い方が上。
      return (
        (b.correctCount ?? 0) - (a.correctCount ?? 0) ||
        (a.seconds ?? Infinity) - (b.seconds ?? Infinity)
      )
    case 'endless':
      return 0
    case 'time':
    default:
      // タイピング数の多い方が上位。同数はミスの少ない順（未知 kind もここへ）。
      return (b.keys ?? 0) - (a.keys ?? 0) || (a.mistakes ?? 0) - (b.mistakes ?? 0)
  }
}

// モード×ランクの記録キー。source で出題元を分ける（文章=sentence / 単語例文=wsent）。
// theme を渡すとテーマ別キーになる（単語例文＝単語/英英と同様にテーマ別ランキング）。
// theme 未指定（文章・タッチ等）はキー据え置きで後方互換。
export function recKey(mode, rank, source = 'sentence', theme) {
  const base = source === 'sentence' ? `${mode}__r${rank}` : `${mode}__${source}${rank}`
  return theme != null ? `${base}__${theme}` : base
}

// 記録を追加し、タイピング数(keys)の多い順で上位 max 件に絞った新しい配列を返す。
// 60秒固定なので keys が成績そのもの。同数はミスの少ない順。古い記録(keys 無し)は 0 扱い。
export function rankInsert(list, record, max = MAX_RECORDS) {
  const next = [...(list || []), record]
  next.sort((a, b) => (b.keys ?? 0) - (a.keys ?? 0) || (a.mistakes ?? 0) - (b.mistakes ?? 0))
  return next.slice(0, max)
}
