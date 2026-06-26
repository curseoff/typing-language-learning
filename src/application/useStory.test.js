// @vitest-environment jsdom
// 物語の結合テスト。テキスト→選択肢を辿ってエンドまで完走させ、
// record に source='story' と mode が入る（リプレイ用）ことを確認する。
// 物語は固定ナラティブ（決定的）なので seed は不要：同じ選択を辿れば同じ問題列になる。
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStory } from './useStory.js'
import { loadStoryRecords } from '../infrastructure/storyRepository.js'

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })
const typeStr = (s) => [...s].forEach(typeKey)

// テキストは canonical を打ち、選択肢は先頭の選択肢を打つ。エンドに着くまで進める。
function playToEnding(result) {
  let guard = 0
  while (result.current.stage !== 'ending' && guard < 5000) {
    if (result.current.stage === 'text') {
      const seg = result.current.units[result.current.unitIndex]
      typeKey(seg.canonical[result.current.input.length])
    } else if (result.current.stage === 'choice') {
      typeStr(result.current.choiceSegs[0].canonical) // 先頭の選択肢を選ぶ
    }
    guard++
  }
}

describe('useStory（物語・結合）', () => {
  beforeEach(() => localStorage.clear())

  it('英語モードで完走し record に source=story と mode が入る', () => {
    const { result } = renderHook(() =>
      useStory({ mode: 'en', start: null, onExit: () => {} }),
    )
    playToEnding(result)
    expect(result.current.stage).toBe('ending')
    const rec = loadStoryRecords()[0]
    expect(rec.source).toBe('story')
    expect(rec.mode).toBe('en')
    expect(rec.ending).toBeTruthy()
    expect(rec.segStats.length).toBeGreaterThan(0)
    // 選んだ選択肢が順番に記録される（分岐を辿るので 1 件以上）
    expect(rec.choices.length).toBeGreaterThan(0)
    rec.choices.forEach((c) => {
      expect(typeof c.en).toBe('string')
      expect(typeof c.ja).toBe('string')
      // afterSeg＝この選択をした時点の場面数。場面数の範囲に収まり、
      // 場面数を超えない（選択は本文を打ち終えた直後に起きるため）。
      expect(typeof c.afterSeg).toBe('number')
      expect(c.afterSeg).toBeGreaterThan(0)
      expect(c.afterSeg).toBeLessThanOrEqual(rec.segStats.length)
    })
    // afterSeg は選んだ順に単調非減少（時系列で前から後ろへ進む）
    const afters = rec.choices.map((c) => c.afterSeg)
    expect(afters).toEqual([...afters].sort((a, b) => a - b))
  }, 20000)

  it('リプレイ（再スタート）後の新記録にも choices が入る', () => {
    const { result } = renderHook(() =>
      useStory({ mode: 'en', start: null, onExit: () => {} }),
    )
    playToEnding(result)
    act(() => result.current.restart()) // 再挑戦
    playToEnding(result)
    const recs = loadStoryRecords()
    expect(recs.length).toBe(2)
    recs.forEach((rec) => expect(rec.choices.length).toBeGreaterThan(0))
  }, 30000)

  it('物語は決定的：同じ選択を辿れば同じ場面（問題列）を再現する', () => {
    const a = renderHook(() => useStory({ mode: 'en', start: null, onExit: () => {} }))
    const b = renderHook(() => useStory({ mode: 'en', start: null, onExit: () => {} }))
    playToEnding(a.result)
    playToEnding(b.result)
    const recs = loadStoryRecords()
    const labelsA = recs[0].segStats.map((s) => s.label)
    const labelsB = recs[1].segStats.map((s) => s.label)
    expect(labelsA).toEqual(labelsB)
  }, 20000)
})
