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

  it('日本語入力モードで完走し record と segStats を保存する', () => {
    const { result } = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'ja', onExit: () => {} }),
    )
    let n = 0
    while (!result.current.finished && n < 3000) {
      const seg = result.current.seg
      if (!seg) break
      typeKey(seg.canonical[result.current.input.length])
      n++
    }
    expect(result.current.finished).toBe(true)
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')][0]
    expect(rec.mistakes).toBe(0)
    expect(rec.segStats.length).toBeGreaterThan(0)
    expect(rec.segStats.length).toBe(rec.words)
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
