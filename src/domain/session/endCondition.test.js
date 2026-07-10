import { describe, it, expect } from 'vitest'
// #208 段0: 終了判定の純粋関数（domain 純粋・決定的・副作用なし）
// 本体 src/domain/session/endCondition.js は coder が Green で作る。
import {
  shouldFinish,
  normalizeEndCondition,
  progressRatio,
  endLimitMs,
  // #290 Phase 1: endCondition を Value Object へ育てる（不変・自己検証・値等価・生成の一元化）。
  // 以下 3 つは coder が Green で実装する（現状未実装＝import で undefined）。
  makeEndCondition,
  isEndCondition,
  endConditionEquals,
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

// #290 Phase 1: endCondition を Value Object へ育てる。
// ---- makeEndCondition：ファクトリ＋自己検証＋不変（凍結） ----
describe('makeEndCondition（#290 Phase1・ファクトリ/自己検証/凍結）', () => {
  describe('正常系', () => {
    it('time の VO は { kind:"time", value:60 } 相当の値を持つ', () => {
      const ec = makeEndCondition('time', 60)
      expect(ec.kind).toBe('time')
      expect(ec.value).toBe(60)
    })

    it('生成された VO は凍結されている（不変）', () => {
      const ec = makeEndCondition('time', 60)
      expect(Object.isFrozen(ec)).toBe(true)
    })

    it('凍結ゆえ value を書き換えても変化しない', () => {
      const ec = makeEndCondition('chars', 100)
      // strict モードでは throw、非 strict では黙って無視される。どちらでも値は不変であること。
      try {
        ec.value = 999
      } catch {
        // 凍結オブジェクトへの代入は TypeError になり得る（許容）。
      }
      expect(ec.value).toBe(100)
    })

    it('counted 系（chars/items/life）も正の値で生成できる', () => {
      expect(makeEndCondition('chars', 600).value).toBe(600)
      expect(makeEndCondition('items', 20).value).toBe(20)
      expect(makeEndCondition('life', 3).value).toBe(3)
    })

    it('endless は value を無視して null になり、凍結される', () => {
      const ec = makeEndCondition('endless', 999)
      expect(ec.kind).toBe('endless')
      expect(ec.value).toBe(null)
      expect(Object.isFrozen(ec)).toBe(true)
    })

    it('endless は value 未指定でも null になる', () => {
      const ec = makeEndCondition('endless')
      expect(ec.kind).toBe('endless')
      expect(ec.value).toBe(null)
    })

    it('同一入力からは値等価な VO を生成する（参照は別でよい）', () => {
      const a = makeEndCondition('time', 60)
      const b = makeEndCondition('time', 60)
      expect(a).not.toBe(b)
      expect(endConditionEquals(a, b)).toBe(true)
    })
  })

  describe('不変条件違反は throw する（自己検証）', () => {
    it('未知 kind は throw する', () => {
      expect(() => makeEndCondition('bogus', 1)).toThrow()
    })

    it('counted 系で value=0 は throw する（正の数が必須）', () => {
      expect(() => makeEndCondition('time', 0)).toThrow()
    })

    it('counted 系で value が負は throw する', () => {
      expect(() => makeEndCondition('chars', -1)).toThrow()
    })

    it('counted 系で value=NaN は throw する', () => {
      expect(() => makeEndCondition('items', NaN)).toThrow()
    })

    it('counted 系で value=Infinity は throw する（有限が必須）', () => {
      expect(() => makeEndCondition('life', Infinity)).toThrow()
    })

    it('counted 系で value=undefined は throw する', () => {
      expect(() => makeEndCondition('time', undefined)).toThrow()
    })

    it('counted 系で value が非数（文字列）は throw する', () => {
      expect(() => makeEndCondition('time', '60')).toThrow()
    })
  })
})

// ---- isEndCondition：型ガード（値の妥当性で判定） ----
describe('isEndCondition（#290 Phase1・型ガード）', () => {
  it('makeEndCondition の戻り値は true', () => {
    expect(isEndCondition(makeEndCondition('time', 60))).toBe(true)
  })

  it('妥当な形の plain object（counted）も true', () => {
    expect(isEndCondition({ kind: 'time', value: 60 })).toBe(true)
    expect(isEndCondition({ kind: 'chars', value: 600 })).toBe(true)
  })

  it('妥当な endless の plain object（value:null）も true', () => {
    expect(isEndCondition({ kind: 'endless', value: null })).toBe(true)
  })

  it('value 欠落は false', () => {
    expect(isEndCondition({ kind: 'time' })).toBe(false)
  })

  it('未知 kind は false', () => {
    expect(isEndCondition({ kind: 'x', value: 1 })).toBe(false)
  })

  it('counted 系で value が負は false', () => {
    expect(isEndCondition({ kind: 'time', value: -1 })).toBe(false)
  })

  it('counted 系で value=0 は false', () => {
    expect(isEndCondition({ kind: 'chars', value: 0 })).toBe(false)
  })

  it('null は false', () => {
    expect(isEndCondition(null)).toBe(false)
  })

  it('非オブジェクト（数値・文字列）は false', () => {
    expect(isEndCondition(60)).toBe(false)
    expect(isEndCondition('time')).toBe(false)
    expect(isEndCondition(undefined)).toBe(false)
  })
})

// ---- endConditionEquals：値等価（throw しない） ----
describe('endConditionEquals（#290 Phase1・値等価）', () => {
  it('同 kind・同 value は true（VO 同士）', () => {
    expect(endConditionEquals(makeEndCondition('time', 60), makeEndCondition('time', 60))).toBe(true)
  })

  it('同 kind・同 value は true（plain object 同士）', () => {
    expect(endConditionEquals({ kind: 'chars', value: 600 }, { kind: 'chars', value: 600 })).toBe(true)
  })

  it('kind 違いは false', () => {
    expect(endConditionEquals({ kind: 'time', value: 60 }, { kind: 'chars', value: 60 })).toBe(false)
  })

  it('value 違いは false', () => {
    expect(endConditionEquals({ kind: 'time', value: 60 }, { kind: 'time', value: 30 })).toBe(false)
  })

  it('endless 同士（value:null）は true', () => {
    expect(endConditionEquals({ kind: 'endless', value: null }, makeEndCondition('endless'))).toBe(true)
  })

  it('一方が null でも throw せず false を返す', () => {
    expect(endConditionEquals(makeEndCondition('time', 60), null)).toBe(false)
    expect(endConditionEquals(null, makeEndCondition('time', 60))).toBe(false)
  })

  it('一方が不正（未知 kind）でも throw せず false を返す', () => {
    expect(endConditionEquals({ kind: 'x', value: 1 }, { kind: 'time', value: 60 })).toBe(false)
  })
})

// ---- normalizeEndCondition：未信頼入力の入口アダプタ（常に妥当な凍結 VO・throw しない） ----
describe('normalizeEndCondition（#290 Phase1・凍結/寛容フォールバックの強化）', () => {
  it('null は既定 time,60 と値等価', () => {
    expect(endConditionEquals(normalizeEndCondition(null), makeEndCondition('time', 60))).toBe(true)
  })

  it('null の戻り値は isEndCondition true・凍結されている', () => {
    const ec = normalizeEndCondition(null)
    expect(isEndCondition(ec)).toBe(true)
    expect(Object.isFrozen(ec)).toBe(true)
  })

  it('妥当な {chars,600} はその VO と値等価・凍結', () => {
    const ec = normalizeEndCondition({ kind: 'chars', value: 600 })
    expect(endConditionEquals(ec, makeEndCondition('chars', 600))).toBe(true)
    expect(Object.isFrozen(ec)).toBe(true)
  })

  it('endless は value=null の妥当 VO・凍結', () => {
    const ec = normalizeEndCondition({ kind: 'endless', value: null })
    expect(ec.kind).toBe('endless')
    expect(ec.value).toBe(null)
    expect(Object.isFrozen(ec)).toBe(true)
  })

  it('不正な value（負）でも throw せず妥当な凍結 VO へフォールバックする', () => {
    const ec = normalizeEndCondition({ kind: 'time', value: -1 })
    expect(isEndCondition(ec)).toBe(true)
    expect(Object.isFrozen(ec)).toBe(true)
  })

  it('未知 kind でも throw せず妥当な凍結 VO へフォールバックする', () => {
    const ec = normalizeEndCondition({ kind: 'bogus', value: 1 })
    expect(isEndCondition(ec)).toBe(true)
    expect(Object.isFrozen(ec)).toBe(true)
  })
})

// ---- 既存の判定関数が VO を受けても現状どおり動く（非退行の明示固定） ----
describe('判定関数は VO を受けても現状どおり（#290 Phase1・非退行）', () => {
  it('shouldFinish(make(time,60), {elapsedMs:60000}) は true', () => {
    expect(shouldFinish(makeEndCondition('time', 60), { elapsedMs: 60000 })).toBe(true)
  })

  it('endLimitMs(make(chars,600)) は Infinity', () => {
    expect(endLimitMs(makeEndCondition('chars', 600))).toBe(Infinity)
  })

  it('progressRatio(make(time,60), {elapsedMs:30000}) は 0.5', () => {
    expect(progressRatio(makeEndCondition('time', 60), { elapsedMs: 30000 })).toBeCloseTo(0.5, 5)
  })
})
