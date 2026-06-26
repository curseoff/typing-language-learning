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
  }, 20000)

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
