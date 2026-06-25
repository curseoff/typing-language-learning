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

  it('kanaConsumed: shi/si・促音・撥音の変種でも一致する', () => {
    expect(kanaConsumed('しんせつ', 'sinse')).toBe(3) // し ん せ（si + n + se）
    expect(kanaConsumed('しんせつ', 'cinsetu')).toBe(4) // ci/tu の別綴りでも全消費
    expect(kanaConsumed('あっか', 'akka')).toBe(3) // 子音重ね
    expect(kanaConsumed('あっか', 'axtuka')).toBe(3) // xtu 入力
  })

  it('kanaConsumed: 撥音/促音が境界かつ次音が未完なら手前で止める（孤立綴りの回帰）', () => {
    // 「cin」だけでは「しん」は確定しない（次の音が綴り切れていない）→ し のみ
    expect(kanaConsumed('しんせつ', 'cinc')).toBe(1)
    // 「akk」だけでは「あっか」は確定しない → あ のみ
    expect(kanaConsumed('あっか', 'akk')).toBe(1)
  })

  it('kanaConsumed: 長い読みでも線形時間で解ける（指数展開しない）', () => {
    const kana = 'けんきゅうしつはびじゃくなひかりをけんしゅつする'
    const t = performance.now()
    expect(kanaConsumed(kana, toRomaji(kana))).toBe([...kana].length) // 全消費
    expect(performance.now() - t).toBeLessThan(50) // 旧実装は指数的で桁違いに遅かった
  })
})
