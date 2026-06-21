// 物語の永続化（発見エンド＋記録ランキング）。
import { rankInsert } from '../domain/records/ranking.js'

const FOUND_KEY = 'story-endings-v1'
const RECORDS_KEY = 'story-records-v1'

export function loadFound() {
  try {
    const a = JSON.parse(localStorage.getItem(FOUND_KEY) || '[]')
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

export function saveFound(ids) {
  localStorage.setItem(FOUND_KEY, JSON.stringify(ids))
}

export function loadStoryRecords() {
  try {
    const a = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]')
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

export function saveStoryRecord(record) {
  const list = rankInsert(loadStoryRecords(), record) // 速い順・最大15件
  localStorage.setItem(RECORDS_KEY, JSON.stringify(list))
  return list
}
