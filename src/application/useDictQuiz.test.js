// @vitest-environment jsdom
// 英英4択クイズの結合テスト。打鍵で完走し、record と segStats を確認する。
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDictQuiz } from './useDictQuiz.js'
import { DICT } from '../content/dictionaryAll.js'
import { loadDictRecords, dictRecKey } from '../infrastructure/dictRepository.js'

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

describe('useDictQuiz（英英4択・結合）', () => {
  beforeEach(() => localStorage.clear())

  it('全問正解で完走し、record と segStats(全問正解) を保存する', () => {
    const { result } = renderHook(() =>
      useDictQuiz({ dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', onExit: () => {} }),
    )
    let guard = 0
    while (!result.current.finished && guard < 100) {
      const correct = result.current.question.options.find((o) => o.answer)
      ;[...correct.variants[0]].forEach(typeKey) // 正解の見出し語を打つ
      typeKey('Enter')
      guard++
    }
    expect(result.current.finished).toBe(true)
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz')][0]
    expect(rec.correct).toBe(rec.words)
    expect(rec.segStats).toHaveLength(rec.words)
    expect(rec.segStats.every((s) => s.correct === true)).toBe(true)
  })
})
