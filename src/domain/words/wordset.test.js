import { describe, it, expect } from 'vitest'
import { buildWordSet, buildWordPassage, levelWords, makeQuiz, WORD_COUNT } from './wordset.service.js'
import { buildUnits } from '../typing/units.service.js'
import { TARGET_KEYS } from '../marathon/passage.service.js'
import { WORDS } from '../../content/wordsAll.js'
import { mulberry32 } from '../rng.service.js'
import { romajiVariants } from '../romaji/romaji.service.js'

const MODES = ['en', 'ja', 'both']
const LEVELS = [1, 2, 3, 4]

describe('buildWordSet (4択用)', () => {
  it('指定数の語を返す', () => {
    expect(buildWordSet(WORDS, 1, 'すべて').length).toBe(WORD_COUNT)
    expect(buildWordSet(WORDS, 2, '旅行', 10).length).toBe(10)
  })

  it('レベル×テーマで空なら同レベル全体にフォールバックする', () => {
    // level1 に該当テーマが無い→テーマ絞りが空→同レベルへフォールバック
    const words = [{ en: 'apple', level: 1, theme: '日常', kana: 'あ', ja: 'あ' }]
    const set = buildWordSet(words, 1, '旅行', 3)
    expect(set).toHaveLength(3)
    expect(set.every((w) => w.en === 'apple')).toBe(true)
  })

  it('同レベルも空ならデータ全体にフォールバックする', () => {
    // level5 の語が無い→同レベルも空→全語へフォールバック
    const words = [{ en: 'apple', level: 1, theme: '日常', kana: 'あ', ja: 'あ' }]
    const set = buildWordSet(words, 5, 'すべて', 3)
    expect(set).toHaveLength(3)
    expect(set.every((w) => w.en === 'apple')).toBe(true)
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

describe('rng 注入（決定的）', () => {
  it('buildWordSet は同じ seed の rng で同じ並びを返す', () => {
    const a = buildWordSet(WORDS, 2, 'すべて', WORD_COUNT, { rng: mulberry32(99) })
    const b = buildWordSet(WORDS, 2, 'すべて', WORD_COUNT, { rng: mulberry32(99) })
    expect(a.map((w) => w.en)).toEqual(b.map((w) => w.en))
  })

  it('buildWordSet は seed が違えば並びが変わる', () => {
    const a = buildWordSet(WORDS, 2, 'すべて', WORD_COUNT, { rng: mulberry32(1) })
    const b = buildWordSet(WORDS, 2, 'すべて', WORD_COUNT, { rng: mulberry32(2) })
    expect(a.map((w) => w.en)).not.toEqual(b.map((w) => w.en))
  })

  it('buildWordPassage は同じ seed の rng で同じ並びを返す', () => {
    const a = buildWordPassage(WORDS, 2, 'すべて', 'en', { rng: mulberry32(5) })
    const b = buildWordPassage(WORDS, 2, 'すべて', 'en', { rng: mulberry32(5) })
    expect(a.map((w) => w.en)).toEqual(b.map((w) => w.en))
  })

  it('makeQuiz は同じ seed の rng で同じ選択肢列を返す', () => {
    const set = buildWordSet(WORDS, 2, 'すべて', WORD_COUNT, { rng: mulberry32(3) })
    const pool = levelWords(WORDS, 2)
    const a = makeQuiz(set, pool, 'en', 4, { rng: mulberry32(8) })
    const b = makeQuiz(set, pool, 'en', 4, { rng: mulberry32(8) })
    expect(a.map((q) => q.options.map((o) => o.display))).toEqual(
      b.map((q) => q.options.map((o) => o.display)),
    )
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

  it('誤答候補の綴りが相互に前方一致するクラスタは1語しか採らない（衝突スキップ）', () => {
    // en が入れ子で前方一致（be ⊂ bee ⊂ beef）→ どれか1語しか採れず以降はスキップ。
    const answer = { en: 'zoo', ja: 'どうぶつえん', kana: 'ずー', level: 1, theme: '日常' }
    const pool = [
      answer,
      { en: 'be', ja: 'ある', kana: 'びー', level: 1, theme: '日常' },
      { en: 'bee', ja: 'はち', kana: 'びー', level: 1, theme: '日常' },
      { en: 'beef', ja: 'ぎゅうにく', kana: 'びーふ', level: 1, theme: '日常' },
    ]
    const [q] = makeQuiz([answer], pool, 'en', 4, { rng: mulberry32(3) })
    // be クラスタからは1語しか採れないので正解+誤答1の計2択に収まる。
    expect(q.options.length).toBeLessThanOrEqual(2)
    expect(q.options.filter((o) => o.answer).length).toBe(1)
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
  })

  // #221: 回答後に「反対側」を表示するため、各選択肢に元エントリの
  // en/ja/jaKana を付与する。dir に関わらず全 option に載せる。
  describe('選択肢に反対側データ（en/ja/jaKana）を付与する (#221)', () => {
    const byEn = new Map(WORDS.map((w) => [w.en, w]))

    for (const dir of ['en', 'ja']) {
      it(`dir=${dir}: 各選択肢が反対側データを、その選択肢の元エントリの値で持つ`, () => {
        const set = buildWordSet(WORDS, 2, 'すべて', WORD_COUNT, { rng: mulberry32(7) })
        const qs = makeQuiz(set, levelWords(WORDS, 2), dir, 4, { rng: mulberry32(11) })
        for (const q of qs) {
          expect(q.options).toHaveLength(4)
          for (const o of q.options) {
            // 追加された反対側データ（英単語 en・和訳 ja・和訳の読み jaKana）
            const src = byEn.get(o.en)
            expect(src, `en=${o.en} が単語データに存在する`).toBeTruthy()
            expect(o.en).toBe(src.en)
            expect(o.ja).toBe(src.ja)
            expect(o.jaKana).toBe(src.kana)
            // 反対側データが指すエントリは、display/variants を生んだエントリと同一
            expect(o.display).toBe(dir === 'ja' ? src.ja : src.en)
            expect(o.variants).toEqual(dir === 'ja' ? romajiVariants(src.kana) : [src.en])
            // 既存 kana の意味（dir='ja'→元エントリの kana / それ以外→undefined）は不変
            expect(o.kana).toBe(dir === 'ja' ? src.kana : undefined)
          }
          // 既存の問題形（正解を含む）が壊れていない
          expect(q.options.some((o) => o.answer)).toBe(true)
        }
      })
    }
  })
})
