// @vitest-environment jsdom
// presenter smoke（#233 M7）
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import SegStatsTable from './SegStatsTable.presenter'

afterEach(cleanup)

describe('SegStatsTable smoke', () => {
  it('設問ごとの正誤を表に描く', () => {
    const quiz = [
      { no: 1, label: 'dictionary', answer: '辞書', correct: true, mistakes: 0 },
      { no: 2, label: 'picture', answer: '写真', correct: false, mistakes: 2 },
      { no: 3, label: 'travel', answer: '旅行', correct: true, mistakes: 1 },
    ]
    const { container } = render(<SegStatsTable segStats={quiz} />)
    expect(container.textContent).toContain('dictionary')
    expect(container.textContent).toContain('旅行')
  })

  it('4択は「あなたの回答」を英日で描き、誤答は正解も別掲する（#240）', () => {
    const quiz = [
      { no: 1, label: 'apple', answer: 'りんご', correct: true, mistakes: 0, picked: 'りんご', pickedEn: 'apple', pickedJa: 'りんご' },
      { no: 2, label: 'strawberry', answer: 'いちご', correct: false, mistakes: 1, picked: 'ぶどう', pickedEn: 'grape', pickedJa: 'ぶどう' },
    ]
    const { container } = render(<SegStatsTable segStats={quiz} />)
    expect(container.textContent).toContain('あなたの回答')
    expect(container.textContent).toContain('ぶどう') // 誤答で選んだ選択肢
    expect(container.textContent).toContain('grape') // 選んだ英単語
    expect(container.textContent).toContain('正解') // 誤答時の正解別掲
  })

  it('旧記録（picked 無し）は壊れず、正解は正解語を、誤答は—＋正解別掲を出す', () => {
    const legacy = [
      { no: 1, label: 'apple', answer: 'りんご', correct: true, mistakes: 0 },
      { no: 2, label: 'strawberry', answer: 'いちご', correct: false, mistakes: 1 },
    ]
    const { container } = render(<SegStatsTable segStats={legacy} />)
    expect(container.textContent).toContain('apple')
    expect(container.textContent).toContain('りんご') // 正解記録は正解語を回答欄に
    expect(container.textContent).toContain('—') // 誤答の旧記録は選択不明
    expect(container.textContent).toContain('正解') // 誤答は正解別掲
  })

  it('入力系は問題を英日ペアで描き、旧記録（en/ja 無し）は label のみ', () => {
    const input = [
      { no: 1, type: 'en' as const, en: 'apple', ja: 'りんご', kana: 'りんご', label: 'apple', speed: 240, mistakes: 0 },
      { no: 2, type: 'ja' as const, label: 'banana', speed: 180, mistakes: 0 },
    ]
    const { container } = render(<SegStatsTable segStats={input} />)
    expect(container.textContent).toContain('apple')
    expect(container.textContent).toContain('りんご') // 英日ペアの和
    expect(container.textContent).toContain('banana') // 旧記録は label のみ
  })
})
