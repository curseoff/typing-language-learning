// @vitest-environment jsdom
// #208 段5: ライフ制（サドンデス）の結合テスト（単語入力・入力系）。
// 仕様（本人決定）：
//  - ミスは「問題単位」で数える。ある問題で打鍵ミスが1回でもあれば、その問題は
//    「ミスした問題」＝ライフ1消費。同じ問題内で何回打鍵ミスしても消費は1のまま。
//  - ミスした問題数（missedItems）がライフ数（value）に達したら脱落＝終了。
//  - 成績の主指標 correctCount ＝「ミス0で完答した問題数」（items 制と同じ定義）。
//    correctCount = segStats.filter(s => !s.partial && (s.mistakes ?? 0) === 0).length
// 本体（useWords / endCondition）は coder が Green で問題単位の判定に直す。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWords } from './useWords.js'
import { WORDS } from '../content/wordsAll.js'
import { loadWordRecords, wordRecKey, initMemoryPersistence } from './records.service.js'

beforeEach(() => {
  localStorage.clear()
  initMemoryPersistence() // 記録メモリ像を空にリセット（sqlite専用化で facade は localStorage を読まない）
  vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] })
})
afterEach(() => vi.useRealTimers())

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

// 現在語を canonical で最後まで打って完答する（1語=1問・ノーミス）。
const completeWord = (result) => {
  const startIdx = result.current.segIndex
  let guard = 0
  while (result.current.segIndex === startIdx && !result.current.finished && guard < 100) {
    const seg = result.current.segments[result.current.segIndex]
    const pos = result.current.segInput.length
    typeKey(seg.canonical[pos])
    act(() => vi.advanceTimersByTime(10))
    guard++
  }
}

// 現在語で無効キー（数字）を1回打ってタイプミスを起こす（語は進まない）。
const missOnce = () => {
  typeKey('1')
  act(() => vi.advanceTimersByTime(10))
}

const opts = (endCondition) => ({
  allWords: WORDS,
  level: 1,
  theme: 'すべて',
  mode: 'en',
  endCondition,
  onExit: () => {},
})

const lifeKey = (value) => wordRecKey(1, 'すべて', 'en', { kind: 'life', value })

describe('useWords（単語入力・ライフ制 life・#208 段5）', () => {
  it('life=2: 問題1で2回打鍵ミスしても脱落しない（同じ問題はライフ消費1）', () => {
    const { result } = renderHook(() => useWords(opts({ kind: 'life', value: 2 })))
    missOnce() // 問題1の1回目ミス → ミスした問題は1つ
    expect(result.current.finished).toBe(false)
    missOnce() // 問題1の2回目ミス → 同じ問題なので消費は1のまま
    expect(result.current.finished).toBe(false) // 打鍵ミス総数2でも問題単位では脱落しない
  }, 20000)

  it('life=2: 別々の2問でミスすると2問目のミス時点で脱落する', () => {
    const { result } = renderHook(() => useWords(opts({ kind: 'life', value: 2 })))
    missOnce() // 問題1でミス（消費1）
    completeWord(result) // 問題1を完答して問題2へ
    expect(result.current.finished).toBe(false) // まだ消費1
    missOnce() // 問題2でミス（消費2＝ライフ尽きる）
    expect(result.current.finished).toBe(true)
  }, 20000)

  it('life=3: 1問で3回打鍵ミスしても脱落しない（問題単位＝消費1）', () => {
    const { result } = renderHook(() => useWords(opts({ kind: 'life', value: 3 })))
    missOnce()
    missOnce()
    missOnce()
    expect(result.current.finished).toBe(false) // 打鍵ミス3でも「ミスした問題」は1つ
  }, 20000)

  it('ミス0で完答を続ける限り life では終了しない', () => {
    const { result } = renderHook(() => useWords(opts({ kind: 'life', value: 2 })))
    completeWord(result)
    completeWord(result)
    completeWord(result)
    expect(result.current.finished).toBe(false)
  }, 20000)

  it('life=1: 最初にミスした問題で脱落し、記録に correctCount/kind=life/seconds を残す', () => {
    const { result } = renderHook(() => useWords(opts({ kind: 'life', value: 1 })))
    completeWord(result) // 問題1 ノーミス完答
    completeWord(result) // 問題2 ノーミス完答
    expect(result.current.finished).toBe(false)
    missOnce() // 問題3で打鍵ミス → missedItems=1 → 脱落
    expect(result.current.finished).toBe(true)
    const rec = loadWordRecords()[lifeKey(1)][0]
    expect(rec.correctCount).toBe(2) // ミス0で完答したのは問題1・2の2問
    expect(rec.endCondition.kind).toBe('life')
    expect(rec.seconds).toEqual(expect.any(Number))
  }, 20000)

  it('life=2: 完答途中にミスした問題は correctCount に数えない', () => {
    const { result } = renderHook(() => useWords(opts({ kind: 'life', value: 2 })))
    completeWord(result) // 問題1 ノーミス → correctCount 候補
    missOnce() // 問題2でミス（消費1）
    completeWord(result) // 問題2をミスありで完答（correctCount に入らない）
    expect(result.current.finished).toBe(false)
    missOnce() // 問題3でミス（消費2）→ 脱落
    expect(result.current.finished).toBe(true)
    const rec = loadWordRecords()[lifeKey(2)][0]
    expect(rec.correctCount).toBe(1) // ミス0完答は問題1のみ
  }, 20000)
})
