import { describe, it, expect } from 'vitest'
// #290 Phase 6: Specification の具体例。記録レコード {speed, accuracy, seconds, ...} を判定する
// 具体 Specification を makeSpec で組み立て、and/or/not で合成する。
// 分岐（速い/正確/長い）をドメインに閉じ込め、組み合わせ可能にする。
//
// 本体 src/domain/records/recordSpecs.specification.js は coder が Green で作る（現状未実装＝import で undefined）。
import {
  fasterThan,
  atLeastAccuracy,
  longerThan,
  isGreatRecord,
} from './recordSpecs.specification.js'

// 記録レコードのヘルパ（既存記録に倣った形）。
const rec = ({ speed = 0, accuracy = 100, seconds = 0 } = {}) => ({
  speed,
  accuracy,
  seconds,
})

describe('fasterThan（record.speed > minSpeed＝超過）', () => {
  it('speed が閾値を上回る記録は true', () => {
    expect(fasterThan(300).isSatisfiedBy(rec({ speed: 400 }))).toBe(true)
  })

  it('speed が閾値を下回る記録は false', () => {
    expect(fasterThan(300).isSatisfiedBy(rec({ speed: 200 }))).toBe(false)
  })

  it('境界：speed が閾値ちょうど（等値）は false（> なので超過が必要）', () => {
    expect(fasterThan(300).isSatisfiedBy(rec({ speed: 300 }))).toBe(false)
  })
})

describe('atLeastAccuracy（record.accuracy >= minPct＝以上）', () => {
  it('accuracy が閾値を上回る記録は true', () => {
    expect(atLeastAccuracy(95).isSatisfiedBy(rec({ accuracy: 98 }))).toBe(true)
  })

  it('accuracy が閾値を下回る記録は false', () => {
    expect(atLeastAccuracy(95).isSatisfiedBy(rec({ accuracy: 90 }))).toBe(false)
  })

  it('境界：accuracy が閾値ちょうど（等値）は true（>= なので以上でよい）', () => {
    expect(atLeastAccuracy(95).isSatisfiedBy(rec({ accuracy: 95 }))).toBe(true)
  })
})

describe('longerThan（record.seconds >= minSeconds＝以上）', () => {
  it('seconds が閾値を上回る記録は true', () => {
    expect(longerThan(60).isSatisfiedBy(rec({ seconds: 90 }))).toBe(true)
  })

  it('seconds が閾値を下回る記録は false', () => {
    expect(longerThan(60).isSatisfiedBy(rec({ seconds: 30 }))).toBe(false)
  })

  it('境界：seconds が閾値ちょうど（等値）は true（>= なので以上でよい）', () => {
    expect(longerThan(60).isSatisfiedBy(rec({ seconds: 60 }))).toBe(true)
  })
})

describe('isGreatRecord＝fasterThan(300).and(atLeastAccuracy(95))（速くて正確）', () => {
  it('speed>300 かつ accuracy>=95 の記録は true', () => {
    expect(isGreatRecord.isSatisfiedBy(rec({ speed: 400, accuracy: 98 }))).toBe(true)
  })

  it('speed が足りない記録は false（accuracy は満たしても片方欠けると偽）', () => {
    expect(isGreatRecord.isSatisfiedBy(rec({ speed: 200, accuracy: 98 }))).toBe(false)
  })

  it('accuracy が足りない記録は false（speed は満たしても片方欠けると偽）', () => {
    expect(isGreatRecord.isSatisfiedBy(rec({ speed: 400, accuracy: 90 }))).toBe(false)
  })

  it('両方欠ける記録は false', () => {
    expect(isGreatRecord.isSatisfiedBy(rec({ speed: 200, accuracy: 90 }))).toBe(false)
  })

  it('境界：speed=300（超過でない）かつ accuracy=95（以上）は false（speed が > を満たさない）', () => {
    expect(isGreatRecord.isSatisfiedBy(rec({ speed: 300, accuracy: 95 }))).toBe(false)
  })
})

describe('合成の柔軟さ（同じ部品を or/not で組み替える）', () => {
  it('fasterThan(300).or(atLeastAccuracy(99))：速いだけ（speed400/accuracy50）でも true', () => {
    const spec = fasterThan(300).or(atLeastAccuracy(99))
    expect(spec.isSatisfiedBy(rec({ speed: 400, accuracy: 50 }))).toBe(true)
  })

  it('fasterThan(300).or(atLeastAccuracy(99))：超正確なだけ（speed100/accuracy99）でも true', () => {
    const spec = fasterThan(300).or(atLeastAccuracy(99))
    expect(spec.isSatisfiedBy(rec({ speed: 100, accuracy: 99 }))).toBe(true)
  })

  it('fasterThan(300).or(atLeastAccuracy(99))：どちらも満たさない（speed100/accuracy90）は false', () => {
    const spec = fasterThan(300).or(atLeastAccuracy(99))
    expect(spec.isSatisfiedBy(rec({ speed: 100, accuracy: 90 }))).toBe(false)
  })

  it('atLeastAccuracy(95).not()：accuracy 未満（90）は true＝「正確でない記録」を表す', () => {
    expect(atLeastAccuracy(95).not().isSatisfiedBy(rec({ accuracy: 90 }))).toBe(true)
  })

  it('atLeastAccuracy(95).not()：accuracy 以上（98）は false', () => {
    expect(atLeastAccuracy(95).not().isSatisfiedBy(rec({ accuracy: 98 }))).toBe(false)
  })

  it('部品の再合成後も isGreatRecord は影響を受けない（元 spec 非破壊）', () => {
    fasterThan(300).or(atLeastAccuracy(99))
    expect(isGreatRecord.isSatisfiedBy(rec({ speed: 400, accuracy: 98 }))).toBe(true)
  })
})
