import { describe, it, expect } from 'vitest'
// #208 カバレッジ補填：content の終了条件ヘルパ（純粋関数）の特性化テスト。
// domain/session/endConditions.js の {kind,value} モデルに対応する分岐を網羅する。
import {
  END_TIME_VALUES,
  END_CHARS_VALUES,
  END_ITEMS_VALUES,
  END_KINDS,
  DEFAULT_END_CONDITION,
  endKind,
  timeEndCondition,
  charsEndCondition,
  endConditionForKind,
  endValueLabel,
  endConditionSummary,
  endHudStat,
} from './endConditions.js'

describe('定数', () => {
  it('END_TIME_VALUES は [30,60,120,180]', () => {
    expect(END_TIME_VALUES).toEqual([30, 60, 120, 180])
  })

  it('END_CHARS_VALUES は [300,600,1200]', () => {
    expect(END_CHARS_VALUES).toEqual([300, 600, 1200])
  })

  it('END_ITEMS_VALUES は [10,25,50]', () => {
    expect(END_ITEMS_VALUES).toEqual([10, 25, 50])
  })

  it('DEFAULT_END_CONDITION は { kind:"time", value:60 }', () => {
    expect(DEFAULT_END_CONDITION).toEqual({ kind: 'time', value: 60 })
  })

  it('END_KINDS は time/chars/items の3種別を表示順で持つ', () => {
    expect(END_KINDS.map((k) => k.kind)).toEqual(['time', 'chars', 'items'])
  })

  it('END_KINDS の各要素は label/unit/values/defaultValue を持つ', () => {
    expect(END_KINDS).toEqual([
      { kind: 'time', label: '時間', unit: '秒', values: END_TIME_VALUES, defaultValue: 60 },
      { kind: 'chars', label: '文字数', unit: '文字', values: END_CHARS_VALUES, defaultValue: 600 },
      { kind: 'items', label: '問題数', unit: '問', values: END_ITEMS_VALUES, defaultValue: 25 },
    ])
  })
})

describe('endKind', () => {
  it('time を引くと時間の種別定義を返す', () => {
    expect(endKind('time').kind).toBe('time')
    expect(endKind('time').unit).toBe('秒')
  })

  it('chars を引くと文字数の種別定義を返す', () => {
    expect(endKind('chars').kind).toBe('chars')
    expect(endKind('chars').unit).toBe('文字')
  })

  it('items を引くと問題数の種別定義を返す', () => {
    expect(endKind('items').kind).toBe('items')
    expect(endKind('items').unit).toBe('問')
  })

  it('未知の kind は先頭（time）にフォールバックする', () => {
    expect(endKind('life').kind).toBe('time')
    expect(endKind(undefined).kind).toBe('time')
  })
})

describe('timeEndCondition / charsEndCondition', () => {
  it('timeEndCondition は { kind:"time", value } を作る', () => {
    expect(timeEndCondition(120)).toEqual({ kind: 'time', value: 120 })
  })

  it('charsEndCondition は { kind:"chars", value } を作る', () => {
    expect(charsEndCondition(300)).toEqual({ kind: 'chars', value: 300 })
  })
})

describe('endConditionForKind（種別の既定値で終了条件を作る）', () => {
  it('time は { kind:"time", value:60 }', () => {
    expect(endConditionForKind('time')).toEqual({ kind: 'time', value: 60 })
  })

  it('chars は { kind:"chars", value:600 }', () => {
    expect(endConditionForKind('chars')).toEqual({ kind: 'chars', value: 600 })
  })

  it('items は { kind:"items", value:25 }', () => {
    expect(endConditionForKind('items')).toEqual({ kind: 'items', value: 25 })
  })

  it('未知の kind は time の既定にフォールバックする', () => {
    expect(endConditionForKind('unknown')).toEqual({ kind: 'time', value: 60 })
  })
})

describe('endValueLabel（値チップのラベル）', () => {
  it('time は "60秒"', () => {
    expect(endValueLabel('time', 60)).toBe('60秒')
  })

  it('chars は "600文字"', () => {
    expect(endValueLabel('chars', 600)).toBe('600文字')
  })

  it('items は "25問"', () => {
    expect(endValueLabel('items', 25)).toBe('25問')
  })

  it('未知の kind は time の単位（秒）を使う', () => {
    expect(endValueLabel('unknown', 42)).toBe('42秒')
  })
})

describe('endConditionSummary（説明文用サマリ）', () => {
  it('time は "◯秒で終了"', () => {
    expect(endConditionSummary({ kind: 'time', value: 60 })).toBe('60秒で終了')
  })

  it('chars は "◯文字打ったら終了"', () => {
    expect(endConditionSummary({ kind: 'chars', value: 600 })).toBe('600文字打ったら終了')
  })

  it('items は "◯問で終了"', () => {
    expect(endConditionSummary({ kind: 'items', value: 25 })).toBe('25問で終了')
  })

  it('null は既定（60秒で終了）に落とす', () => {
    expect(endConditionSummary(null)).toBe('60秒で終了')
  })

  it('kind 欠損は time、value 欠損は 60 に落とす', () => {
    expect(endConditionSummary({})).toBe('60秒で終了')
    expect(endConditionSummary({ kind: 'chars' })).toBe('60文字打ったら終了')
  })
})

describe('endHudStat（プレイ中HUDの終了条件スタット）', () => {
  it('time は label="時間"・value="経過/N秒"・progress=経過/制限', () => {
    const stat = endHudStat({ kind: 'time', value: 60 }, { elapsedSec: 30 })
    expect(stat.label).toBe('時間')
    expect(stat.value).toBe('30 / 60秒')
    expect(stat.progress).toBeCloseTo(0.5, 5)
  })

  it('chars は label="文字数"・value="打鍵/N文字"・progress=keys/value', () => {
    const stat = endHudStat({ kind: 'chars', value: 100 }, { keys: 50 })
    expect(stat.label).toBe('文字数')
    expect(stat.value).toBe('50 / 100文字')
    expect(stat.progress).toBeCloseTo(0.5, 5)
  })

  it('items は label="問題数"・value="完了/N問"・progress=items/value', () => {
    const stat = endHudStat({ kind: 'items', value: 20 }, { items: 10 })
    expect(stat.label).toBe('問題数')
    expect(stat.value).toBe('10 / 20問')
    expect(stat.progress).toBeCloseTo(0.5, 5)
  })

  it('未対応 kind（life）は素直に time 表示へフォールバックする', () => {
    const stat = endHudStat({ kind: 'life', value: 3 }, { elapsedSec: 30 })
    expect(stat.label).toBe('時間')
    // value は endCondition.value（3）が秒として表示される（フォールバック挙動の特性化）。
    expect(stat.value).toBe('30 / 3秒')
  })

  it('未対応 kind（endless）も time 表示へフォールバックする', () => {
    const stat = endHudStat({ kind: 'endless', value: null }, { elapsedSec: 10 })
    expect(stat.label).toBe('時間')
  })

  it('endCondition が null なら既定（time60）で扱う', () => {
    const stat = endHudStat(null, { elapsedSec: 30 })
    expect(stat.label).toBe('時間')
    expect(stat.value).toBe('30 / 60秒')
    expect(stat.progress).toBeCloseTo(0.5, 5)
  })

  it('progress 引数が未指定なら keys/items/elapsed は 0 扱い', () => {
    expect(endHudStat({ kind: 'time', value: 60 }).value).toBe('0 / 60秒')
    expect(endHudStat({ kind: 'chars', value: 600 }).value).toBe('0 / 600文字')
    expect(endHudStat({ kind: 'items', value: 25 }).value).toBe('0 / 25問')
  })

  it('progress の一部欠損フィールドは 0 として表示される', () => {
    const stat = endHudStat({ kind: 'chars', value: 100 }, {})
    expect(stat.value).toBe('0 / 100文字')
    expect(stat.progress).toBe(0)
  })
})
