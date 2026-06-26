import { describe, it, expect } from 'vitest'
import { buildPassage, TARGET_KEYS } from './passage.js'

// テスト用シード付き PRNG（mulberry32）。同じ seed で同じ乱数列を返す。
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// buildUnits が扱える最小限の文データ
const pool = [
  { en: 'I have a pen.', ja: 'ペンを持っています。', kana: 'ぺんをもっています' },
  { en: 'She runs fast.', ja: '彼女は速く走る。', kana: 'かのじょははやくはしる' },
  { en: 'We eat lunch.', ja: '昼食を食べる。', kana: 'ちゅうしょくをたべる' },
  { en: 'They sing well.', ja: 'うまく歌う。', kana: 'うまくうたう' },
  { en: 'It rains today.', ja: '今日は雨だ。', kana: 'きょうはあめだ' },
]

describe('buildPassage', () => {
  it('TARGET_KEYS を超える長さのセグメント列を返す', () => {
    const segs = buildPassage('en', pool)
    const total = segs.reduce((s, seg) => s + seg.canonical.length, 0)
    expect(total).toBeGreaterThanOrEqual(TARGET_KEYS)
  })

  it('空 pool は空配列', () => {
    expect(buildPassage('en', [])).toEqual([])
    expect(buildPassage('en', undefined)).toEqual([])
  })

  it('同じ seed の rng で同じセグメント列を返す（決定的）', () => {
    const a = buildPassage('en', pool, { rng: mulberry32(123) })
    const b = buildPassage('en', pool, { rng: mulberry32(123) })
    expect(a.map((s) => s.canonical)).toEqual(b.map((s) => s.canonical))
  })

  it('seed が違えば並びが変わる', () => {
    const a = buildPassage('en', pool, { rng: mulberry32(1) })
    const b = buildPassage('en', pool, { rng: mulberry32(2) })
    expect(a.map((s) => s.canonical)).not.toEqual(b.map((s) => s.canonical))
  })
})
