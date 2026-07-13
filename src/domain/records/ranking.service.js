// 記録ランキングのルール（純粋）。
import { normalizeEndCondition } from '../session/endCondition.vo.js'

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

// ランキングの並び順は kind→比較器の RANKING_COMPARATORS テーブルに集約（Strategy・
// 種別追加は1エントリ・items/life は同一規則）。各比較器は Array.sort 準拠（負=a 上位）。
const RANKING_COMPARATORS = {
  // 少ない秒数が上位＝速い方が上。同秒はミスの少ない順。
  chars: (a, b) =>
    cmpAsc(a.seconds ?? Infinity, b.seconds ?? Infinity) || (a.mistakes ?? 0) - (b.mistakes ?? 0),
  // 正解数の多い方が上位。同数は速い方が上。
  items: (a, b) =>
    (b.correctCount ?? 0) - (a.correctCount ?? 0) ||
    cmpAsc(a.seconds ?? Infinity, b.seconds ?? Infinity),
  // 速度(WPM)の速い方が上位。同速はミスの少ない順（#208 段6）。
  endless: (a, b) => (b.speed ?? 0) - (a.speed ?? 0) || (a.mistakes ?? 0) - (b.mistakes ?? 0),
  // タイピング数の多い方が上位。同数はミスの少ない順（未知 kind もここへ既定）。
  time: (a, b) => (b.keys ?? 0) - (a.keys ?? 0) || (a.mistakes ?? 0) - (b.mistakes ?? 0),
}
RANKING_COMPARATORS.life = RANKING_COMPARATORS.items // items と life は同一規則

export function compareRecords(endCondition, a, b) {
  const { kind } = normalizeEndCondition(endCondition)
  // 未知 kind は time 既定へフォールバック（従来 switch の default と同値）。
  const cmp = RANKING_COMPARATORS[kind] ?? RANKING_COMPARATORS.time
  return cmp(a, b)
}

// モード×ランクの記録キー。source で出題元を分ける（文章=sentence / 単語例文=wsent）。
// theme を渡すとテーマ別キーになる（単語例文＝単語/英英と同様にテーマ別ランキング）。
// theme 未指定（文章・タッチ等）はキー据え置きで後方互換。
// endCondition を渡すと終了条件別キーになる（time60/endless/未指定はタグ無し＝従来キー）。
// #364 第6引数 range（単語例文 wsent の固定範囲）：range 未指定（undefined/null）は従来と完全に同一の
// キー（既存 5引数呼びは byte 同一）。range 有りは ec タグの後ろに __R{range}（range を使うのは wsent のみ）。
export function recKey(mode, rank, source = 'sentence', theme, endCondition, range) {
  const base = source === 'sentence' ? `${mode}__r${rank}` : `${mode}__${source}${rank}`
  const withTheme = theme != null ? `${base}__${theme}` : base
  const t = endConditionTag(endCondition)
  const withEc = t ? `${withTheme}__${t}` : withTheme
  return range != null ? `${withEc}__R${range}` : withEc
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
