// 英英辞典の記録の永続化（localStorage、レベル×テーマ×モード別）。
import { MAX_RECORDS, compareRecords, endConditionToken, isRecordable } from '../domain/records/ranking.js'
import { normalizeEndCondition } from '../domain/session/endCondition.js'

const STORAGE_KEY = 'dict-records-v1'

export function dictRecKey(level, theme, mode, endCondition) {
  const base = `L${level}__${theme}__${mode}`
  const t = endConditionToken(endCondition)
  return t ? `${base}__${t}` : base
}

export function loadDictRecords() {
  try {
    const obj = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}
  } catch {
    return {}
  }
}

export function saveDictRecord(record) {
  if (!isRecordable(record.endCondition)) return loadDictRecords() // endless は非記録
  const all = loadDictRecords()
  const key = dictRecKey(record.level, record.theme, record.mode, record.endCondition)
  const list = [...(all[key] || []), record]
  // 終了条件に応じた成績順に統一（time60 では従来どおり keys 降順→mistakes 昇順）。
  list.sort((a, b) => compareRecords(normalizeEndCondition(record.endCondition), a, b))
  all[key] = list.slice(0, MAX_RECORDS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  return all
}
