import { describe, it, expect } from 'vitest'
import {
  buildDictSet,
  levelEntries,
  makeDictQuiz,
  makeDictPick,
} from './dictset.js'
import { DICT_AVAILABLE_LEVELS, loadDict } from '../../content/dictionary.js'

const DICT = await loadDict()

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

describe('buildDictSet', () => {
  it('指定数のエントリを返す（不足は循環）', () => {
    const lv = DICT_AVAILABLE_LEVELS[0]
    expect(buildDictSet(DICT, lv, 'すべて', 12).length).toBe(12)
  })
})

describe('rng 注入（決定的）', () => {
  const lv = DICT_AVAILABLE_LEVELS[0]

  it('buildDictSet は同じ seed の rng で同じ並びを返す', () => {
    const a = buildDictSet(DICT, lv, 'すべて', 12, { rng: mulberry32(11) })
    const b = buildDictSet(DICT, lv, 'すべて', 12, { rng: mulberry32(11) })
    expect(a.map((e) => e.word)).toEqual(b.map((e) => e.word))
  })

  it('buildDictSet は seed が違えば並びが変わる', () => {
    const a = buildDictSet(DICT, lv, 'すべて', 12, { rng: mulberry32(1) })
    const b = buildDictSet(DICT, lv, 'すべて', 12, { rng: mulberry32(2) })
    expect(a.map((e) => e.word)).not.toEqual(b.map((e) => e.word))
  })

  it('makeDictQuiz は同じ seed の rng で同じ選択肢列を返す', () => {
    const set = buildDictSet(DICT, lv, 'すべて', 10, { rng: mulberry32(3) })
    const a = makeDictQuiz(set, levelEntries(DICT, lv), 10, 4, { rng: mulberry32(7) })
    const b = makeDictQuiz(set, levelEntries(DICT, lv), 10, 4, { rng: mulberry32(7) })
    expect(a.map((q) => q.options.map((o) => o.display))).toEqual(
      b.map((q) => q.options.map((o) => o.display)),
    )
  })

  it('makeDictPick は同じ seed の rng で同じ選択肢列を返す', () => {
    const set = buildDictSet(DICT, lv, 'すべて', 10, { rng: mulberry32(3) })
    const a = makeDictPick(set, levelEntries(DICT, lv), 10, 4, { rng: mulberry32(7) })
    const b = makeDictPick(set, levelEntries(DICT, lv), 10, 4, { rng: mulberry32(7) })
    expect(a.map((q) => q.options.map((o) => o.display))).toEqual(
      b.map((q) => q.options.map((o) => o.display)),
    )
  })
})

describe('makeDictQuiz', () => {
  it('定義→英単語の4択。選択肢に正解を含み、前方一致が衝突しない', () => {
    const lv = DICT_AVAILABLE_LEVELS[0]
    const qs = makeDictQuiz(buildDictSet(DICT, lv, 'すべて', 10), levelEntries(DICT, lv), 10)
    expect(qs.length).toBe(10)
    for (const q of qs) {
      expect(typeof q.prompt).toBe('string') // 英語の定義
      expect(typeof q.ja).toBe('string') // 回答後に見せる和訳
      expect(q.options.filter((o) => o.answer).length).toBe(1)
      for (const a of q.options) {
        for (const b of q.options) {
          if (a === b) continue
          const va = a.variants[0]
          const vb = b.variants[0]
          expect(va.startsWith(vb) || vb.startsWith(va)).toBe(false)
        }
      }
    }
  })
})
