// @vitest-environment jsdom
// 問題ごとの打鍵・ミス・時間の集計（id 切替で flush・ミス加算・flush の記録と ms 計算）の単体テスト。
// recordItemStat はモックして呼び出し引数を検証する。performance.now は fake timer で制御する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { newTracker, trackKey, trackMiss, flushTracker } from './itemTracker.js'
import { recordItemStat } from '../infrastructure/itemStatsRepository.js'

vi.mock('../infrastructure/itemStatsRepository.js', () => ({
  recordItemStat: vi.fn(),
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] })
  recordItemStat.mockClear()
})
afterEach(() => vi.useRealTimers())

describe('application/itemTracker', () => {
  it('newTracker は初期値（cur=null, 各 0）を返す', () => {
    expect(newTracker()).toEqual({ cur: null, keys: 0, mistakes: 0, start: 0, last: 0 })
  })

  it('trackKey は同 id 連続で keys を加算する', () => {
    const tr = newTracker()
    trackKey(tr, 'a')
    trackKey(tr, 'a')
    trackKey(tr, 'a')
    expect(tr.cur).toBe('a')
    expect(tr.keys).toBe(3)
    expect(recordItemStat).not.toHaveBeenCalled()
  })

  it('trackKey は id が変わると前の問題を flush（記録）して新 id を開始する', () => {
    const tr = newTracker()
    trackKey(tr, 'a') // start=0
    vi.advanceTimersByTime(500)
    trackKey(tr, 'a') // last=500
    trackKey(tr, 'b') // id 変化 → 前(a)を flush して b を開始
    expect(recordItemStat).toHaveBeenCalledTimes(1)
    expect(recordItemStat).toHaveBeenCalledWith('a', { keys: 2, mistakes: 0, ms: 500 })
    expect(tr.cur).toBe('b')
    expect(tr.keys).toBe(1)
  })

  it('trackMiss は cur 無しでは無視し、cur 有りで加算する', () => {
    const tr = newTracker()
    trackMiss(tr) // cur=null → 無視
    expect(tr.mistakes).toBe(0)
    trackKey(tr, 'a')
    trackMiss(tr)
    trackMiss(tr)
    expect(tr.mistakes).toBe(2)
  })

  it('flushTracker は cur && keys>0 で recordItemStat を ms=max(0,last-start) で呼び、フィールドをリセットする', () => {
    const tr = newTracker()
    trackKey(tr, 'x') // start=0
    vi.advanceTimersByTime(1200)
    trackKey(tr, 'x') // last=1200
    trackMiss(tr)
    flushTracker(tr)
    expect(recordItemStat).toHaveBeenCalledWith('x', { keys: 2, mistakes: 1, ms: 1200 })
    expect(tr).toEqual({ cur: null, keys: 0, mistakes: 0, start: 0, last: 0 })
  })

  it('flushTracker は cur が無ければ記録しない', () => {
    const tr = newTracker()
    flushTracker(tr)
    expect(recordItemStat).not.toHaveBeenCalled()
  })

  it('flushTracker は keys=0 なら記録しない', () => {
    const tr = newTracker()
    tr.cur = 'a' // 打鍵なしで cur だけある状態
    flushTracker(tr)
    expect(recordItemStat).not.toHaveBeenCalled()
  })
})
