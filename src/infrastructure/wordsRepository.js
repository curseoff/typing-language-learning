// 単語問題の記録の永続化（localStorage、レベル×テーマ×モード別）。
import { MAX_RECORDS } from '../domain/records/ranking.js'

const STORAGE_KEY = 'word-records-v2'

export function wordRecKey(level, theme, mode) {
  return `L${level}__${theme}__${mode}`
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
  const key = wordRecKey(record.level, record.theme, record.mode)
  const list = [...(all[key] || []), record]
  if (record.mode === 'quiz') {
    list.sort((a, b) => b.correct - a.correct || a.seconds - b.seconds) // 正解多い→速い
  } else {
    list.sort((a, b) => b.speed - a.speed) // 速い順
  }
  all[key] = list.slice(0, MAX_RECORDS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  return all
}
