// 単語問題の記録の永続化（localStorage、レベル×テーマ別）。
import { rankInsert } from '../domain/records/ranking.js'

const STORAGE_KEY = 'word-records-v1'

export function wordRecKey(level, theme) {
  return `L${level}__${theme}`
}

export function loadWordRecords() {
  try {
    const obj = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}
  } catch {
    return {}
  }
}

export function saveWordRecord(record) {
  const all = loadWordRecords()
  const key = wordRecKey(record.level, record.theme)
  all[key] = rankInsert(all[key], record)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  return all
}
