// content の発生シグナルを購読して localStorage/window へ永続化する observability アダプタ
// （infra→content の正しい向き・DI 逆転）。best-effort（localStorage 不可でも throw しない）。
import { subscribeContentFallback, contentFallbackCounts } from '../../content/contentFallback.js'

const KEY = 'content-fallback-v1'

// フォールバック発生を購読し、発生ごとに累積 counts を localStorage と window.__contentFallbacks へ書く。
// 解除関数（subscribe の戻り）をそのまま返す。
export function startContentFallbackPersistence() {
  return subscribeContentFallback((payload) => {
    const counts = contentFallbackCounts()
    try {
      const ls = globalThis.localStorage
      ls?.setItem(
        KEY,
        JSON.stringify({
          ...counts,
          lastAt: new Date().toISOString(),
          lastError: String(payload?.error?.message ?? payload?.error ?? ''),
        }),
      )
    } catch {
      // localStorage 不可（プライベートモード等）は無視＝計測はベストエフォート
    }
    if (typeof window !== 'undefined') window.__contentFallbacks = { ...counts }
  })
}
