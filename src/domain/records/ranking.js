// 記録ランキングのルール（純粋）。
import { normalizeEndCondition } from '../session/endCondition.js'

export const MAX_RECORDS = 15

// 終了条件をランキングキーの区別用タグへ変換する（#208 段0b・段6）。
// 既定 time60・null/undefined は空文字＝従来キーと同一（後方互換）。
// endless は値なしの種別タグ 'E'（速度順の別ランキング。#208 段6）。
// それ以外は kind の頭文字＋value（例 T30/C600/I25/L3）。
export function endConditionTag(endCondition) {
  const { kind, value } = normalizeEndCondition(endCondition)
  if (kind === 'time' && value === 60) return ''
  const prefix = { time: 'T', chars: 'C', items: 'I', life: 'L', endless: 'E' }[kind]
  return kind === 'endless' ? prefix : `${prefix}${value}`
}

// 記録対象か（#208 段6：endless も ESC で30秒以上プレイしたら記録対象）。
export function isRecordable() {
  return true
}

// 終了条件ごとの成績比較（#208 段0b・Array.sort 準拠：負=a が上位/正=b/0=同着）。
// 入力レコードは読み取りのみ（非破壊）。欠損は不利側の既定へ落とす。
// 昇順比較（Infinity 同士でも NaN を出さず 0 を返す。減算だと Infinity-Infinity=NaN になる）。
const cmpAsc = (x, y) => (x < y ? -1 : x > y ? 1 : 0)

export function compareRecords(endCondition, a, b) {
  const { kind } = normalizeEndCondition(endCondition)
  switch (kind) {
    case 'chars':
      // 少ない秒数が上位＝速い方が上。同秒はミスの少ない順。
      return (
        cmpAsc(a.seconds ?? Infinity, b.seconds ?? Infinity) ||
        (a.mistakes ?? 0) - (b.mistakes ?? 0)
      )
    case 'items':
    case 'life':
      // 正解数の多い方が上位。同数は速い方が上。
      return (
        (b.correctCount ?? 0) - (a.correctCount ?? 0) ||
        cmpAsc(a.seconds ?? Infinity, b.seconds ?? Infinity)
      )
    case 'endless':
      // 速度(WPM)の速い方が上位。同速はミスの少ない順（#208 段6）。
      return (b.speed ?? 0) - (a.speed ?? 0) || (a.mistakes ?? 0) - (b.mistakes ?? 0)
    case 'time':
    default:
      // タイピング数の多い方が上位。同数はミスの少ない順（未知 kind もここへ）。
      return (b.keys ?? 0) - (a.keys ?? 0) || (a.mistakes ?? 0) - (b.mistakes ?? 0)
  }
}

// モード×ランクの記録キー。source で出題元を分ける（文章=sentence / 単語例文=wsent）。
// theme を渡すとテーマ別キーになる（単語例文＝単語/英英と同様にテーマ別ランキング）。
// theme 未指定（文章・タッチ等）はキー据え置きで後方互換。
// endCondition を渡すと終了条件別キーになる（time60/endless/未指定はタグ無し＝従来キー）。
export function recKey(mode, rank, source = 'sentence', theme, endCondition) {
  const base = source === 'sentence' ? `${mode}__r${rank}` : `${mode}__${source}${rank}`
  const withTheme = theme != null ? `${base}__${theme}` : base
  const t = endConditionTag(endCondition)
  return t ? `${withTheme}__${t}` : withTheme
}

// 記録を追加し、終了条件に応じた成績順で上位 max 件に絞った新しい配列を返す。
// endCondition 未指定ならレコード自身の endCondition（無ければ time60）で並べる。
// time60 では従来どおり keys 降順→mistakes 昇順（compareRecords の time 分岐と一致）。
export function rankInsert(list, record, endCondition = undefined, max = MAX_RECORDS) {
  const next = [...(list || []), record]
  const ec = endCondition ?? normalizeEndCondition(record?.endCondition)
  next.sort((a, b) => compareRecords(ec, a, b))
  return next.slice(0, max)
}
