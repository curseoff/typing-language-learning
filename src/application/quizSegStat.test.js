import { describe, it, expect } from 'vitest'
import { buildQuizSegStat } from './quizSegStat.policy.js'

// Issue #240: 4択(単語/英英)の1問記録を純関数に切り出し、
// ユーザーが選んだ選択肢(picked)を英日で保持する。
describe('buildQuizSegStat（4択の1問記録・純関数）', () => {
  it('正解選択（単語）は label/answer/correct/picked と英日を過不足なく持つ', () => {
    const question = { prompt: 'apple', answerDisplay: 'りんご' }
    const picked = { display: 'りんご', en: 'apple', ja: 'りんご', answer: true }

    const result = buildQuizSegStat({ question, picked, no: 1, mistakes: 0 })

    expect(result).toEqual({
      no: 1,
      label: 'apple',
      answer: 'りんご',
      correct: true,
      mistakes: 0,
      picked: 'りんご',
      pickedEn: 'apple',
      pickedJa: 'りんご',
    })
  })

  it('誤答選択（単語）は correct=false で、選んだ選択肢の表示・英日を保持する', () => {
    const question = { prompt: 'apple', answerDisplay: 'りんご' }
    const picked = { display: 'いちご', en: 'strawberry', ja: 'いちご', answer: false }

    const result = buildQuizSegStat({ question, picked, no: 2, mistakes: 1 })

    expect(result.correct).toBe(false)
    expect(result.picked).toBe('いちご')
    expect(result.pickedEn).toBe('strawberry')
    expect(result.pickedJa).toBe('いちご')
    expect(result.mistakes).toBe(1)
  })

  it('英英4択（en/ja 無し）は picked 表示のみ持ち、pickedEn/pickedJa キーは出さない', () => {
    const question = { prompt: 'a round fruit', answerDisplay: 'apple' }
    const picked = { display: 'apple', answer: false }

    const result = buildQuizSegStat({ question, picked, no: 3, mistakes: 0 })

    expect(result.picked).toBe('apple')
    expect(result.correct).toBe(false)
    expect('pickedEn' in result).toBe(false)
    expect('pickedJa' in result).toBe(false)
  })

  it('picked=null（無選択）は例外を投げず correct=false、picked系キーを一切含めない', () => {
    const question = { prompt: 'apple', answerDisplay: 'りんご' }

    const result = buildQuizSegStat({ question, picked: null, no: 5, mistakes: 2 })

    expect(result).toEqual({
      no: 5,
      label: 'apple',
      answer: 'りんご',
      correct: false,
      mistakes: 2,
    })
    expect('picked' in result).toBe(false)
    expect('pickedEn' in result).toBe(false)
    expect('pickedJa' in result).toBe(false)
  })

  it('純粋：同じ引数で2回呼ぶと同一結果を返す', () => {
    const question = { prompt: 'apple', answerDisplay: 'りんご' }
    const picked = { display: 'りんご', en: 'apple', ja: 'りんご', answer: true }

    const a = buildQuizSegStat({ question, picked, no: 1, mistakes: 0 })
    const b = buildQuizSegStat({ question, picked, no: 1, mistakes: 0 })

    expect(a).toEqual(b)
  })

  it('純粋：引数の question/picked を破壊変更しない', () => {
    const question = { prompt: 'apple', answerDisplay: 'りんご' }
    const picked = { display: 'いちご', en: 'strawberry', ja: 'いちご', answer: false }

    buildQuizSegStat({ question, picked, no: 2, mistakes: 1 })

    expect(question).toEqual({ prompt: 'apple', answerDisplay: 'りんご' })
    expect(picked).toEqual({
      display: 'いちご',
      en: 'strawberry',
      ja: 'いちご',
      answer: false,
    })
  })
})
