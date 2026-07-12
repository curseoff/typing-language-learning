// 記録の識別キー生成（純粋・DOM/infra 非依存）。
// #274 で localStorage リポジトリ（wordsRepository/dictRepository/storyRepository/
// itemStatsRepository）から分離した。永続化が sqlite/memory 専用へ転換したあとも、
// 記録メモリ像のキー付けと DB リポジトリのキー算出に共通して使うため domain へ移設。
import { endConditionTag } from './ranking.service.js'

// 単語問題記録のキー（レベル×テーマ×モード別。終了条件はタグで区別）。
// #362 第5引数 range（単語固定範囲）：range 未指定（undefined/null）は従来と完全に同一のキー、
// range 有りは ec タグの後ろに __R{range} を連結する（base(__ecTag)?__R{range} の順）。
export function wordRecKey(level, theme, mode, endCondition, range) {
  const base = `L${level}__${theme}__${mode}`
  const t = endConditionTag(endCondition)
  const withEc = t ? `${base}__${t}` : base
  return range != null ? `${withEc}__R${range}` : withEc
}

// 英英辞典記録のキー（wordRecKey と同形式・別ドメイン）。
export function dictRecKey(level, theme, mode, endCondition) {
  const base = `L${level}__${theme}__${mode}`
  const t = endConditionTag(endCondition)
  return t ? `${base}__${t}` : base
}

// 物語記録のキー（物語ごとに接頭辞で分ける。終了条件はタグで区別）。
// time60/未指定はタグ無し＝従来キーと一致（後方互換）。
const RECORDS_PREFIX = 'story-records-v1-'
export function storyRecKey(storyId, endCondition) {
  const base = `${RECORDS_PREFIX}${storyId}`
  const t = endConditionTag(endCondition)
  return t ? `${base}__${t}` : base
}

// 問題ごとの累積記録の id（type:mode:key 形式）。type='s'|'w'|'d'|'story' などモード別に分ける。
export const itemId = (type, mode, key) => `${type}:${mode}:${key}`
