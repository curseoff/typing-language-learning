// @vitest-environment jsdom
// 単語入力モードの結合テスト。canonical を打鍵して1パッセージ完走させ、
// record と問題ごとの記録(segStats=各語の速度/ミス) を確認する。
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWords } from './useWords.js'
import { WORDS } from '../content/wordsAll.js'
import { loadWordRecords, wordRecKey } from '../infrastructure/wordsRepository.js'

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

describe('useWords（単語入力・結合）', () => {
  beforeEach(() => localStorage.clear())

  const drain = (result) => {
    let n = 0
    while (!result.current.finished && n < 2000) {
      const seg = result.current.segments[result.current.segIndex]
      if (!seg) break
      typeKey(seg.canonical[result.current.segInput.length]) // canonical を1文字ずつ
      n++
    }
  }

  it('英語モードで完走し、record と segStats を保存する', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    drain(result)
    expect(result.current.finished).toBe(true)
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'en')][0]
    expect(rec.keys).toBeGreaterThan(0)
    expect(rec.mistakes).toBe(0) // 正打のみ
    expect(rec.accuracy).toBe(100)
    expect(rec.speed).toBeGreaterThan(0)
    expect(rec.segStats.length).toBeGreaterThan(0)
    expect(rec.segStats[0]).toMatchObject({ type: 'en' })
    expect(rec.segStats[0].speed).toBeGreaterThan(0)
  }, 20000)

  it('通常プレイ（seed 未指定）でも record に有効な seed が入る＝記録から再挑戦できる', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    drain(result)
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'en')][0]
    expect(rec.seed).toEqual(expect.any(Number)) // null ではなく有効な seed
    expect(rec.source).toBe('word')
  }, 20000)

  it('restart は新しい seed を切り直して別の問題列にする（record の seed が変わる）', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    drain(result)
    const first = loadWordRecords()[wordRecKey(1, 'すべて', 'en')][0].seed
    act(() => result.current.restart())
    drain(result)
    const seeds = loadWordRecords()[wordRecKey(1, 'すべて', 'en')].map((r) => r.seed)
    expect(seeds).toContain(first)
    // 2件の seed が別物（=別の問題列）であること
    expect(new Set(seeds).size).toBe(2)
  }, 20000)

  it('間違ったキーはミスとして数えられる', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    // 現在語の正しい次の文字でないキー（数字）を打つ→ミス
    const before = result.current.mistakes
    typeKey('1')
    expect(result.current.mistakes).toBe(before + 1)
    expect(result.current.hasError).toBe(true)
  })

  it('同じ seed なら同じ単語列を再現し、record に seed が入る（リプレイ）', () => {
    const seed = 987654
    const opts = { allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', seed, onExit: () => {} }
    const a = renderHook(() => useWords(opts))
    const b = renderHook(() => useWords(opts))
    const labelsA = a.result.current.segments.map((s) => s.canonical)
    const labelsB = b.result.current.segments.map((s) => s.canonical)
    expect(labelsA).toEqual(labelsB)
    expect(labelsA.length).toBeGreaterThan(0)

    // 完走して record.seed が記録されることを確認
    const { result } = renderHook(() => useWords(opts))
    drain(result)
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'en')][0]
    expect(rec.seed).toBe(seed)
    expect(rec.source).toBe('word')
  }, 20000)
})
