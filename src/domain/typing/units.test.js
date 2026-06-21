import { describe, it, expect } from 'vitest'
import { buildUnits, segMatches } from './units.js'

const item = { en: 'reserve', ja: '予約する', kana: 'よやくする', jaWords: ['予約', 'する'] }

describe('buildUnits', () => {
  it('en は英語1セグメント', () => {
    const segs = buildUnits(item, 'en')
    expect(segs.map((s) => s.type)).toEqual(['en'])
    expect(segs[0].variants).toContain('reserve')
  })

  it('ja は日本語1セグメント（ローマ字variants）', () => {
    const segs = buildUnits(item, 'ja')
    expect(segs.map((s) => s.type)).toEqual(['ja'])
    expect(segs[0].variants).toContain('yoyakusuru')
  })

  it('both は英→日の2セグメント（日常会話と同じ）', () => {
    const segs = buildUnits(item, 'both')
    expect(segs.map((s) => s.type)).toEqual(['en', 'ja'])
  })
})

describe('segMatches', () => {
  it('途中入力の前方一致を判定する', () => {
    const seg = buildUnits(item, 'ja')[0]
    expect(segMatches(seg, 'yoyaku')).toBe(true)
    expect(segMatches(seg, 'zzz')).toBe(false)
  })
})
