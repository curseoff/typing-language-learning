// @vitest-environment jsdom
// 英英入力モードの結合テスト。canonical を打鍵してから60秒経過をシミュレートして finish させ、
// record と segStats を確認する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDict } from './useDict.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.js'
import { DICT } from '../content/dictionaryAll.js'
import { loadDictRecords, dictRecKey } from '../infrastructure/dictRepository.js'

beforeEach(() => {
  localStorage.clear()
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

// n 文字ぶん現在セグの canonical を打つ（時間制なので完走はしない）。打鍵間に少し時間を進める。
const typeSome = (h, n, onSeg) => {
  for (let i = 0; i < n; i++) {
    const seg = h.result.current.segments[h.result.current.segIndex]
    if (!seg) break
    if (onSeg && h.result.current.segInput.length === 0) onSeg(seg)
    typeKey(seg.canonical[h.result.current.segInput.length])
    act(() => vi.advanceTimersByTime(10))
  }
}

describe('useDict（英英入力・60秒・結合）', () => {
  it('日本語入力モードで打鍵後、60秒で finish し record と segStats を保存する', () => {
    const h = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'ja', onExit: () => {} }),
    )
    typeSome(h, 80)
    runOutClock()
    expect(h.result.current.finished).toBe(true)
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')][0]
    expect(rec.source).toBe('dict')
    expect(rec.mode).toBe('ja')
    expect(rec.keys).toBeGreaterThan(0)
    expect(rec.mistakes).toBe(0)
    expect(rec.speed).toBeGreaterThan(0)
    expect(rec.seconds).toBeCloseTo(60, 0)
    expect(rec.segStats.length).toBeGreaterThan(0)
    // words = 打ち終えた文の数（sentenceIndex のユニーク数と一致）
    expect(rec.words).toBe(new Set(rec.segStats.map((s) => s.sentenceIndex)).size)
  }, 20000)

  it('英語・日本語(both)モードで1文を en→ja の順に打って60秒で完走する', () => {
    const h = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'both', onExit: () => {} }),
    )
    // 各文の先頭セグは en、2つ目は ja。打ち進めると en→ja→次の文の en … と切り替わる。
    const types = []
    typeSome(h, 200, (seg) => types.push(seg.type))
    runOutClock()
    expect(h.result.current.finished).toBe(true)
    // セグ列は en,ja,en,ja,… の繰り返し
    expect(types.slice(0, 4)).toEqual(['en', 'ja', 'en', 'ja'])
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'both')][0]
    expect(rec.mistakes).toBe(0)
    expect(rec.segStats.map((s) => s.type).slice(0, 2)).toEqual(['en', 'ja'])
    // both は1文につき en/ja の2件を segStats に積む
    expect(rec.segStats.length).toBeGreaterThanOrEqual(rec.words)
    expect(rec.words).toBe(new Set(rec.segStats.map((s) => s.sentenceIndex)).size)
  }, 20000)

  it('通常プレイ（seed 未指定）でも record に有効な seed が入る＝記録から再挑戦できる', () => {
    const h = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'ja', onExit: () => {} }),
    )
    typeSome(h, 40)
    runOutClock()
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')][0]
    expect(rec.seed).toEqual(expect.any(Number))
    expect(rec.source).toBe('dict')
  }, 20000)

  it('restart は新しい seed を切り直して別の問題列にする', () => {
    const h = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'ja', onExit: () => {} }),
    )
    typeSome(h, 40)
    runOutClock()
    const first = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')][0].seed
    act(() => h.result.current.restart())
    typeSome(h, 40)
    runOutClock()
    const seeds = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')].map((r) => r.seed)
    expect(seeds).toContain(first)
    expect(new Set(seeds).size).toBe(2)
  }, 20000)

  it('同じ seed なら同一の問題列を再現する（リプレイ＝記録 seed で復元）', () => {
    const seed = 135790
    const opts = { dict: DICT, level: 1, theme: 'すべて', mode: 'ja', seed, onExit: () => {} }
    const a = renderHook(() => useDict(opts))
    typeSome(a, 40)
    runOutClock()
    const recA = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')][0]
    const b = renderHook(() => useDict(opts))
    typeSome(b, 40)
    runOutClock()
    const recs = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')]
    // 同じ seed・同じ打鍵数なら最初の数語の出題ラベルが一致する
    const labelsB = recs.find((r) => r !== recA)?.segStats.map((s) => s.label) ?? []
    const labelsA = recA.segStats.map((s) => s.label)
    expect(labelsB.slice(0, 5)).toEqual(labelsA.slice(0, 5))
    expect(recA.seed).toBe(seed)
  }, 20000)
})
