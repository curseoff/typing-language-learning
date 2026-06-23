// 記録の永続化（localStorage）。
import { recKey, rankInsert } from '../domain/records/ranking.js'

const STORAGE_KEY = 'typing-records-v3'
const OLD_STORAGE_KEY = 'typing-records-v2'

// モード×ランク別の記録オブジェクトを読む（v2 からの移行つき）
export function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const obj = JSON.parse(raw)
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj
    }
    // v2(モード別) からの移行: ランク1へ
    const v2 = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || 'null')
    if (v2 && typeof v2 === 'object' && !Array.isArray(v2)) {
      const out = {}
      for (const m of Object.keys(v2)) out[recKey(m, 1)] = v2[m]
      return out
    }
  } catch {
    // 破損時は空で開始
  }
  return {}
}

// 記録を保存し、更新後の全記録を返す
export function saveRecord(record) {
  const all = loadRecords()
  const key = recKey(record.mode, record.rank, record.source)
  all[key] = rankInsert(all[key], record)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  return all
}
