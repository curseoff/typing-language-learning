// @vitest-environment jsdom
// 4択クイズ（単語）の結合テスト。打鍵をシミュレートして1プレイ完走させ、
// 記録(record)と問題ごとの記録(segStats)が正しく保存されることを確認する。
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWordQuiz } from './useWordQuiz.js'
import { WORDS } from '../content/wordsAll.js'
import { loadWordRecords, wordRecKey } from '../infrastructure/wordsRepository.js'

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })
const typeStr = (s) => [...s].forEach(typeKey)

describe('useWordQuiz（4択・結合）', () => {
  beforeEach(() => localStorage.clear())

  it('全問、正解の選択肢を打って完走し、record と segStats(全問正解) を保存する', () => {
    const { result } = renderHook(() =>
      useWordQuiz({ words: WORDS, level: 1, theme: 'すべて', dir: 'en', mode: 'quiz-en', onExit: () => {} }),
    )
    let guard = 0
    while (!result.current.finished && guard < 100) {
      const q = result.current.question
      const correct = q.options.find((o) => o.answer)
      typeStr(correct.variants[0]) // 正解の英単語を打つ→確定
      typeKey('Enter') // 次へ
      guard++
    }
    expect(result.current.finished).toBe(true)
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'quiz-en')][0]
    expect(rec.correct).toBe(rec.words) // 全問正解
    expect(rec.accuracy).toBe(100)
    expect(rec.segStats).toHaveLength(rec.words)
    expect(rec.segStats.every((s) => s.correct === true)).toBe(true)
    expect(rec.segStats[0]).toHaveProperty('label')
    expect(rec.segStats[0]).toHaveProperty('answer')
  })

  it('通常プレイ（seed 未指定）でも record に有効な seed が入る＝記録から再挑戦できる', () => {
    const { result } = renderHook(() =>
      useWordQuiz({ words: WORDS, level: 1, theme: 'すべて', dir: 'en', mode: 'quiz-en', onExit: () => {} }),
    )
    let guard = 0
    while (!result.current.finished && guard < 100) {
      const q = result.current.question
      typeStr(q.options.find((o) => o.answer).variants[0])
      typeKey('Enter')
      guard++
    }
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'quiz-en')][0]
    expect(rec.seed).toEqual(expect.any(Number))
    expect(rec.source).toBe('word')
  })

  it('不正解の選択肢を打つと、その設問の segStats.correct が false になる', () => {
    const { result } = renderHook(() =>
      useWordQuiz({ words: WORDS, level: 1, theme: 'すべて', dir: 'en', mode: 'quiz-en', onExit: () => {} }),
    )
    // 1問目だけわざと不正解、以降は正解で完走
    let first = true
    let guard = 0
    while (!result.current.finished && guard < 100) {
      const q = result.current.question
      const opt = first ? q.options.find((o) => !o.answer) : q.options.find((o) => o.answer)
      typeStr(opt.variants[0])
      typeKey('Enter')
      first = false
      guard++
    }
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'quiz-en')][0]
    expect(rec.segStats[0].correct).toBe(false)
    expect(rec.correct).toBe(rec.words - 1)
  })

  it('同じ seed なら同じ出題・選択肢を再現し、record に seed が入る（リプレイ）', () => {
    const seed = 135790
    const opts = { words: WORDS, level: 1, theme: 'すべて', dir: 'en', mode: 'quiz-en', seed, onExit: () => {} }
    const a = renderHook(() => useWordQuiz(opts))
    const b = renderHook(() => useWordQuiz(opts))
    // 出題列（prompt）と各問の選択肢表示が一致する
    const sigA = a.result.current
    const sigB = b.result.current
    expect(sigA.question.prompt).toBe(sigB.question.prompt)
    expect(sigA.question.options.map((o) => o.display)).toEqual(
      sigB.question.options.map((o) => o.display),
    )

    const { result } = renderHook(() => useWordQuiz(opts))
    let guard = 0
    while (!result.current.finished && guard < 100) {
      const q = result.current.question
      const correct = q.options.find((o) => o.answer)
      typeStr(correct.variants[0])
      typeKey('Enter')
      guard++
    }
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'quiz-en')][0]
    expect(rec.seed).toBe(seed)
    expect(rec.source).toBe('word')
  })
})
