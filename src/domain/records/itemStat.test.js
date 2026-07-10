import { describe, it, expect } from 'vitest'
// #314: 問題別の累積統計 `id → {count, keys, mistakes, ms}` を Entity `ItemStat` として表す。
// 累積ルール（count+1／各値加算）が application(memoryStore.policy.applyRecordItemStat) と
// infrastructure(itemStats.repository.recordItemStatDb の SQL upsert) に散っている。
// 本スライスでは domain の Entity にルールを一本化する（ここでは Entity 単体の新規作成のみ）。
//
// Entity らしさ（VO との対比を体現）：
//   - 同一性 id を持つ（値ではなく id で等価判定＝itemStatEquals）。
//   - 時間をまたぐ可変状態を「イミュータブル変換」で表す（recordAttempt は元を変えず新インスタンスを返す）。
//   - 自己検証（不変条件：非負整数・非負有限）を守り、凍結する。
//
// 本体 src/domain/records/itemStat.entity.js は coder が Green で作る（現状未実装＝import で落ちる）。
import { makeItemStat, isItemStat, itemStatEquals } from './itemStat.entity.js'

describe('makeItemStat（Entity の生成・自己検証）', () => {
  describe('id の検証（同一性＝非空文字列必須）', () => {
    it('id が欠落していると throw する', () => {
      expect(() => makeItemStat({})).toThrow()
    })

    it('空文字列の id は throw する', () => {
      expect(() => makeItemStat({ id: '' })).toThrow()
    })

    it('null の id は throw する', () => {
      expect(() => makeItemStat({ id: null })).toThrow()
    })

    it('非文字列（数値）の id は throw する', () => {
      expect(() => makeItemStat({ id: 123 })).toThrow()
    })
  })

  describe('初期状態（既定 0・公開・凍結）', () => {
    it('count/keys/mistakes/ms は省略時すべて 0', () => {
      const s = makeItemStat({ id: 'w:en:cat' })
      expect(s.count).toBe(0)
      expect(s.keys).toBe(0)
      expect(s.mistakes).toBe(0)
      expect(s.ms).toBe(0)
    })

    it('id と各値を公開する（妥当値をそのまま保持）', () => {
      const s = makeItemStat({ id: 'w:en:cat', count: 3, keys: 12, mistakes: 2, ms: 4500 })
      expect(s.id).toBe('w:en:cat')
      expect(s.count).toBe(3)
      expect(s.keys).toBe(12)
      expect(s.mistakes).toBe(2)
      expect(s.ms).toBe(4500)
    })

    it('返り値は凍結されている', () => {
      const s = makeItemStat({ id: 'w:en:cat' })
      expect(Object.isFrozen(s)).toBe(true)
    })
  })

  describe('count の検証（非負整数）', () => {
    it('負の count は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', count: -1 })).toThrow()
    })

    it('非整数（小数）の count は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', count: 1.5 })).toThrow()
    })

    it('NaN の count は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', count: NaN })).toThrow()
    })

    it('Infinity の count は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', count: Infinity })).toThrow()
    })

    it('非数値（文字列）の count は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', count: '3' })).toThrow()
    })
  })

  describe('keys の検証（非負整数）', () => {
    it('負の keys は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', keys: -1 })).toThrow()
    })

    it('非整数（小数）の keys は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', keys: 2.3 })).toThrow()
    })

    it('NaN の keys は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', keys: NaN })).toThrow()
    })

    it('Infinity の keys は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', keys: Infinity })).toThrow()
    })

    it('非数値（文字列）の keys は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', keys: '5' })).toThrow()
    })
  })

  describe('mistakes の検証（非負整数）', () => {
    it('負の mistakes は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', mistakes: -1 })).toThrow()
    })

    it('非整数（小数）の mistakes は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', mistakes: 0.5 })).toThrow()
    })

    it('NaN の mistakes は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', mistakes: NaN })).toThrow()
    })

    it('Infinity の mistakes は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', mistakes: Infinity })).toThrow()
    })

    it('非数値（文字列）の mistakes は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', mistakes: '2' })).toThrow()
    })
  })

  describe('ms の検証（非負の有限数・小数許容）', () => {
    it('負の ms は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', ms: -1 })).toThrow()
    })

    it('NaN の ms は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', ms: NaN })).toThrow()
    })

    it('Infinity の ms は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', ms: Infinity })).toThrow()
    })

    it('非数値（文字列）の ms は throw する', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', ms: '100' })).toThrow()
    })

    it('小数の ms は許容する（throw しない）', () => {
      expect(() => makeItemStat({ id: 'w:en:cat', ms: 1234.5 })).not.toThrow()
    })
  })
})

describe('recordAttempt（イミュータブルな累積＝Entity の状態変化を新インスタンスで表す）', () => {
  it('1回目の記録で count が 1・keys/mistakes/ms は delta 加算される', () => {
    const s0 = makeItemStat({ id: 'w:en:cat' })
    const s1 = s0.recordAttempt({ keys: 5, mistakes: 1, ms: 2000 })
    expect(s1.count).toBe(1)
    expect(s1.keys).toBe(5)
    expect(s1.mistakes).toBe(1)
    expect(s1.ms).toBe(2000)
  })

  it('2回目の記録で count/keys/mistakes/ms がさらに累積される', () => {
    const s0 = makeItemStat({ id: 'w:en:cat' })
    const s1 = s0.recordAttempt({ keys: 5, mistakes: 1, ms: 2000 })
    const s2 = s1.recordAttempt({ keys: 3, mistakes: 0, ms: 1500 })
    expect(s2.count).toBe(2)
    expect(s2.keys).toBe(8)
    expect(s2.mistakes).toBe(1)
    expect(s2.ms).toBe(3500)
  })

  it('id は不変（同じ問題の同一性を保つ）', () => {
    const s0 = makeItemStat({ id: 'w:en:cat' })
    const s1 = s0.recordAttempt({ keys: 5, mistakes: 1, ms: 2000 })
    expect(s1.id).toBe('w:en:cat')
  })

  it('元のインスタンスは変化しない（イミュータブル）', () => {
    const s0 = makeItemStat({ id: 'w:en:cat', count: 2, keys: 8, mistakes: 1, ms: 3500 })
    s0.recordAttempt({ keys: 4, mistakes: 2, ms: 900 })
    expect(s0.count).toBe(2)
    expect(s0.keys).toBe(8)
    expect(s0.mistakes).toBe(1)
    expect(s0.ms).toBe(3500)
  })

  it('返り値は元とは別の新インスタンス', () => {
    const s0 = makeItemStat({ id: 'w:en:cat' })
    const s1 = s0.recordAttempt({ keys: 5, mistakes: 1, ms: 2000 })
    expect(s1).not.toBe(s0)
  })

  it('返り値も凍結された ItemStat（isItemStat true・凍結）', () => {
    const s0 = makeItemStat({ id: 'w:en:cat' })
    const s1 = s0.recordAttempt({ keys: 5, mistakes: 1, ms: 2000 })
    expect(Object.isFrozen(s1)).toBe(true)
    expect(isItemStat(s1)).toBe(true)
  })

  describe('delta の検証（不正な delta は throw）', () => {
    it('負の keys delta は throw する', () => {
      const s0 = makeItemStat({ id: 'w:en:cat' })
      expect(() => s0.recordAttempt({ keys: -1, mistakes: 0, ms: 0 })).toThrow()
    })

    it('非整数の keys delta は throw する', () => {
      const s0 = makeItemStat({ id: 'w:en:cat' })
      expect(() => s0.recordAttempt({ keys: 1.5, mistakes: 0, ms: 0 })).toThrow()
    })

    it('負の mistakes delta は throw する', () => {
      const s0 = makeItemStat({ id: 'w:en:cat' })
      expect(() => s0.recordAttempt({ keys: 1, mistakes: -1, ms: 0 })).toThrow()
    })

    it('負の ms delta は throw する', () => {
      const s0 = makeItemStat({ id: 'w:en:cat' })
      expect(() => s0.recordAttempt({ keys: 1, mistakes: 0, ms: -1 })).toThrow()
    })

    it('Infinity の ms delta は throw する', () => {
      const s0 = makeItemStat({ id: 'w:en:cat' })
      expect(() => s0.recordAttempt({ keys: 1, mistakes: 0, ms: Infinity })).toThrow()
    })
  })
})

describe('isItemStat（throw しない型ガード）', () => {
  it('妥当な ItemStat は true', () => {
    const s = makeItemStat({ id: 'w:en:cat', count: 1, keys: 5, mistakes: 1, ms: 2000 })
    expect(isItemStat(s)).toBe(true)
  })

  it('妥当な形状の生オブジェクトも true（makeItemStat 経由でなくても値が妥当なら）', () => {
    expect(isItemStat({ id: 'w:en:cat', count: 0, keys: 0, mistakes: 0, ms: 0 })).toBe(true)
  })

  it('null は false', () => {
    expect(isItemStat(null)).toBe(false)
  })

  it('非オブジェクト（文字列）は false', () => {
    expect(isItemStat('w:en:cat')).toBe(false)
  })

  it('id が空文字列なら false', () => {
    expect(isItemStat({ id: '', count: 0, keys: 0, mistakes: 0, ms: 0 })).toBe(false)
  })

  it('id が非文字列なら false', () => {
    expect(isItemStat({ id: 1, count: 0, keys: 0, mistakes: 0, ms: 0 })).toBe(false)
  })

  it('count が負なら false', () => {
    expect(isItemStat({ id: 'w:en:cat', count: -1, keys: 0, mistakes: 0, ms: 0 })).toBe(false)
  })

  it('keys が非整数なら false', () => {
    expect(isItemStat({ id: 'w:en:cat', count: 0, keys: 1.5, mistakes: 0, ms: 0 })).toBe(false)
  })

  it('ms が Infinity なら false', () => {
    expect(isItemStat({ id: 'w:en:cat', count: 0, keys: 0, mistakes: 0, ms: Infinity })).toBe(false)
  })
})

describe('itemStatEquals（同一性＝ID 等価・VO の値等価との対照）', () => {
  it('同じ id なら count 等の値が違っても等しい（Entity は状態が変わっても同じ実体）', () => {
    const a = makeItemStat({ id: 'w:en:cat', count: 1, keys: 5, mistakes: 1, ms: 2000 })
    const b = makeItemStat({ id: 'w:en:cat', count: 9, keys: 99, mistakes: 3, ms: 8888 })
    expect(itemStatEquals(a, b)).toBe(true)
  })

  it('違う id なら値がすべて同じでも等しくない（値等価ではない）', () => {
    const a = makeItemStat({ id: 'w:en:cat', count: 1, keys: 5, mistakes: 1, ms: 2000 })
    const b = makeItemStat({ id: 'w:en:dog', count: 1, keys: 5, mistakes: 1, ms: 2000 })
    expect(itemStatEquals(a, b)).toBe(false)
  })

  it('自分自身とは等しい', () => {
    const a = makeItemStat({ id: 'w:en:cat' })
    expect(itemStatEquals(a, a)).toBe(true)
  })

  it('一方が null なら throw せず false', () => {
    const a = makeItemStat({ id: 'w:en:cat' })
    expect(itemStatEquals(a, null)).toBe(false)
    expect(itemStatEquals(null, a)).toBe(false)
  })

  it('両方 null / 空オブジェクトでも throw せず false', () => {
    expect(itemStatEquals(null, null)).toBe(false)
    expect(itemStatEquals({}, {})).toBe(false)
  })
})
