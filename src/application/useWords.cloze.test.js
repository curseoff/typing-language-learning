// @vitest-environment jsdom
// #402 穴埋め学習モード（cloze）の結合テスト。5問ブロックで normal→cloze を交互に出し、
// 問題数制は実効目標が2倍になること・cloze 語のミスで正解を開示すること・記録に learning が載ることを確認する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWords } from './useWords.js'
import { WORDS } from '../content/wordsAll.js'
import { loadWordRecords, wordRecKey, initMemoryPersistence } from './records.service.js'

beforeEach(() => {
  localStorage.clear()
  initMemoryPersistence()
  vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] })
})
afterEach(() => vi.useRealTimers())

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

// 現在セグを canonical で1つ完了させる（en は綴りをそのまま打つ）。
const completeSeg = (result) => {
  const seg = result.current.segments[result.current.segIndex]
  if (!seg) return
  for (const ch of seg.canonical) {
    typeKey(ch)
    act(() => vi.advanceTimersByTime(5))
  }
}
const completeSegs = (result, n) => {
  for (let i = 0; i < n; i++) completeSeg(result)
}

describe('useWords cloze（#402 穴埋め・結合）', () => {
  it('最初の5問は通常・6問目以降が穴埋め（cloze/hint 付き）になる', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', learningMode: 'cloze', onExit: () => {} }),
    )
    const segs = result.current.segments
    // en は 1語=1seg。ブロック 5＝先頭5問 normal（cloze 無し）→続く5問 cloze。
    expect(segs[0].cloze).toBeFalsy()
    expect(segs[4].cloze).toBeFalsy()
    expect(segs[5].cloze).toBe(true)
    expect(typeof segs[5].hint).toBe('string') // 反対側（日本語）がヒント
    expect(segs[5].hint.length).toBeGreaterThan(0)
  })

  it('問題数制 items=4 は cloze で実効目標が2倍（8問）になってから finish する', () => {
    const endCondition = { kind: 'items', value: 4 }
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', endCondition, learningMode: 'cloze', onExit: () => {} }),
    )
    // 4問（=原値）ではまだ終わらない（2倍＝8問が実効目標）。
    completeSegs(result, 4)
    expect(result.current.finished).toBe(false)
    // 合計8問で終了する。
    completeSegs(result, 4)
    expect(result.current.finished).toBe(true)
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'en', endCondition)][0]
    expect(rec.learning).toBe('cloze') // 記録に学習モードが載る
  }, 20000)

  it('cloze 語で1文字ミスすると clozeRevealed が立ち、次の語で戻る', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', learningMode: 'cloze', onExit: () => {} }),
    )
    // 先頭5問（normal）を消化して cloze 語（index 5）に到達する。
    completeSegs(result, 5)
    expect(result.current.segments[result.current.segIndex].cloze).toBe(true)
    expect(result.current.clozeRevealed).toBe(false)
    // わざと不正キー（数字）を打つ→ミス→開示。
    typeKey('1')
    expect(result.current.clozeRevealed).toBe(true)
    // その語を打ち切ると次の語へ＝開示リセット。
    completeSeg(result)
    expect(result.current.clozeRevealed).toBe(false)
  }, 20000)

  it('learningMode 未指定（normal）は cloze を付けず従来どおり', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    expect(result.current.segments.every((s) => !s.cloze)).toBe(true)
    expect(result.current.clozeRevealed).toBe(false)
  })
})
