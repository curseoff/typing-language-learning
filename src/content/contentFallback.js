// 教材の SQLite 読込が失敗し生成物 .js にフォールバックした回数を記録する（現場観測用）。
// バックエンドが無いため localStorage に累積し、DevTools で `window.__contentFallbacks` や
// localStorage['content-fallback-v1'] を見れば「SQLite が現場で失敗していないか」を確認できる。
const KEY = 'content-fallback-v1'
const counts = {} // セッション内カウント（source 別）
const listeners = new Set() // フォールバック発生を購読するリスナー（UI 告知用）

// 購読者へフォールバック発生を通知する（引数なし。購読側は hasContentFallback() を読む）。
function notify() {
  for (const l of listeners) l()
}

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
  notify()
}

// セッション内のフォールバック回数（source 別）を返す。
// 注意：毎回新規オブジェクトを返すため useSyncExternalStore の getSnapshot には使わない（無限ループになる）。
export function contentFallbackCounts() {
  return { ...counts }
}

// いずれかの source でフォールバックが発生したか（boolean）。
// 参照安定な primitive を返すので useSyncExternalStore の getSnapshot に使える。
export function hasContentFallback() {
  return Object.keys(counts).length > 0
}

// フォールバック発生を購読する。listener は recordContentFallback のたびに呼ばれる。
// 解除関数を返す（useSyncExternalStore が unmount 時に呼ぶ）。
export function subscribeContentFallback(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
