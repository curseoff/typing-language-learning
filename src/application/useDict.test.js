// @vitest-environment jsdom
// 英英入力モードの結合テスト。canonical を打鍵して完走させ record と segStats を確認する。
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDict } from './useDict.js'
import { DICT } from '../content/dictionaryAll.js'
import { loadDictRecords, dictRecKey } from '../infrastructure/dictRepository.js'

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

describe('useDict（英英入力・結合）', () => {
  beforeEach(() => localStorage.clear())

  const drain = (h) => {
    let n = 0
    while (!h.result.current.finished && n < 3000) {
      const seg = h.result.current.seg
      if (!seg) break
      typeKey(seg.canonical[h.result.current.input.length])
      n++
    }
  }

  it('日本語入力モードで完走し record と segStats を保存する', () => {
    const h = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'ja', onExit: () => {} }),
    )
    drain(h)
    expect(h.result.current.finished).toBe(true)
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')][0]
    expect(rec.mistakes).toBe(0)
    expect(rec.segStats.length).toBeGreaterThan(0)
    expect(rec.segStats.length).toBe(rec.words)
  }, 20000)

  it('通常プレイ（seed 未指定）でも record に有効な seed が入る＝記録から再挑戦できる', () => {
    const h = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'ja', onExit: () => {} }),
    )
    drain(h)
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')][0]
    expect(rec.seed).toEqual(expect.any(Number))
    expect(rec.source).toBe('dict')
  }, 20000)

  it('restart は新しい seed を切り直して別の見出し語列にする', () => {
    const h = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'ja', onExit: () => {} }),
    )
    drain(h)
    const first = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')][0].seed
    act(() => h.result.current.restart())
    drain(h)
    const seeds = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')].map((r) => r.seed)
    expect(seeds).toContain(first)
    expect(new Set(seeds).size).toBe(2)
  }, 20000)

  it('同じ seed なら restart 後も含め同一の見出し語列を再現（リプレイ＝記録 seed で復元）', () => {
    const seed = 135790
    const opts = { dict: DICT, level: 1, theme: 'すべて', mode: 'ja', seed, onExit: () => {} }
    const a = renderHook(() => useDict(opts))
    drain(a)
    const recA = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')][0]
    // 別フックを同じ seed で起こすと同一の見出し語列が復元される
    const b = renderHook(() => useDict(opts))
    drain(b)
    const recs = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')]
    const labelsB = recs[0].segStats.map((s) => s.label) // 最新（b）の列
    const labelsA = recA.segStats.map((s) => s.label)
    expect(labelsB).toEqual(labelsA)
    expect(recs[0].seed).toBe(seed)
  }, 20000)

  it('同じ seed なら同じ見出し語列を再現し、record に seed が入る（リプレイ）', () => {
    const seed = 246810
    const opts = { dict: DICT, level: 1, theme: 'すべて', mode: 'ja', seed, onExit: () => {} }
    const a = renderHook(() => useDict(opts))
    const b = renderHook(() => useDict(opts))
    // 出題の見出し語列が一致するよう、各フックを通しで打って segStats のラベル列を比較
    const drain = (h) => {
      let n = 0
      while (!h.result.current.finished && n < 3000) {
        const seg = h.result.current.seg
        if (!seg) break
        typeKey(seg.canonical[h.result.current.input.length])
        n++
      }
    }
    drain(a)
    drain(b)
    const recs = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')]
    const labelsA = recs[0].segStats.map((s) => s.label)
    const labelsB = recs[1].segStats.map((s) => s.label)
    expect(labelsA).toEqual(labelsB)
    expect(recs[0].seed).toBe(seed)
    expect(recs[0].source).toBe('dict')
  }, 20000)
})
