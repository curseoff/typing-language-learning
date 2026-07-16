import { describe, it, expect } from 'vitest'
// #432 P2P 穴埋め対戦：対戦設定（MatchConfig）の Value Object。
// 本体 src/domain/versus/matchConfig.vo.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// makeMatchConfig(input)   … trusted builder。妥当なら凍結した正規化オブジェクトを返し、不正は throw。
// parseMatchConfig(obj)    … untrusted 入力（ワイヤ由来）。どんな入力でも throw せず、妥当なら正規化・不正なら null。
// matchConfigEquals(a, b)  … 両者が妥当な MatchConfig で全フィールド一致なら true（throw しない）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。endCondition は endCondition.vo.js を土台にする。
import { makeMatchConfig, parseMatchConfig, matchConfigEquals } from './matchConfig.vo.js'
import { makeEndCondition } from '../session/endCondition.vo.js'

// 妥当な入力の雛形（各テストで一部だけ差し替える）。
function validInput(overrides = {}) {
  return {
    gameType: 'wsent',
    level: 3,
    theme: '日常',
    range: null,
    mode: 'both',
    endCondition: makeEndCondition('chars', 60),
    learningMode: 'cloze',
    ...overrides,
  }
}

// ワイヤ由来（parse 用）の雛形＝endCondition は {kind,value} のプレーン形。
function validWire(overrides = {}) {
  return {
    gameType: 'wsent',
    level: 3,
    theme: '日常',
    range: null,
    mode: 'both',
    endCondition: { kind: 'chars', value: 60 },
    learningMode: 'cloze',
    ...overrides,
  }
}

// ---- makeMatchConfig：正常系（正規化した凍結オブジェクトを返す） ----
describe('makeMatchConfig：正常系（正規化・凍結して返す）', () => {
  it('妥当な入力から規定フィールドのみの正規化オブジェクトを返す', () => {
    const c = makeMatchConfig(validInput())
    expect(c).toMatchObject({
      gameType: 'wsent',
      level: 3,
      theme: '日常',
      range: null,
      mode: 'both',
      learningMode: 'cloze',
    })
    expect(c.endCondition).toMatchObject({ kind: 'chars', value: 60 })
  })

  it('返り値は Object.freeze で凍結されている', () => {
    const c = makeMatchConfig(validInput())
    expect(Object.isFrozen(c)).toBe(true)
  })

  it('入力の余計なフィールドは落とす（規定フィールドのみ保持）', () => {
    const c = makeMatchConfig(validInput({ extra: 'x', __proto__hack: 1 }))
    expect(c).not.toHaveProperty('extra')
    expect(Object.keys(c).sort()).toEqual(
      ['endCondition', 'gameType', 'learningMode', 'level', 'mode', 'range', 'theme'].sort(),
    )
  })

  it.each(['wsent', 'words', 'dict'])('gameType=%s を許可する', (gameType) => {
    expect(makeMatchConfig(validInput({ gameType })).gameType).toBe(gameType)
  })

  it.each(['both', 'en', 'ja'])('mode=%s を許可する', (mode) => {
    expect(makeMatchConfig(validInput({ mode })).mode).toBe(mode)
  })

  it('range=null を許可する', () => {
    expect(makeMatchConfig(validInput({ range: null })).range).toBeNull()
  })

  it('range=1（下限の正整数）を許可する', () => {
    expect(makeMatchConfig(validInput({ range: 1 })).range).toBe(1)
  })

  it('level=1（下限）を許可する', () => {
    expect(makeMatchConfig(validInput({ level: 1 })).level).toBe(1)
  })

  it.each(['すべて', '日常', '旅行', 'ビジネス'])('theme=%s を許可する', (theme) => {
    expect(makeMatchConfig(validInput({ theme })).theme).toBe(theme)
  })

  it.each([
    ['time', 30],
    ['chars', 100],
    ['items', 25],
    ['life', 3],
  ])('endCondition kind=%s（counted 系）を許可する', (kind, value) => {
    const c = makeMatchConfig(validInput({ endCondition: makeEndCondition(kind, value) }))
    expect(c.endCondition).toMatchObject({ kind, value })
  })
})

// ---- makeMatchConfig：不正入力は throw（trusted builder） ----
describe('makeMatchConfig：不正入力は throw する', () => {
  const invalidCases = [
    ['gameType 集合外', validInput({ gameType: 'xxx' })],
    ['gameType 非文字列', validInput({ gameType: 1 })],
    ['mode 集合外', validInput({ mode: 'mix' })],
    ['learningMode が cloze 以外', validInput({ learningMode: 'plain' })],
    ['learningMode 欠落', validInput({ learningMode: undefined })],
    ['level=0', validInput({ level: 0 })],
    ['level 負', validInput({ level: -1 })],
    ['level 非整数', validInput({ level: 1.5 })],
    ['level 非数', validInput({ level: '3' })],
    ['theme 空文字', validInput({ theme: '' })],
    ['theme 非文字列', validInput({ theme: 5 })],
    ['range=0', validInput({ range: 0 })],
    ['range 負', validInput({ range: -1 })],
    ['range 非整数', validInput({ range: 2.5 })],
    ['range が文字列', validInput({ range: '10' })],
    ['endCondition が endless', validInput({ endCondition: makeEndCondition('endless') })],
    ['endCondition が不正オブジェクト', validInput({ endCondition: { kind: 'time' } })],
    ['endCondition 欠落', validInput({ endCondition: undefined })],
  ]

  it.each(invalidCases)('%s → throw', (_label, input) => {
    expect(() => makeMatchConfig(input)).toThrow()
  })
})

// ---- parseMatchConfig：untrusted 入力（throw せず正規化 or null） ----
describe('parseMatchConfig：正常系（ワイヤ入力を正規化・凍結して返す）', () => {
  it('妥当なワイヤ入力から正規化した凍結オブジェクトを返す', () => {
    const c = parseMatchConfig(validWire())
    expect(c).not.toBeNull()
    expect(c).toMatchObject({
      gameType: 'wsent',
      level: 3,
      theme: '日常',
      range: null,
      mode: 'both',
      learningMode: 'cloze',
    })
    expect(c.endCondition).toMatchObject({ kind: 'chars', value: 60 })
    expect(Object.isFrozen(c)).toBe(true)
  })

  it('余計なフィールドは落とす', () => {
    const c = parseMatchConfig(validWire({ evil: true }))
    expect(c).not.toHaveProperty('evil')
  })
})

describe('parseMatchConfig：不正入力は null を返す（throw しない）', () => {
  const invalidCases = [
    ['null', null],
    ['undefined', undefined],
    ['数値（非オブジェクト）', 42],
    ['文字列（非オブジェクト）', 'wsent'],
    ['配列', [validWire()]],
    ['gameType 集合外', validWire({ gameType: 'ping' })],
    ['mode 集合外', validWire({ mode: 'mix' })],
    ['learningMode が cloze 以外', validWire({ learningMode: 'plain' })],
    ['level=0', validWire({ level: 0 })],
    ['level 非整数', validWire({ level: 1.5 })],
    ['theme 空文字', validWire({ theme: '' })],
    ['range=0', validWire({ range: 0 })],
    ['range 非整数', validWire({ range: 2.5 })],
    ['endCondition が endless', validWire({ endCondition: { kind: 'endless', value: null } })],
    ['endCondition が不正（value 欠落）', validWire({ endCondition: { kind: 'time' } })],
    ['endCondition 欠落', validWire({ endCondition: undefined })],
  ]

  it.each(invalidCases)('%s → null', (_label, input) => {
    expect(parseMatchConfig(input)).toBeNull()
  })
})

describe('parseMatchConfig：どんな入力でも throw しない（信頼境界）', () => {
  const hostile = [
    null,
    undefined,
    NaN,
    Symbol('x'),
    () => {},
    [],
    new Map(),
    123n,
    { gameType: { toString() { throw new Error('boom') } } },
    { gameType: 'wsent', endCondition: { get kind() { throw new Error('boom') } } },
  ]

  it.each(hostile.map((v, i) => [i, v]))('悪意入力 #%i でも throw せず null/オブジェクト', (_i, input) => {
    let result
    expect(() => {
      result = parseMatchConfig(input)
    }).not.toThrow()
    expect(result === null || typeof result === 'object').toBe(true)
  })
})

// ---- matchConfigEquals：値等価（throw しない） ----
describe('matchConfigEquals：全フィールド一致で true', () => {
  it('同一内容の 2 つは true', () => {
    expect(matchConfigEquals(makeMatchConfig(validInput()), makeMatchConfig(validInput()))).toBe(true)
  })

  it('gameType が違えば false', () => {
    const a = makeMatchConfig(validInput({ gameType: 'wsent' }))
    const b = makeMatchConfig(validInput({ gameType: 'words' }))
    expect(matchConfigEquals(a, b)).toBe(false)
  })

  it('level が違えば false', () => {
    const a = makeMatchConfig(validInput({ level: 2 }))
    const b = makeMatchConfig(validInput({ level: 3 }))
    expect(matchConfigEquals(a, b)).toBe(false)
  })

  it('theme が違えば false', () => {
    const a = makeMatchConfig(validInput({ theme: '日常' }))
    const b = makeMatchConfig(validInput({ theme: '旅行' }))
    expect(matchConfigEquals(a, b)).toBe(false)
  })

  it('range が違えば false（null vs 数値）', () => {
    const a = makeMatchConfig(validInput({ range: null }))
    const b = makeMatchConfig(validInput({ range: 5 }))
    expect(matchConfigEquals(a, b)).toBe(false)
  })

  it('mode が違えば false', () => {
    const a = makeMatchConfig(validInput({ mode: 'both' }))
    const b = makeMatchConfig(validInput({ mode: 'en' }))
    expect(matchConfigEquals(a, b)).toBe(false)
  })

  it('endCondition が違えば false（endConditionEquals で比較）', () => {
    const a = makeMatchConfig(validInput({ endCondition: makeEndCondition('chars', 60) }))
    const b = makeMatchConfig(validInput({ endCondition: makeEndCondition('chars', 120) }))
    expect(matchConfigEquals(a, b)).toBe(false)
  })

  it('不正/null を渡しても throw せず false', () => {
    expect(() => matchConfigEquals(null, makeMatchConfig(validInput()))).not.toThrow()
    expect(matchConfigEquals(null, makeMatchConfig(validInput()))).toBe(false)
    expect(matchConfigEquals({}, {})).toBe(false)
  })
})
