import { describe, it, expect } from 'vitest'
import { buildWordSet, buildWordPassage, levelWords, makeQuiz, WORD_COUNT } from './wordset.js'
import { buildUnits } from '../typing/units.js'
import { TARGET_KEYS } from '../marathon/passage.js'
import { WORDS } from '../../content/wordsAll.js'

const MODES = ['en', 'ja', 'both']
const LEVELS = [1, 2, 3, 4]

describe('buildWordSet (4択用)', () => {
  it('指定数の語を返す', () => {
    expect(buildWordSet(WORDS, 1, 'すべて').length).toBe(WORD_COUNT)
    expect(buildWordSet(WORDS, 2, '旅行', 10).length).toBe(10)
  })
})

describe('buildWordPassage (入力用・600文字)', () => {
  it('最短綴りで打っても600キーに到達できる（短い綴りで詰む不具合の回帰）', () => {
    for (const mode of MODES) {
      for (const level of LEVELS) {
        const words = buildWordPassage(WORDS, level, 'すべて', mode)
        const shortest = words
          .flatMap((w) => buildUnits(w, mode))
          .reduce((sum, seg) => sum + Math.min(...seg.variants.map((v) => v.length)), 0)
        expect(shortest, `mode=${mode} L${level}`).toBeGreaterThanOrEqual(TARGET_KEYS)
      }
    }
  })
})

describe('makeQuiz (4択)', () => {
  it('英語訳/日本語訳とも、選択肢に正解を含み前方一致が衝突しない', () => {
    for (const dir of ['en', 'ja']) {
      const qs = makeQuiz(buildWordSet(WORDS, 2, 'すべて'), levelWords(WORDS, 2), dir)
      for (const q of qs) {
        expect(q.options.some((o) => o.answer)).toBe(true)
        // 打鍵の前方一致衝突がないこと
        for (const a of q.options) {
          for (const b of q.options) {
            if (a === b) continue
            for (const va of a.variants) {
              for (const vb of b.variants) {
                if (va === vb) continue
                expect(va.startsWith(vb) || vb.startsWith(va)).toBe(false)
              }
            }
          }
        }
      }
    }
  })
})
