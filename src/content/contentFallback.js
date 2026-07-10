// content は SQLite→.js フォールバックの純粋な発生シグナル（counts＋購読）だけを持つ。
// 永続化（localStorage）は infrastructure/observability/contentFallbackStore が購読して行う
// ＝依存逆転（infra→content）。ここでは DevTools 観測用の副作用を持たない。
const counts = {} // セッション内カウント（source 別）
const listeners = new Set() // フォールバック発生を購読するリスナー（永続化・UI 告知用）

// 購読者へフォールバック発生を通知する。payload = { source, error } を載せて渡す新契約。
function notify(payload) {
  for (const l of listeners) l(payload)
}

// source='words'|'dict'|'sentences'|'gloss'。error は原因。console.warn も兼ねる。
export function recordContentFallback(source, error) {
  counts[source] = (counts[source] || 0) + 1
  console.warn(`[content] ${source} の SQLite 読込に失敗→.js フォールバック（累計 ${counts[source]}）`, error)
  notify({ source, error })
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

// フォールバック発生を購読する。listener は recordContentFallback のたびに { source, error } で呼ばれる。
// 解除関数を返す（useSyncExternalStore が unmount 時に呼ぶ）。
export function subscribeContentFallback(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
