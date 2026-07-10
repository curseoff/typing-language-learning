import { describe, it, expect } from 'vitest'
// #311 スライス: 進捗（Progress）を Value Object へ育てる（不変・自己検証・イミュータブル変換・値等価）。
// これまで {keys, mistakes, items, missedItems, elapsedMs} という生リテラルが層をまたいで流れ、
// 不変条件（非負整数・elapsedMs 非負有限・missedItems<=items）が誰にも守られていなかった。
// 本体 src/domain/session/progress.vo.js は coder が Green で実装する（現状未実装＝import で undefined）。
// 既存 VO（endCondition.vo.js / rankingBoard.vo.js）と同じ流儀：純ドメイン・React/DOM/Date/乱数 非依存・決定的。
import {
  makeProgress,
  isProgress,
  progressEquals,
} from './progress.vo.js'

describe('makeProgress（ファクトリ＋自己検証＋凍結）', () => {
  describe('生成と項目の公開', () => {
    it('引数なしは全項目 0 の妥当な Progress を返す', () => {
      const p = makeProgress()
      expect(p.keys).toBe(0)
      expect(p.mistakes).toBe(0)
      expect(p.items).toBe(0)
      expect(p.missedItems).toBe(0)
      expect(p.elapsedMs).toBe(0)
    })

    it('空オブジェクト {} でも全項目 0 になる（各項目は省略可・既定 0）', () => {
      const p = makeProgress({})
      expect(p.keys).toBe(0)
      expect(p.mistakes).toBe(0)
      expect(p.items).toBe(0)
      expect(p.missedItems).toBe(0)
      expect(p.elapsedMs).toBe(0)
    })

    it('妥当値を渡すと各項目をそのまま公開する', () => {
      const p = makeProgress({ keys: 12, mistakes: 3, items: 5, missedItems: 2, elapsedMs: 4200 })
      expect(p.keys).toBe(12)
      expect(p.mistakes).toBe(3)
      expect(p.items).toBe(5)
      expect(p.missedItems).toBe(2)
      expect(p.elapsedMs).toBe(4200)
    })

    it('一部だけ指定すると残りは既定 0 になる', () => {
      const p = makeProgress({ keys: 7 })
      expect(p.keys).toBe(7)
      expect(p.mistakes).toBe(0)
      expect(p.items).toBe(0)
      expect(p.missedItems).toBe(0)
      expect(p.elapsedMs).toBe(0)
    })

    it('elapsedMs は小数（非負の有限数）を許容する', () => {
      const p = makeProgress({ elapsedMs: 1234.5 })
      expect(p.elapsedMs).toBe(1234.5)
    })

    it('missedItems === items の境界（等しい）は妥当', () => {
      const p = makeProgress({ items: 3, missedItems: 3 })
      expect(p.items).toBe(3)
      expect(p.missedItems).toBe(3)
    })

    it('返り値は凍結オブジェクト（Object.isFrozen が true）', () => {
      const p = makeProgress({ keys: 1 })
      expect(Object.isFrozen(p)).toBe(true)
    })
  })

  describe('検証（違反は throw）: カウンタは非負整数', () => {
    for (const field of ['keys', 'mistakes', 'items', 'missedItems']) {
      it(`${field} が負数なら throw`, () => {
        expect(() => makeProgress({ [field]: -1 })).toThrow()
      })

      it(`${field} が非整数（1.5）なら throw`, () => {
        expect(() => makeProgress({ [field]: 1.5 })).toThrow()
      })

      it(`${field} が NaN なら throw`, () => {
        expect(() => makeProgress({ [field]: NaN })).toThrow()
      })

      it(`${field} が Infinity なら throw`, () => {
        expect(() => makeProgress({ [field]: Infinity })).toThrow()
      })

      it(`${field} が非数値（文字列）なら throw`, () => {
        expect(() => makeProgress({ [field]: '3' })).toThrow()
      })
    }
  })

  describe('検証（違反は throw）: elapsedMs は非負の有限数', () => {
    it('elapsedMs が負数なら throw', () => {
      expect(() => makeProgress({ elapsedMs: -1 })).toThrow()
    })

    it('elapsedMs が NaN なら throw', () => {
      expect(() => makeProgress({ elapsedMs: NaN })).toThrow()
    })

    it('elapsedMs が Infinity なら throw', () => {
      expect(() => makeProgress({ elapsedMs: Infinity })).toThrow()
    })

    it('elapsedMs が非数値（文字列）なら throw', () => {
      expect(() => makeProgress({ elapsedMs: '100' })).toThrow()
    })
  })

  describe('検証（違反は throw）: 不変条件 missedItems <= items', () => {
    it('missedItems > items なら throw', () => {
      expect(() => makeProgress({ items: 2, missedItems: 3 })).toThrow()
    })

    it('items 未指定（0）で missedItems=1 なら throw（0 を超える）', () => {
      expect(() => makeProgress({ missedItems: 1 })).toThrow()
    })
  })
})

describe('変換メソッド（イミュータブル: 元を変えず新しい凍結 Progress を返す）', () => {
  describe('withHit（keys+1）', () => {
    it('keys を 1 増やした新しい Progress を返す', () => {
      const p = makeProgress({ keys: 4 })
      expect(p.withHit().keys).toBe(5)
    })

    it('keys 以外は変えない', () => {
      const p = makeProgress({ keys: 4, mistakes: 2, items: 1, missedItems: 0, elapsedMs: 500 })
      const next = p.withHit()
      expect(next.mistakes).toBe(2)
      expect(next.items).toBe(1)
      expect(next.missedItems).toBe(0)
      expect(next.elapsedMs).toBe(500)
    })

    it('新しいインスタンスを返す（元とは別オブジェクト）', () => {
      const p = makeProgress({ keys: 4 })
      expect(p.withHit()).not.toBe(p)
    })

    it('元の Progress は不変（keys が変わらない）', () => {
      const p = makeProgress({ keys: 4 })
      p.withHit()
      expect(p.keys).toBe(4)
    })

    it('返り値も凍結されている', () => {
      const p = makeProgress({ keys: 4 })
      expect(Object.isFrozen(p.withHit())).toBe(true)
    })
  })

  describe('withMiss（mistakes+1）', () => {
    it('mistakes を 1 増やした新しい Progress を返す', () => {
      const p = makeProgress({ mistakes: 2 })
      expect(p.withMiss().mistakes).toBe(3)
    })

    it('元は不変・新インスタンス・凍結', () => {
      const p = makeProgress({ mistakes: 2 })
      const next = p.withMiss()
      expect(next).not.toBe(p)
      expect(p.mistakes).toBe(2)
      expect(Object.isFrozen(next)).toBe(true)
    })
  })

  describe('withItem（items+1／missed で missedItems+1）', () => {
    it('missed 省略（既定 false）は items のみ 1 増やす', () => {
      const p = makeProgress({ items: 1, missedItems: 0 })
      const next = p.withItem()
      expect(next.items).toBe(2)
      expect(next.missedItems).toBe(0)
    })

    it('missed=false は items のみ 1 増やす', () => {
      const p = makeProgress({ items: 1, missedItems: 0 })
      const next = p.withItem(false)
      expect(next.items).toBe(2)
      expect(next.missedItems).toBe(0)
    })

    it('missed=true は items と missedItems の両方を 1 増やす', () => {
      const p = makeProgress({ items: 1, missedItems: 0 })
      const next = p.withItem(true)
      expect(next.items).toBe(2)
      expect(next.missedItems).toBe(1)
    })

    it('missed=true でも不変条件 missedItems<=items は保たれる（境界: 消化と同数）', () => {
      const p = makeProgress({ items: 2, missedItems: 2 })
      const next = p.withItem(true)
      expect(next.items).toBe(3)
      expect(next.missedItems).toBe(3)
    })

    it('元は不変・新インスタンス・凍結', () => {
      const p = makeProgress({ items: 1, missedItems: 0 })
      const next = p.withItem(true)
      expect(next).not.toBe(p)
      expect(p.items).toBe(1)
      expect(p.missedItems).toBe(0)
      expect(Object.isFrozen(next)).toBe(true)
    })
  })

  describe('withElapsed（elapsedMs = ms・引数を検証）', () => {
    it('elapsedMs を渡した値に置き換えた新しい Progress を返す', () => {
      const p = makeProgress({ elapsedMs: 100 })
      expect(p.withElapsed(2500).elapsedMs).toBe(2500)
    })

    it('小数の ms を許容する', () => {
      const p = makeProgress()
      expect(p.withElapsed(1234.5).elapsedMs).toBe(1234.5)
    })

    it('elapsedMs 以外は変えない', () => {
      const p = makeProgress({ keys: 3, mistakes: 1, items: 2, missedItems: 1, elapsedMs: 100 })
      const next = p.withElapsed(9999)
      expect(next.keys).toBe(3)
      expect(next.mistakes).toBe(1)
      expect(next.items).toBe(2)
      expect(next.missedItems).toBe(1)
    })

    it('元は不変・新インスタンス・凍結', () => {
      const p = makeProgress({ elapsedMs: 100 })
      const next = p.withElapsed(2500)
      expect(next).not.toBe(p)
      expect(p.elapsedMs).toBe(100)
      expect(Object.isFrozen(next)).toBe(true)
    })

    it('負数の ms なら throw', () => {
      const p = makeProgress()
      expect(() => p.withElapsed(-1)).toThrow()
    })

    it('NaN の ms なら throw', () => {
      const p = makeProgress()
      expect(() => p.withElapsed(NaN)).toThrow()
    })

    it('Infinity の ms なら throw', () => {
      const p = makeProgress()
      expect(() => p.withElapsed(Infinity)).toThrow()
    })

    it('非数値の ms なら throw', () => {
      const p = makeProgress()
      expect(() => p.withElapsed('100')).toThrow()
    })
  })

  describe('純粋性（決定的・Date/乱数非依存）', () => {
    it('同じ入力から同じ結果を返す（連続呼び出しで一致）', () => {
      const p = makeProgress({ keys: 1, items: 1, missedItems: 1, elapsedMs: 10 })
      const a = p.withHit().withItem(true).withElapsed(20)
      const b = p.withHit().withItem(true).withElapsed(20)
      expect(progressEquals(a, b)).toBe(true)
    })
  })
})

describe('isProgress（型ガード・throw しない）', () => {
  it('妥当な Progress は true', () => {
    expect(isProgress(makeProgress({ keys: 1, items: 1, missedItems: 1, elapsedMs: 5 }))).toBe(true)
  })

  it('全 0 の Progress は true', () => {
    expect(isProgress(makeProgress())).toBe(true)
  })

  it('null は false', () => {
    expect(isProgress(null)).toBe(false)
  })

  it('undefined は false', () => {
    expect(isProgress(undefined)).toBe(false)
  })

  it('非オブジェクト（数値）は false', () => {
    expect(isProgress(42)).toBe(false)
  })

  it('非オブジェクト（文字列）は false', () => {
    expect(isProgress('progress')).toBe(false)
  })

  it('カウンタが負数の生オブジェクトは false', () => {
    expect(isProgress({ keys: -1, mistakes: 0, items: 0, missedItems: 0, elapsedMs: 0 })).toBe(false)
  })

  it('カウンタが非整数の生オブジェクトは false', () => {
    expect(isProgress({ keys: 1.5, mistakes: 0, items: 0, missedItems: 0, elapsedMs: 0 })).toBe(false)
  })

  it('elapsedMs が Infinity の生オブジェクトは false', () => {
    expect(isProgress({ keys: 0, mistakes: 0, items: 0, missedItems: 0, elapsedMs: Infinity })).toBe(false)
  })

  it('不変条件違反（missedItems>items）の生オブジェクトは false', () => {
    expect(isProgress({ keys: 0, mistakes: 0, items: 1, missedItems: 2, elapsedMs: 0 })).toBe(false)
  })
})

describe('progressEquals（値等価・throw しない）', () => {
  it('5 項目すべて一致すれば true', () => {
    const a = makeProgress({ keys: 1, mistakes: 2, items: 3, missedItems: 1, elapsedMs: 50 })
    const b = makeProgress({ keys: 1, mistakes: 2, items: 3, missedItems: 1, elapsedMs: 50 })
    expect(progressEquals(a, b)).toBe(true)
  })

  it('別インスタンスでも値が同じなら true（同一参照でなくてよい）', () => {
    const a = makeProgress({ keys: 1 })
    const b = makeProgress({ keys: 1 })
    expect(a).not.toBe(b)
    expect(progressEquals(a, b)).toBe(true)
  })

  it('keys が異なれば false', () => {
    const a = makeProgress({ keys: 1 })
    const b = makeProgress({ keys: 2 })
    expect(progressEquals(a, b)).toBe(false)
  })

  it('elapsedMs が異なれば false', () => {
    const a = makeProgress({ elapsedMs: 100 })
    const b = makeProgress({ elapsedMs: 200 })
    expect(progressEquals(a, b)).toBe(false)
  })

  it('missedItems が異なれば false', () => {
    const a = makeProgress({ items: 3, missedItems: 1 })
    const b = makeProgress({ items: 3, missedItems: 2 })
    expect(progressEquals(a, b)).toBe(false)
  })

  it('一方が null なら false', () => {
    expect(progressEquals(makeProgress(), null)).toBe(false)
    expect(progressEquals(null, makeProgress())).toBe(false)
  })

  it('両方 null なら false', () => {
    expect(progressEquals(null, null)).toBe(false)
  })

  it('一方が不正な生オブジェクト（不変条件違反）なら false', () => {
    const bad = { keys: 0, mistakes: 0, items: 1, missedItems: 2, elapsedMs: 0 }
    expect(progressEquals(makeProgress({ items: 2, missedItems: 1 }), bad)).toBe(false)
  })
})
