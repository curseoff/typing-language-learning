import { describe, it, expect } from 'vitest'
import { romajiVariants, toRomaji, kanaConsumed } from './romaji.js'

describe('romaji', () => {
  it('カタカナも変換できる（ホテル→hoteru）', () => {
    expect(toRomaji('ホテル')).toBe('hoteru')
  })

  it('shi/si など複数の綴りを受理する', () => {
    const v = romajiVariants('し')
    expect(v).toContain('shi')
    expect(v).toContain('si')
  })

  it('促音(っ)を含む語を正しく展開する（がっこう→gakkou）', () => {
    const v = romajiVariants('がっこう')
    expect(v).toContain('gakkou')
    expect(toRomaji('がっこう')).toBe('gakkou')
  })

  it('canonical はヘボン式を既定にする', () => {
    expect(toRomaji('し')).toBe('shi')
    expect(toRomaji('つ')).toBe('tsu')
  })

  it('kanaConsumed: 途中入力で消費したかな数を返す', () => {
    // よやくする: yo ya ku su ru
    expect(kanaConsumed('よやくする', '')).toBe(0)
    expect(kanaConsumed('よやくする', 'yoyaku')).toBe(3) // よ や く
    expect(kanaConsumed('よやくする', 'yoyakusuru')).toBe(5)
  })
})
