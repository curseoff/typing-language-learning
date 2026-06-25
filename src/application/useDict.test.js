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
})
