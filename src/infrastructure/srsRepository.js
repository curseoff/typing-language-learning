// SRS(間隔反復)カードの永続化（localStorage）。id=単語の en。
// 新規導入は1日あたり上限を設けるため、日次の導入数も meta に持つ。
const STORAGE_KEY = 'srs-v1'
const META_KEY = 'srs-meta-v1'

// 今日の「日番号」（エポックからの日数）。タイムゾーンの揺れを避けるためローカル日付で算出。
export function todayNum() {
  const d = new Date()
  return Math.floor((d - d.getTimezoneOffset() * 60000) / 86400000)
}

export function loadSrs() {
  try {
    const obj = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}
  } catch {
    return {}
  }
}

export function saveCard(id, card) {
  const all = loadSrs()
  all[id] = card
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // 保存失敗は無視（プライベートモード等）
  }
  return all
}

// 今日すでに導入した新規数（日付が変われば 0 にリセット）
export function newIntroducedToday() {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) || '{}')
    return m.date === todayNum() ? m.count || 0 : 0
  } catch {
    return 0
  }
}

export function addIntroduced(n) {
  const today = todayNum()
  const count = newIntroducedToday() + n
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ date: today, count }))
  } catch {
    // 無視
  }
  return count
}
