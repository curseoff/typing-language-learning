// 英英辞典の記録の永続化（localStorage、レベル×テーマ×モード別）。
import { MAX_RECORDS } from '../domain/records/ranking.js'

const STORAGE_KEY = 'dict-records-v1'

export function dictRecKey(level, theme, mode) {
  return `L${level}__${theme}__${mode}`
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
  const all = loadDictRecords()
  const key = dictRecKey(record.level, record.theme, record.mode)
  const list = [...(all[key] || []), record]
  if (record.mode === 'quiz') {
    list.sort((a, b) => b.correct - a.correct || a.seconds - b.seconds)
  } else {
    list.sort((a, b) => b.speed - a.speed)
  }
  all[key] = list.slice(0, MAX_RECORDS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  return all
}
