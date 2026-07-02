// @vitest-environment jsdom
// contentFallback の購読機構と boolean スナップショットの配線テスト。
// counts/localStorage/window.__contentFallbacks の既存挙動が保たれることも確認する。
// ※ counts はモジュール内で共有され初期化できないため、各 it を独立に読める順序非依存な形で書く。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  recordContentFallback,
  hasContentFallback,
  subscribeContentFallback,
  contentFallbackCounts,
} from './contentFallback.js'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  localStorage.clear()
})

describe('contentFallback 購読機構', () => {
  it('初期状態（未発生）は hasContentFallback() が false', async () => {
    // counts はモジュール共有で他テストが汚すため、隔離した新規インスタンスで初期値を検証する。
    vi.resetModules()
    const fresh = await import('./contentFallback.js')
    expect(fresh.hasContentFallback()).toBe(false)
  })

  it('subscribeContentFallback は record で発火し、解除関数で解除できる', () => {
    let calls = 0
    const off = subscribeContentFallback(() => {
      calls += 1
    })
    recordContentFallback('words', new Error('boom'))
    expect(calls).toBe(1)
    off()
    recordContentFallback('words', new Error('boom2'))
    expect(calls).toBe(1) // 解除後は増えない
  })

  it('record 後に hasContentFallback() が true（boolean を返す）', () => {
    recordContentFallback('dict', new Error('x'))
    const v = hasContentFallback()
    expect(typeof v).toBe('boolean')
    expect(v).toBe(true)
  })

  it('hasContentFallback は参照安定な primitive を返す（呼び出し間で同値）', () => {
    recordContentFallback('sentences', new Error('x'))
    expect(hasContentFallback()).toBe(hasContentFallback())
  })

  it('既存の counts/localStorage/window の挙動が保たれる', () => {
    const before = contentFallbackCounts().gloss || 0
    recordContentFallback('gloss', new Error('detail'))
    expect(contentFallbackCounts().gloss).toBe(before + 1)
    const store = JSON.parse(localStorage.getItem('content-fallback-v1'))
    expect(store.gloss).toBe(1)
    expect(store.lastError).toBe('detail')
    expect(store.lastAt).toBeTruthy()
    expect(window.__contentFallbacks.gloss).toBe(before + 1)
  })
})
