// @vitest-environment jsdom
// #447 対戦（P2P）のプレイが solo の記録として保存されてしまう不具合の仕様テスト（単語入力）。
// 方針（本人決定）：対戦のプレイは記録を保存しない＝useWords に保存抑止の口 saveRecord を足す。
//   - saveRecord:false … finish() で saveWordRecord を呼ばない（永続化もランキング submit も起きない）
//   - saveRecord 未指定/true … 従来どおり保存する（solo の回帰）
//   - 終了経路（時間制 onTimeout / 問題数・ライフの finishByProgress）のどちらでも抑止が効く
//     ※ サドンデス（life）は対戦で実際に使う終了条件なので必ず押さえる
//   - 保存しなくても result / finished など他の返り値は従来どおり得られる
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('./records.service.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, saveWordRecord: vi.fn(actual.saveWordRecord) }
})

import { useWords } from './useWords.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.service.js'
import { WORDS } from '../content/wordsAll.js'
import { saveWordRecord, loadWordRecords, initMemoryPersistence } from './records.service.js'

beforeEach(() => {
  localStorage.clear()
  initMemoryPersistence() // 記録メモリ像を空にリセット
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] })
})
afterEach(() => vi.useRealTimers())

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

const runOutClock = () => {
  act(() => vi.advanceTimersByTime(TIME_LIMIT_MS + 200))
  act(() => vi.runOnlyPendingTimers())
}

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

// 無効キー（数字）を1回打ってタイプミスを起こす（語は進まない）。
const missOnce = () => {
  typeKey('1')
  act(() => vi.advanceTimersByTime(10))
}

const opts = (extra = {}) => ({
  allWords: WORDS,
  level: 1,
  theme: 'すべて',
  mode: 'en',
  onExit: () => {},
  ...extra,
})

const storedCount = () =>
  Object.values(loadWordRecords()).reduce((n, list) => n + (list?.length ?? 0), 0)

describe('useWords の記録保存抑止 saveRecord（#447 対戦は記録しない）', () => {
  it('saveRecord:false なら時間制の終了（onTimeout）で saveWordRecord を呼ばない', () => {
    const h = renderHook(() => useWords(opts({ saveRecord: false })))
    completeWord(h.result)
    runOutClock()
    expect(h.result.current.finished).toBe(true)
    expect(saveWordRecord).not.toHaveBeenCalled()
    expect(storedCount()).toBe(0)
  }, 20000)

  it('saveRecord:false ならサドンデス（life）の脱落終了でも saveWordRecord を呼ばない', () => {
    const h = renderHook(() =>
      useWords(opts({ endCondition: { kind: 'life', value: 1 }, saveRecord: false })),
    )
    completeWord(h.result)
    missOnce() // ライフ1を失って脱落＝終了
    expect(h.result.current.finished).toBe(true)
    expect(saveWordRecord).not.toHaveBeenCalled()
    expect(storedCount()).toBe(0)
  }, 20000)

  it('saveRecord:false なら問題数制の終了（finishByProgress）でも saveWordRecord を呼ばない', () => {
    const h = renderHook(() =>
      useWords(opts({ endCondition: { kind: 'items', value: 2 }, saveRecord: false })),
    )
    completeWord(h.result)
    completeWord(h.result)
    expect(h.result.current.finished).toBe(true) // 時間ではなく問題数で終了している
    expect(saveWordRecord).not.toHaveBeenCalled()
    expect(storedCount()).toBe(0)
  }, 20000)

  it('saveRecord:false でも result は従来どおり生成される（結果画面は出せる）', () => {
    const h = renderHook(() =>
      useWords(opts({ endCondition: { kind: 'items', value: 2 }, saveRecord: false })),
    )
    completeWord(h.result)
    completeWord(h.result)
    const rec = h.result.current.result
    expect(rec).toBeTruthy()
    expect(rec.source).toBe('word')
    expect(rec.mode).toBe('en')
    expect(rec.correctCount).toBe(2)
    expect(rec.speed).toEqual(expect.any(Number))
    expect(rec.segStats.length).toBeGreaterThan(0)
  }, 20000)

  it('saveRecord 未指定なら従来どおり保存する（solo の回帰）', () => {
    const h = renderHook(() => useWords(opts({ endCondition: { kind: 'items', value: 2 } })))
    completeWord(h.result)
    completeWord(h.result)
    expect(h.result.current.finished).toBe(true)
    expect(saveWordRecord).toHaveBeenCalledTimes(1)
    expect(storedCount()).toBe(1)
  }, 20000)

  it('saveRecord:true を明示しても従来どおり保存する（時間制）', () => {
    const h = renderHook(() => useWords(opts({ saveRecord: true })))
    completeWord(h.result)
    runOutClock()
    expect(h.result.current.finished).toBe(true)
    expect(saveWordRecord).toHaveBeenCalledTimes(1)
    expect(storedCount()).toBe(1)
  }, 20000)
})
