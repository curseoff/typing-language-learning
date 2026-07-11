// 既存の Specification（.specification.js）を共通契約（assertSpecification）に載せるメタテスト。#328。
// Specification は「候補が条件を満たすか」を述語オブジェクトとして表し、and/or/not で
// 合成しても同じインターフェースを保つ（閉じた合成）＝分岐をドメインに閉じ込め再利用可能にする。
// ファイル名は .test.js ＝命名メタテスト（.specification.js サフィックス強制）の対象外。純粋・jsdom 不要。
import { describe, it, expect } from 'vitest'
import { assertSpecification } from '../test/contracts/specification.js'
import { makeSpec } from './spec/combinators.specification.js'
import {
  fasterThan,
  atLeastAccuracy,
  longerThan,
  isGreatRecord,
} from './records/recordSpecs.specification.js'

// combinators：generic な makeSpec が Specification 契約（真理値表・閉包・非破壊）を満たす。
describe('Specification契約: makeSpec', () => assertSpecification({ makeSpec }))

// recordSpecs：具体 spec が well-formed（and/or/not/isSatisfiedBy を持つ）で、述語の意味（境界・演算子）が仕様どおり。
describe('Specification: recordSpecs の述語意味', () => {
  const isSpec = (s) =>
    s && ['isSatisfiedBy', 'and', 'or', 'not'].every((m) => typeof s[m] === 'function')

  it('各 spec は well-formed Specification（合成メソッドを備える）', () => {
    expect(isSpec(fasterThan(300))).toBe(true)
    expect(isSpec(atLeastAccuracy(95))).toBe(true)
    expect(isSpec(longerThan(60))).toBe(true)
  })

  it('fasterThan は速度が超過（厳密 >）のとき満たす', () => {
    expect(fasterThan(300).isSatisfiedBy({ speed: 301 })).toBe(true)
    expect(fasterThan(300).isSatisfiedBy({ speed: 300 })).toBe(false) // 同値は満たさない
  })

  it('atLeastAccuracy は精度が下限以上（>=）のとき満たす', () => {
    expect(atLeastAccuracy(95).isSatisfiedBy({ accuracy: 95 })).toBe(true) // 同値は満たす
    expect(atLeastAccuracy(95).isSatisfiedBy({ accuracy: 94 })).toBe(false)
  })

  it('longerThan は秒数が下限以上（>=）のとき満たす', () => {
    expect(longerThan(60).isSatisfiedBy({ seconds: 60 })).toBe(true) // 同値は満たす
    expect(longerThan(60).isSatisfiedBy({ seconds: 59 })).toBe(false)
  })

  it('isGreatRecord は speed>300 かつ accuracy>=95 の合成 and を意味する', () => {
    expect(isGreatRecord.isSatisfiedBy({ speed: 400, accuracy: 96 })).toBe(true)
    expect(isGreatRecord.isSatisfiedBy({ speed: 301, accuracy: 94 })).toBe(false) // accuracy 不足
    expect(isGreatRecord.isSatisfiedBy({ speed: 300, accuracy: 99 })).toBe(false) // speed 同値で不足
  })
})
