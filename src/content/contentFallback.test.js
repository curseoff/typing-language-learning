// @vitest-environment jsdom
// contentFallback の購読機構と boolean スナップショットの配線テスト。
// content は「純粋シグナル」＝ counts を増やし notify({ source, error }) で購読者へ渡すだけ。
// localStorage / window.__contentFallbacks への永続化は infrastructure（contentFallbackStore）へ移譲したので
// ここでは検証しない（＝ content 単体では localStorage を書かないことを確認する）。
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

  it('購読 listener は { source, error } を受け取る（notify がデータを載せる新契約）', () => {
    const received = []
    const off = subscribeContentFallback((payload) => received.push(payload))
    const err = new Error('detail')
    recordContentFallback('dict', err)
    off()
    expect(received).toHaveLength(1)
    expect(received[0]?.source).toBe('dict')
    expect(received[0]?.error).toBe(err)
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

  it('record で counts が増える（source 別に累積）', () => {
    const before = contentFallbackCounts().gloss || 0
    recordContentFallback('gloss', new Error('detail'))
    expect(contentFallbackCounts().gloss).toBe(before + 1)
  })

  it('content 単体では localStorage を書かない（永続化は infrastructure の責務）', () => {
    recordContentFallback('words', new Error('x'))
    expect(localStorage.getItem('content-fallback-v1')).toBeNull()
  })
})
