import { describe, it, expect } from 'vitest'
// #290 Phase 6: Specification パターン。
// 「この候補は条件を満たすか」という判定をオブジェクト化し、and/or/not で合成する。
// 分岐式をドメインに閉じ込め、条件を組み合わせ可能にする。
//
// 本体 src/domain/spec/specification.js は coder が Green で作る（現状未実装＝import で undefined）。
import { makeSpec } from './specification.js'

// テスト用の単純述語（決定的・純粋）。
const positive = makeSpec((n) => n > 0)
const even = makeSpec((n) => n % 2 === 0)
const big = makeSpec((n) => n >= 100)

describe('makeSpec / isSatisfiedBy（述語を Specification へ包む）', () => {
  it('predicate が true を返す候補で isSatisfiedBy が true になる', () => {
    expect(positive.isSatisfiedBy(5)).toBe(true)
  })

  it('predicate が false を返す候補で isSatisfiedBy が false になる', () => {
    expect(positive.isSatisfiedBy(-3)).toBe(false)
  })

  it('境界（n>0 で n=0）は false（predicate の比較がそのまま反映される）', () => {
    expect(positive.isSatisfiedBy(0)).toBe(false)
  })

  it('predicate は候補そのものを引数として受け取る', () => {
    let seen
    const spec = makeSpec((c) => {
      seen = c
      return true
    })
    const candidate = { tag: 'X' }
    spec.isSatisfiedBy(candidate)
    expect(seen).toBe(candidate)
  })
})

describe('and（両方満たすとき true＝論理積の真理値表）', () => {
  it('positive AND even：4 は両方満たす→true', () => {
    expect(positive.and(even).isSatisfiedBy(4)).toBe(true)
  })

  it('positive AND even：3 は even を満たさない→false', () => {
    expect(positive.and(even).isSatisfiedBy(3)).toBe(false)
  })

  it('positive AND even：-2 は positive を満たさない→false', () => {
    expect(positive.and(even).isSatisfiedBy(-2)).toBe(false)
  })

  it('positive AND even：-3 はどちらも満たさない→false', () => {
    expect(positive.and(even).isSatisfiedBy(-3)).toBe(false)
  })
})

describe('or（どちらか満たすとき true＝論理和の真理値表）', () => {
  it('positive OR even：3 は positive のみ満たす→true', () => {
    expect(positive.or(even).isSatisfiedBy(3)).toBe(true)
  })

  it('positive OR even：-2 は even のみ満たす→true', () => {
    expect(positive.or(even).isSatisfiedBy(-2)).toBe(true)
  })

  it('positive OR even：4 は両方満たす→true', () => {
    expect(positive.or(even).isSatisfiedBy(4)).toBe(true)
  })

  it('positive OR even：-3 はどちらも満たさない→false', () => {
    expect(positive.or(even).isSatisfiedBy(-3)).toBe(false)
  })
})

describe('not（否定＝論理否定の真理値表）', () => {
  it('NOT positive：-3 は元が false→否定で true', () => {
    expect(positive.not().isSatisfiedBy(-3)).toBe(true)
  })

  it('NOT positive：5 は元が true→否定で false', () => {
    expect(positive.not().isSatisfiedBy(5)).toBe(false)
  })

  it('二重否定 NOT NOT positive は元と同じ真理値', () => {
    expect(positive.not().not().isSatisfiedBy(5)).toBe(true)
    expect(positive.not().not().isSatisfiedBy(-5)).toBe(false)
  })
})

describe('合成チェーン（結合して複合条件を表す）', () => {
  it('positive.and(even).or(big)：150（奇数だが big）は true', () => {
    // 150 は even を満たすが、奇数の 101 でも big で true になることを別ケースで確認。
    expect(positive.and(even).or(big).isSatisfiedBy(150)).toBe(true)
  })

  it('positive.and(even).or(big)：101（positive だが奇数・かつ big）は big 側で true', () => {
    expect(positive.and(even).or(big).isSatisfiedBy(101)).toBe(true)
  })

  it('positive.and(even).or(big)：3（positive だが奇数・big でもない）は false', () => {
    expect(positive.and(even).or(big).isSatisfiedBy(3)).toBe(false)
  })

  it('positive.and(even.not())：3（positive かつ非even）は true', () => {
    expect(positive.and(even.not()).isSatisfiedBy(3)).toBe(true)
  })

  it('positive.and(even.not())：4（positive だが even）は false', () => {
    expect(positive.and(even.not()).isSatisfiedBy(4)).toBe(false)
  })
})

describe('合成は新しい Specification を返し、元は不変（非破壊）', () => {
  it('a.and(b) は a・b とは別オブジェクトを返す', () => {
    const combined = positive.and(even)
    expect(combined).not.toBe(positive)
    expect(combined).not.toBe(even)
  })

  it('a.and(b) 後も a 単体の判定は変わらない（a を壊さない）', () => {
    positive.and(even)
    expect(positive.isSatisfiedBy(3)).toBe(true)
    expect(positive.isSatisfiedBy(-3)).toBe(false)
  })

  it('a.and(b) 後も b 単体の判定は変わらない（b を壊さない）', () => {
    positive.and(even)
    expect(even.isSatisfiedBy(3)).toBe(false)
    expect(even.isSatisfiedBy(4)).toBe(true)
  })

  it('not() は元 spec を破壊せず新しい否定 spec を返す', () => {
    const negated = positive.not()
    expect(negated).not.toBe(positive)
    expect(positive.isSatisfiedBy(5)).toBe(true)
  })
})

describe('合成結果も Specification（さらに合成できる＝閉じている）', () => {
  it('and の結果に対してさらに not/or/and を呼べる', () => {
    const spec = positive.and(even)
    expect(typeof spec.and).toBe('function')
    expect(typeof spec.or).toBe('function')
    expect(typeof spec.not).toBe('function')
    expect(typeof spec.isSatisfiedBy).toBe('function')
  })
})
