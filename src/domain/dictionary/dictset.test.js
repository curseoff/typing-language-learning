import { describe, it, expect } from 'vitest'
import {
  buildDictSet,
  levelEntries,
  makeDictQuiz,
  DICT_AVAILABLE_LEVELS,
} from './dictset.js'

describe('buildDictSet', () => {
  it('指定数のエントリを返す（不足は循環）', () => {
    const lv = DICT_AVAILABLE_LEVELS[0]
    expect(buildDictSet(lv, 'すべて', 12).length).toBe(12)
  })
})

describe('makeDictQuiz', () => {
  it('定義→英単語の4択。選択肢に正解を含み、前方一致が衝突しない', () => {
    const lv = DICT_AVAILABLE_LEVELS[0]
    const qs = makeDictQuiz(buildDictSet(lv, 'すべて', 10), levelEntries(lv), 10)
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
