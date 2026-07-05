import { describe, it, expect } from 'vitest'
import {
  buildDictSet,
  levelEntries,
  makeDictQuiz,
  makeDictPick,
} from './dictset.js'
import { DICT_AVAILABLE_LEVELS, loadDict } from '../../content/dictionary.js'
import { mulberry32 } from '../rng.js'

const DICT = await loadDict()

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

describe('makeDictPick の各 option は和訳(ja)と読み(kana)を持つ（#216）', () => {
  // def が互いに前方一致しないダミー辞書（誤答同士の衝突回避を素通しさせる）。
  const DUMMY = [
    { word: 'apple', def: 'a red fruit', ja: 'りんご', kana: 'りんご', level: 1, theme: '日常' },
    { word: 'banana', def: 'yellow long fruit', ja: 'ばなな', kana: 'ばなな', level: 1, theme: '日常' },
    { word: 'cat', def: 'small pet animal', ja: 'ねこ', kana: 'ねこ', level: 1, theme: '日常' },
    { word: 'dog', def: 'loyal companion here', ja: 'いぬ', kana: 'いぬ', level: 1, theme: '日常' },
    { word: 'egg', def: 'oval food from hen', ja: 'たまご', kana: 'たまご', level: 1, theme: '日常' },
  ]
  const byDef = Object.fromEntries(DUMMY.map((d) => [d.def, d]))

  it('各 option の ja/kana が「その option の元エントリ」の値と一致する', () => {
    const items = makeDictPick(DUMMY, DUMMY, 5, 4, { rng: mulberry32(42) })
    expect(items.length).toBe(5)
    for (const q of items) {
      expect(q.options.length).toBe(4)
      for (const o of q.options) {
        const src = byDef[o.display] // display=def から元エントリを引く
        expect(src).toBeDefined()
        // 誤答は正解の和訳を流用せず、自分自身の和訳/読みを持つ。
        expect(o.ja).toBe(src.ja)
        expect(o.kana).toBe(src.kana)
      }
    }
  })

  it('正解 option の ja/kana は正解エントリ(e)の ja/kana に一致する', () => {
    const items = makeDictPick(DUMMY, DUMMY, 5, 4, { rng: mulberry32(42) })
    for (const q of items) {
      const answer = q.options.find((o) => o.answer)
      const e = DUMMY.find((d) => d.word === q.prompt) // prompt=word
      expect(answer.ja).toBe(e.ja)
      expect(answer.kana).toBe(e.kana)
    }
  })

  it('既存フィールド（display/variants/answer）と問題形は不変', () => {
    const items = makeDictPick(DUMMY, DUMMY, 5, 4, { rng: mulberry32(42) })
    for (const q of items) {
      const e = DUMMY.find((d) => d.word === q.prompt)
      expect(q.prompt).toBe(e.word)
      expect(q.ja).toBe(e.ja)
      expect(q.answerDisplay).toBe(e.def)
      expect(q.options.filter((o) => o.answer).length).toBe(1)
      for (const o of q.options) {
        expect(typeof o.display).toBe('string')
        expect(o.variants).toEqual([o.display])
      }
    }
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
