// @vitest-environment jsdom
// #447 対戦（P2P）のプレイが solo の記録として保存されてしまう不具合の仕様テスト。
// 方針（本人決定）：対戦のプレイは記録を保存しない＝useDict に保存抑止の口 saveRecord を足す。
//   - saveRecord:false … finish() で saveDictRecord を呼ばない（永続化もランキング submit も起きない）
//   - saveRecord 未指定/true … 従来どおり保存する（solo の回帰）
//   - 終了経路（時間制 onTimeout / 文字数・問題数の finishByProgress）のどちらでも抑止が効く
//   - 保存しなくても result / finished など他の返り値は従来どおり得られる
// 保存の有無は「saveDictRecord が何回呼ばれたか」で見る（呼ばれた先の永続化・ランキングを含めて
// 一切起きないことを担保するため）。実装へは委譲するので records の中身も併せて確認する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('./records.service.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, saveDictRecord: vi.fn(actual.saveDictRecord) }
})

import { useDict } from './useDict.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.service.js'
import { DICT } from '../content/dictionaryAll.js'
import { saveDictRecord, loadDictRecords, initMemoryPersistence } from './records.service.js'

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

// n 文字ぶん現在セグの canonical を打つ。
const typeSome = (h, n) => {
  for (let i = 0; i < n; i++) {
    const seg = h.result.current.segments[h.result.current.segIndex]
    if (!seg || h.result.current.finished) break
    typeKey(seg.canonical[h.result.current.segInput.length])
    act(() => vi.advanceTimersByTime(10))
  }
}

const opts = (extra = {}) => ({
  dict: DICT,
  level: 1,
  theme: 'すべて',
  mode: 'ja',
  onExit: () => {},
  ...extra,
})

// 記録ストアに1件でも入ったか（キーを問わず）。
const storedCount = () =>
  Object.values(loadDictRecords()).reduce((n, list) => n + (list?.length ?? 0), 0)

describe('useDict の記録保存抑止 saveRecord（#447 対戦は記録しない）', () => {
  it('saveRecord:false なら時間制の終了（onTimeout）で saveDictRecord を呼ばない', () => {
    const h = renderHook(() => useDict(opts({ saveRecord: false })))
    typeSome(h, 20)
    runOutClock()
    expect(h.result.current.finished).toBe(true)
    expect(saveDictRecord).not.toHaveBeenCalled()
    expect(storedCount()).toBe(0)
  }, 20000)

  it('saveRecord:false なら文字数制の終了（finishByProgress）でも saveDictRecord を呼ばない', () => {
    const h = renderHook(() =>
      useDict(opts({ endCondition: { kind: 'chars', value: 5 }, saveRecord: false })),
    )
    typeSome(h, 10) // 5文字で終了条件に達する
    expect(h.result.current.finished).toBe(true) // 時間ではなく打鍵数で終了している
    expect(saveDictRecord).not.toHaveBeenCalled()
    expect(storedCount()).toBe(0)
  }, 20000)

  it('saveRecord:false でも result は従来どおり生成される（結果画面は出せる）', () => {
    const h = renderHook(() => useDict(opts({ saveRecord: false })))
    typeSome(h, 20)
    runOutClock()
    const rec = h.result.current.result
    expect(rec).toBeTruthy()
    expect(rec.source).toBe('dict')
    expect(rec.mode).toBe('ja')
    expect(rec.keys).toBeGreaterThan(0)
    expect(rec.speed).toEqual(expect.any(Number))
    expect(rec.segStats.length).toBeGreaterThan(0)
  }, 20000)

  it('saveRecord 未指定なら従来どおり保存する（solo の回帰）', () => {
    const h = renderHook(() => useDict(opts()))
    typeSome(h, 20)
    runOutClock()
    expect(h.result.current.finished).toBe(true)
    expect(saveDictRecord).toHaveBeenCalledTimes(1)
    expect(storedCount()).toBe(1)
  }, 20000)

  it('saveRecord:true を明示しても従来どおり保存する', () => {
    const h = renderHook(() =>
      useDict(opts({ endCondition: { kind: 'chars', value: 5 }, saveRecord: true })),
    )
    typeSome(h, 10)
    expect(h.result.current.finished).toBe(true)
    expect(saveDictRecord).toHaveBeenCalledTimes(1)
    expect(storedCount()).toBe(1)
  }, 20000)
})
