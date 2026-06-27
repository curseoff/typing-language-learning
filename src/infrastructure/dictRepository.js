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
  // 全モードでタイピング数(keys)の多い順に統一（60秒固定なので keys が成績）。同数はミスの少ない順。
  list.sort((a, b) => (b.keys ?? 0) - (a.keys ?? 0) || (a.mistakes ?? 0) - (b.mistakes ?? 0))
  all[key] = list.slice(0, MAX_RECORDS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  return all
}
