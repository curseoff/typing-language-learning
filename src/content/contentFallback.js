// 教材の SQLite 読込が失敗し生成物 .js にフォールバックした回数を記録する（現場観測用）。
// バックエンドが無いため localStorage に累積し、DevTools で `window.__contentFallbacks` や
// localStorage['content-fallback-v1'] を見れば「SQLite が現場で失敗していないか」を確認できる。
const KEY = 'content-fallback-v1'
const counts = {} // セッション内カウント（source 別）

// source='words'|'dict'|'sentences'|'gloss'。error は原因。console.warn も兼ねる。
export function recordContentFallback(source, error) {
  counts[source] = (counts[source] || 0) + 1
  console.warn(`[content] ${source} の SQLite 読込に失敗→.js フォールバック（累計 ${counts[source]}）`, error)
  try {
    const ls = globalThis.localStorage
    const store = JSON.parse(ls?.getItem(KEY) || '{}')
    store[source] = (store[source] || 0) + 1
    store.lastAt = new Date().toISOString()
    store.lastError = String((error && error.message) || error)
    ls?.setItem(KEY, JSON.stringify(store))
  } catch {
    // localStorage 不可（プライベートモード等）は無視＝計測はベストエフォート
  }
  if (typeof window !== 'undefined') window.__contentFallbacks = { ...counts }
}

// セッション内のフォールバック回数（source 別）を返す。
export function contentFallbackCounts() {
  return { ...counts }
}
