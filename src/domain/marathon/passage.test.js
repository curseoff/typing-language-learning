import { describe, it, expect } from 'vitest'
import { buildPassage, TARGET_KEYS } from './passage.service.js'
import { mulberry32 } from '../rng.service.js'

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

describe('buildPassage の ordered（固定範囲の順序保持）#364', () => {
  // ordered:true → rng シャッフルせず pool の順序のまま target まで充填（決定的）。
  //   固定範囲（range）の出題を「毎回同じ並び」で流すために使う。
  // ordered:false（既定）→ 従来どおり rng シャッフル（非回帰）。
  // 'en' モードは buildUnits が rng 非依存＝1文=1セグメントなので、順序を canonical で検証できる。

  it('ordered:true は pool の順序を保持する（先頭 pool.length 文が pool 順）', () => {
    const segs = buildPassage('en', pool, { rng: mulberry32(1), ordered: true })
    // 'en' モードは 1 文 = 1 セグメント。先頭 pool.length 文が pool 順（シャッフルなし）。
    expect(segs.slice(0, pool.length).map((s) => s.canonical)).toEqual(
      pool.map((p) => p.en),
    )
  })

  it('ordered:true は rng に依存しない（シードが違っても同一並び＝シャッフルしない）', () => {
    const a = buildPassage('en', pool, { rng: mulberry32(1), ordered: true })
    const b = buildPassage('en', pool, { rng: mulberry32(999), ordered: true })
    expect(a.map((s) => s.canonical)).toEqual(b.map((s) => s.canonical))
  })

  it('ordered:true でも target を超える長さのセグメント列を返す', () => {
    const segs = buildPassage('en', pool, { rng: mulberry32(1), ordered: true })
    const total = segs.reduce((s, seg) => s + seg.canonical.length, 0)
    expect(total).toBeGreaterThanOrEqual(TARGET_KEYS)
  })

  it('ordered:false（既定）は従来どおり rng シャッフルに従う（非回帰）', () => {
    const dflt = buildPassage('en', pool, { rng: mulberry32(1) })
    const explicit = buildPassage('en', pool, { rng: mulberry32(1), ordered: false })
    expect(explicit.map((s) => s.canonical)).toEqual(dflt.map((s) => s.canonical))
  })
})
