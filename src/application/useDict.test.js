// @vitest-environment jsdom
// 英英入力モードの結合テスト。canonical を打鍵して 600打で完走させ record と segStats を確認する。
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDict } from './useDict.js'
import { TARGET_KEYS } from '../domain/marathon/passage.js'
import { DICT } from '../content/dictionaryAll.js'
import { loadDictRecords, dictRecKey } from '../infrastructure/dictRepository.js'

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

// 現在セグの canonical を1文字ずつ打って 600打到達まで進める。
const drain = (h) => {
  let n = 0
  while (!h.result.current.finished && n < 5000) {
    const seg = h.result.current.segments[h.result.current.segIndex]
    if (!seg) break
    typeKey(seg.canonical[h.result.current.segInput.length])
    n++
  }
}

describe('useDict（英英入力・600打マラソン・結合）', () => {
  beforeEach(() => localStorage.clear())

  it('日本語入力モードで600打到達して finish し record と segStats を保存する', () => {
    const h = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'ja', onExit: () => {} }),
    )
    drain(h)
    expect(h.result.current.finished).toBe(true)
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')][0]
    expect(rec.source).toBe('dict')
    expect(rec.mode).toBe('ja')
    expect(rec.keys).toBeGreaterThanOrEqual(TARGET_KEYS)
    expect(rec.mistakes).toBe(0)
    expect(rec.speed).toBeGreaterThan(0)
    expect(rec.segStats.length).toBeGreaterThan(0)
    // words = 打ち終えた文の数（sentenceIndex のユニーク数と一致）
    expect(rec.words).toBe(new Set(rec.segStats.map((s) => s.sentenceIndex)).size)
  }, 20000)

  it('英語・日本語(both)モードで1文を en→ja の順に打って 600打で完走する', () => {
    const h = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'both', onExit: () => {} }),
    )
    // 各文の先頭セグは en、2つ目は ja。打ち進めると en→ja→次の文の en … と切り替わる。
    const types = []
    let n = 0
    while (!h.result.current.finished && n < 5000) {
      const seg = h.result.current.segments[h.result.current.segIndex]
      if (!seg) break
      if (h.result.current.segInput.length === 0) types.push(seg.type)
      typeKey(seg.canonical[h.result.current.segInput.length])
      n++
    }
    expect(h.result.current.finished).toBe(true)
    // セグ列は en,ja,en,ja,… の繰り返し
    expect(types.slice(0, 4)).toEqual(['en', 'ja', 'en', 'ja'])
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'both')][0]
    expect(rec.mistakes).toBe(0)
    expect(rec.segStats.map((s) => s.type).slice(0, 2)).toEqual(['en', 'ja'])
    // both は1文につき en/ja の2件を segStats に積む（端数を除けば words*2 前後）
    expect(rec.segStats.length).toBeGreaterThanOrEqual(rec.words)
    expect(rec.words).toBe(new Set(rec.segStats.map((s) => s.sentenceIndex)).size)
  }, 20000)

  it('通常プレイ（seed 未指定）でも record に有効な seed が入る＝記録から再挑戦できる', () => {
    const h = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'ja', onExit: () => {} }),
    )
    drain(h)
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')][0]
    expect(rec.seed).toEqual(expect.any(Number))
    expect(rec.source).toBe('dict')
  }, 20000)

  it('restart は新しい seed を切り直して別の問題列にする', () => {
    const h = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'ja', onExit: () => {} }),
    )
    drain(h)
    const first = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')][0].seed
    act(() => h.result.current.restart())
    drain(h)
    const seeds = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')].map((r) => r.seed)
    expect(seeds).toContain(first)
    expect(new Set(seeds).size).toBe(2)
  }, 20000)

  it('同じ seed なら同一の問題列を再現する（リプレイ＝記録 seed で復元）', () => {
    const seed = 135790
    const opts = { dict: DICT, level: 1, theme: 'すべて', mode: 'ja', seed, onExit: () => {} }
    const a = renderHook(() => useDict(opts))
    drain(a)
    const recA = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')][0]
    const b = renderHook(() => useDict(opts))
    drain(b)
    const recs = loadDictRecords()[dictRecKey(1, 'すべて', 'ja')]
    const labelsB = recs[0].segStats.map((s) => s.label) // 最新（b）の列
    const labelsA = recA.segStats.map((s) => s.label)
    expect(labelsB).toEqual(labelsA)
    expect(recs[0].seed).toBe(seed)
  }, 20000)
})
