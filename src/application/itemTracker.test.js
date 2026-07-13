// itemTracker.policy.js の純関数版（now 注入・{next,emit} 返却・非破壊）の単体テスト。#355
// 方針A（純化）：performance.now を引数 now で受け、記録は emit（{id,delta}）で返し、tr は破壊しない。
// もう performance fake timer も recordItemStat モックも使わない（純関数＝IO/クロック非依存）。
import { describe, it, expect } from 'vitest'
import { newTracker, trackKey, trackMiss, flushTracker } from './itemTracker.policy.js'

// 初期状態（凍結）。全関数は {next, emit} を統一的に返す（呼び出し側は next で ref 更新・emit で記録）。
const INIT = { cur: null, keys: 0, mistakes: 0, start: 0, last: 0 }

describe('application/itemTracker（純関数版・now 注入/emit 返却/非破壊）', () => {
  it('newTracker は凍結された初期状態を返す', () => {
    const tr = newTracker()
    expect(tr).toEqual(INIT)
    expect(Object.isFrozen(tr)).toBe(true)
  })

  it('trackKey は同 id 連続で keys を加算し emit=null・元の tr を破壊しない', () => {
    const tr0 = newTracker()
    const r1 = trackKey(tr0, 'a', 0)
    expect(r1.emit).toBeNull()
    expect(r1.next.cur).toBe('a')
    expect(r1.next.keys).toBe(1)

    const r2 = trackKey(r1.next, 'a', 10)
    expect(r2.emit).toBeNull()
    expect(r2.next.keys).toBe(2)
    expect(r2.next.last).toBe(10)
    // 非破壊：切替元（r1.next）は変わらない
    expect(r1.next.keys).toBe(1)
    expect(Object.isFrozen(r2.next)).toBe(true)
  })

  it('trackKey は最初の打鍵（cur=null からの開始）では emit=null', () => {
    const { emit, next } = trackKey(newTracker(), 'a', 5)
    expect(emit).toBeNull()
    expect(next).toEqual({ cur: 'a', keys: 1, mistakes: 0, start: 5, last: 5 })
  })

  it('trackKey は id 変化で前問を emit（ms=last-start）して新 id を now で開始する', () => {
    const a1 = trackKey(newTracker(), 'a', 0) // start=0
    const a2 = trackKey(a1.next, 'a', 500) // last=500
    const b1 = trackKey(a2.next, 'b', 700) // id 変化 → 前(a)を emit・b を 700 で開始
    expect(b1.emit).toEqual({ id: 'a', delta: { keys: 2, mistakes: 0, ms: 500 } })
    expect(b1.next).toEqual({ cur: 'b', keys: 1, mistakes: 0, start: 700, last: 700 })
    // 非破壊：切替元（a2.next）は不変
    expect(a2.next).toEqual({ cur: 'a', keys: 2, mistakes: 0, start: 0, last: 500 })
  })

  it('trackMiss は cur 有りで mistakes+1・emit=null・非破壊', () => {
    const a = trackKey(newTracker(), 'a', 0)
    const m1 = trackMiss(a.next)
    expect(m1.emit).toBeNull()
    expect(m1.next.mistakes).toBe(1)
    // 非破壊：元は 0 のまま
    expect(a.next.mistakes).toBe(0)
    expect(Object.isFrozen(m1.next)).toBe(true)
  })

  it('trackMiss は cur 無しでは状態を変えない（emit=null・非破壊）', () => {
    const tr0 = newTracker()
    const m0 = trackMiss(tr0)
    expect(m0.emit).toBeNull()
    expect(m0.next).toEqual(INIT)
  })

  it('flushTracker は cur && keys>0 で emit（ms=max(0,last-start)）・next は初期化・非破壊', () => {
    const a1 = trackKey(newTracker(), 'x', 0) // start=0
    const a2 = trackKey(a1.next, 'x', 1200) // last=1200
    const m = trackMiss(a2.next) // mistakes=1
    const f = flushTracker(m.next)
    expect(f.emit).toEqual({ id: 'x', delta: { keys: 2, mistakes: 1, ms: 1200 } })
    expect(f.next).toEqual(INIT)
    // 非破壊：flush 元は不変
    expect(m.next).toEqual({ cur: 'x', keys: 2, mistakes: 1, start: 0, last: 1200 })
    expect(Object.isFrozen(f.next)).toBe(true)
  })

  it('flushTracker は ms が負にならないよう max(0, last-start) にする', () => {
    // last < start の異常入力でも ms=0（負にしない）。
    const f = flushTracker({ cur: 'x', keys: 1, mistakes: 0, start: 500, last: 100 })
    expect(f.emit).toEqual({ id: 'x', delta: { keys: 1, mistakes: 0, ms: 0 } })
  })

  it('flushTracker は cur が無ければ emit=null（next は初期状態）', () => {
    const f = flushTracker(newTracker())
    expect(f.emit).toBeNull()
    expect(f.next).toEqual(INIT)
  })

  it('flushTracker は keys=0（打鍵なし）なら emit=null', () => {
    const f = flushTracker({ cur: 'a', keys: 0, mistakes: 0, start: 0, last: 0 })
    expect(f.emit).toBeNull()
    expect(f.next).toEqual(INIT)
  })

  it('決定性：同じ (tr, id, now) で2回呼ぶと同じ {next, emit} を返す', () => {
    const mk = () => ({ cur: 'a', keys: 2, mistakes: 1, start: 0, last: 500 })
    expect(trackKey(mk(), 'b', 700)).toEqual(trackKey(mk(), 'b', 700))
    expect(flushTracker(mk())).toEqual(flushTracker(mk()))
    expect(trackMiss(mk())).toEqual(trackMiss(mk()))
  })
})
