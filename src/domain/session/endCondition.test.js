import { describe, it, expect } from 'vitest'
// #208 段0: 終了判定の純粋関数（domain 純粋・決定的・副作用なし）
// 本体 src/domain/session/endCondition.js は coder が Green で作る。
import {
  shouldFinish,
  normalizeEndCondition,
  progressRatio,
  endLimitMs,
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

  // #208 段5: life は「ミスした問題数(missedItems)」で判定する（打鍵ミス総数 mistakes ではない）。
  // 同じ問題内で何回打鍵ミスしても、その問題のライフ消費は1（＝missedItems は問題単位で数える）。
  describe('life（missedItems >= value・問題単位）', () => {
    it('missedItems=value（ちょうど）で終了する', () => {
      const ec = { kind: 'life', value: 3 }
      expect(shouldFinish(ec, { missedItems: 3 })).toBe(true)
    })

    it('missedItems=value-1（直前）では終了しない', () => {
      const ec = { kind: 'life', value: 3 }
      expect(shouldFinish(ec, { missedItems: 2 })).toBe(false)
    })

    it('打鍵ミス総数(mistakes)が value 以上でも、missedItems が無ければ終了しない（問題単位で数える）', () => {
      const ec = { kind: 'life', value: 3 }
      // 1問の中で5回打鍵ミスしても、ミスした問題は1つ＝脱落しない。
      expect(shouldFinish(ec, { mistakes: 5 })).toBe(false)
    })

    it('missedItems 欠損は 0 扱いで終了しない', () => {
      const ec = { kind: 'life', value: 1 }
      expect(shouldFinish(ec, {})).toBe(false)
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

  it('life は missedItems/value（ミスした問題数基準・0.5）', () => {
    const ec = { kind: 'life', value: 4 }
    expect(progressRatio(ec, { missedItems: 2 })).toBeCloseTo(0.5, 5)
  })

  it('life は missedItems=value で 1 に達する', () => {
    const ec = { kind: 'life', value: 3 }
    expect(progressRatio(ec, { missedItems: 3 })).toBe(1)
  })

  it('life は missedItems=1・value=3 で 1/3', () => {
    const ec = { kind: 'life', value: 3 }
    expect(progressRatio(ec, { missedItems: 1 })).toBeCloseTo(1 / 3, 5)
  })

  it('life の missedItems 欠損は 0（打鍵ミス総数では進捗しない）', () => {
    const ec = { kind: 'life', value: 3 }
    expect(progressRatio(ec, { mistakes: 5 })).toBe(0)
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

  it('time の value<=0 もゼロ除算を避けて 0 を返す', () => {
    expect(progressRatio({ kind: 'time', value: 0 }, { elapsedMs: 5000 })).toBe(0)
  })

  it('items の value<=0 もゼロ除算を避けて 0 を返す', () => {
    expect(progressRatio({ kind: 'items', value: 0 }, { items: 5 })).toBe(0)
  })

  it('life の value<=0 もゼロ除算を避けて 0 を返す', () => {
    expect(progressRatio({ kind: 'life', value: 0 }, { missedItems: 5 })).toBe(0)
  })

  it('欠損フィールドは 0 扱いで進捗率 0', () => {
    const ec = { kind: 'time', value: 60 }
    expect(progressRatio(ec, {})).toBe(0)
  })
})

describe('endLimitMs（#208 段2・タイマー制限時間）', () => {
  it('null/undefined（既定 time60）は 60000ms', () => {
    expect(endLimitMs(null)).toBe(60000)
    expect(endLimitMs(undefined)).toBe(60000)
  })

  it('time は value 秒＝value*1000ms', () => {
    expect(endLimitMs({ kind: 'time', value: 30 })).toBe(30000)
    expect(endLimitMs({ kind: 'time', value: 120 })).toBe(120000)
  })

  it('非時間 kind（chars/items/life/endless）は時間で自動終了しないため Infinity を返す', () => {
    // 時間ではなく打鍵数/問題数/ミス数で終わるので、タイマー上限は無限大＝時間切れが起きない。
    expect(endLimitMs({ kind: 'chars', value: 600 })).toBe(Infinity)
    expect(endLimitMs({ kind: 'items', value: 20 })).toBe(Infinity)
    expect(endLimitMs({ kind: 'life', value: 3 })).toBe(Infinity)
    expect(endLimitMs({ kind: 'endless', value: null })).toBe(Infinity)
  })
})
