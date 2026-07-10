// @vitest-environment jsdom
// content の「純粋シグナル」を infrastructure が購読して永続化する（依存逆転）契約テスト。
// startContentFallbackPersistence() は subscribeContentFallback で購読し、発生ごとに
// localStorage['content-fallback-v1']（= { ...counts, lastAt, lastError }）と window.__contentFallbacks を書く。
// ※ counts / listeners はモジュール共有のため、resetModules + 動的 import で各 it を隔離する
//   （store は同じ contentFallback インスタンスを購読する必要があるので、両者を同一グラフで再 import する）。
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('infrastructure/observability/contentFallbackStore', () => {
  let recordContentFallback
  let startContentFallbackPersistence

  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    delete window.__contentFallbacks
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const content = await import('../../content/contentFallback.js')
    recordContentFallback = content.recordContentFallback
    const store = await import('./contentFallbackStore.adapter.js')
    startContentFallbackPersistence = store.startContentFallbackPersistence
  })

  it('購読開始後に record すると localStorage と window に反映される', () => {
    startContentFallbackPersistence()
    recordContentFallback('words', new Error('x'))
    const store = JSON.parse(localStorage.getItem('content-fallback-v1'))
    expect(store.words).toBe(1)
    expect(store.lastError).toBe('x')
    expect(typeof store.lastAt).toBe('string')
    expect(window.__contentFallbacks.words).toBe(1)
  })

  it('複数 source・複数回で counts が累積して localStorage に反映される', () => {
    startContentFallbackPersistence()
    recordContentFallback('words', new Error('a'))
    recordContentFallback('words', new Error('b'))
    recordContentFallback('dict', new Error('c'))
    const store = JSON.parse(localStorage.getItem('content-fallback-v1'))
    expect(store.words).toBe(2)
    expect(store.dict).toBe(1)
    expect(window.__contentFallbacks.words).toBe(2)
    expect(window.__contentFallbacks.dict).toBe(1)
  })

  it('返り値の解除関数を呼ぶと以後の発生は localStorage/window に反映されない', () => {
    const stop = startContentFallbackPersistence()
    recordContentFallback('words', new Error('x'))
    stop()
    recordContentFallback('words', new Error('y')) // 解除後の発生
    const store = JSON.parse(localStorage.getItem('content-fallback-v1'))
    expect(store.words).toBe(1) // 解除前の 1 回だけ反映
    expect(window.__contentFallbacks.words).toBe(1)
  })

  it('localStorage 不可でも throw しない（永続化はベストエフォート）', () => {
    startContentFallbackPersistence()
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => recordContentFallback('words', new Error('x'))).not.toThrow()
    spy.mockRestore()
  })
})
