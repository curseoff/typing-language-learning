// 物語の「発見エンド」の永続化（localStorage）。
const FOUND_KEY = 'story-endings-v1'

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
