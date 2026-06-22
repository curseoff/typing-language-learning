// 問題ごとの累積記録（localStorage）。id ごとに count/keys/mistakes/ms を積算する。
// id 例: 's:I go to school every day.' / 'w:reserve' / 'd:hotel'
const STORAGE_KEY = 'item-stats-v1'

export function loadItemStats() {
  try {
    const obj = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}
  } catch {
    return {}
  }
}

export function recordItemStat(id, { keys, mistakes, ms }) {
  const all = loadItemStats()
  const c = all[id] || { count: 0, keys: 0, mistakes: 0, ms: 0 }
  all[id] = {
    count: c.count + 1,
    keys: c.keys + keys,
    mistakes: c.mistakes + mistakes,
    ms: c.ms + ms,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // 保存失敗は無視（プライベートモード等）
  }
  return all
}
