import { describe, it, expect } from 'vitest'
// #208 段0: 終了判定の純粋関数（domain 純粋・決定的・副作用なし）
// 本体 src/domain/session/endCondition.js は coder が Green で作る。
import {
  shouldFinish,
  normalizeEndCondition,
  progressRatio,
} from './endCondition.js'

describe('shouldFinish', () => {
  describe('time（value は秒・elapsedMs はミリ秒）', () => {
    it('value=60・elapsedMs=60000（ちょうど）で終了する', () => {
      const ec = { kind: 'time', value: 60 }
      expect(shouldFinish(ec, { elapsedMs: 60000 })).toBe(true)
    })

    it('value=60・elapsedMs=59999（直前）では終了しない', () => {
      const ec = { kind: 'time', value: 60 }
      expect(shouldFinish(ec, { elapsedMs: 59999 })).toBe(false)
    })

    it('elapsedMs が value*1000 を超えても終了する', () => {
      const ec = { kind: 'time', value: 60 }
      expect(shouldFinish(ec, { elapsedMs: 60001 })).toBe(true)
    })
  })

  describe('chars（keys >= value）', () => {
    it('keys=value（ちょうど）で終了する', () => {
      const ec = { kind: 'chars', value: 100 }
      expect(shouldFinish(ec, { keys: 100 })).toBe(true)
    })

    it('keys=value-1（直前）では終了しない', () => {
      const ec = { kind: 'chars', value: 100 }
      expect(shouldFinish(ec, { keys: 99 })).toBe(false)
    })
  })

  describe('items（items >= value）', () => {
    it('items=value（ちょうど）で終了する', () => {
      const ec = { kind: 'items', value: 20 }
      expect(shouldFinish(ec, { items: 20 })).toBe(true)
    })

    it('items=value-1（直前）では終了しない', () => {
      const ec = { kind: 'items', value: 20 }
      expect(shouldFinish(ec, { items: 19 })).toBe(false)
    })
  })

  describe('life（mistakes >= value）', () => {
    it('mistakes=value（ちょうど）で終了する', () => {
      const ec = { kind: 'life', value: 3 }
      expect(shouldFinish(ec, { mistakes: 3 })).toBe(true)
    })

    it('mistakes=value-1（直前）では終了しない', () => {
      const ec = { kind: 'life', value: 3 }
      expect(shouldFinish(ec, { mistakes: 2 })).toBe(false)
    })
  })

  describe('endless', () => {
    it('進捗に関わらず常に終了しない', () => {
      const ec = { kind: 'endless', value: null }
      expect(shouldFinish(ec, { elapsedMs: 999999, keys: 9999, items: 9999, mistakes: 9999 })).toBe(false)
    })
  })

  describe('フェイルセーフ', () => {
    it('未知の kind は終了しない（勝手に終了させない）', () => {
      expect(shouldFinish({ kind: 'unknown', value: 1 }, { keys: 100 })).toBe(false)
    })

    it('欠損フィールドは 0 扱いで終了しない（time に空 progress）', () => {
      const ec = { kind: 'time', value: 60 }
      expect(shouldFinish(ec, {})).toBe(false)
    })

    it('欠損フィールドは 0 扱いで終了しない（chars に空 progress）', () => {
      const ec = { kind: 'chars', value: 100 }
      expect(shouldFinish(ec, {})).toBe(false)
    })
  })
})

describe('normalizeEndCondition', () => {
  it('null は既定 { kind:"time", value:60 } になる', () => {
    expect(normalizeEndCondition(null)).toEqual({ kind: 'time', value: 60 })
  })

  it('undefined は既定 { kind:"time", value:60 } になる', () => {
    expect(normalizeEndCondition(undefined)).toEqual({ kind: 'time', value: 60 })
  })

  it('妥当な入力は kind と value を保持する', () => {
    expect(normalizeEndCondition({ kind: 'chars', value: 200 })).toEqual({ kind: 'chars', value: 200 })
  })

  it('endless は value=null で整う', () => {
    expect(normalizeEndCondition({ kind: 'endless', value: null })).toEqual({ kind: 'endless', value: null })
  })
})

describe('progressRatio', () => {
  it('time は elapsedMs/(value*1000)（0.5）', () => {
    const ec = { kind: 'time', value: 60 }
    expect(progressRatio(ec, { elapsedMs: 30000 })).toBeCloseTo(0.5, 5)
  })

  it('chars は keys/value（0.5）', () => {
    const ec = { kind: 'chars', value: 100 }
    expect(progressRatio(ec, { keys: 50 })).toBeCloseTo(0.5, 5)
  })

  it('items は items/value（0.5）', () => {
    const ec = { kind: 'items', value: 20 }
    expect(progressRatio(ec, { items: 10 })).toBeCloseTo(0.5, 5)
  })

  it('life は mistakes/value（0.5）', () => {
    const ec = { kind: 'life', value: 4 }
    expect(progressRatio(ec, { mistakes: 2 })).toBeCloseTo(0.5, 5)
  })

  it('value を超えても 1 に clamp される', () => {
    const ec = { kind: 'chars', value: 100 }
    expect(progressRatio(ec, { keys: 150 })).toBe(1)
  })

  it('endless は進捗率の概念が無く 0 を返す', () => {
    const ec = { kind: 'endless', value: null }
    expect(progressRatio(ec, { elapsedMs: 999999, keys: 9999 })).toBe(0)
  })

  it('value<=0 はゼロ除算を避けて 0 を返す', () => {
    expect(progressRatio({ kind: 'chars', value: 0 }, { keys: 10 })).toBe(0)
  })

  it('欠損フィールドは 0 扱いで進捗率 0', () => {
    const ec = { kind: 'time', value: 60 }
    expect(progressRatio(ec, {})).toBe(0)
  })
})
