// @vitest-environment jsdom
// presenter smoke（#233 M7）: 入力モード/単語4択/説明文4択。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { DictTypeView, DictQuizView, DictPickView } from './DictView.presenter'

afterEach(cleanup)

const noop = () => {}

describe('DictTypeView smoke', () => {
  it('入力モード（プレイ中）', () => {
    const segments = [
      { type: 'en', en: 'a book that lists words and their meanings', ja: '', kana: '', sentenceIndex: 0 },
    ]
    const { container } = render(
      <DictTypeView
        levelLabel="英英 L1"
        metaSub="英語入力 / すべて"
        finished={false}
        resultNode={null}
        typedKeys={96}
        liveSpeed={230}
        mistakes={3}
        endStatLabel="残り"
        endStatValue="30秒"
        progress={0.55}
        word="dictionary"
        wordJa="辞書"
        hintLead="この語を英語で説明した文を打ちます。"
        segments={segments}
        segIndex={0}
        segInput="a book that l"
        hasError={false}
      />,
    )
    expect(container.textContent).toContain('dictionary')
  })
})

describe('DictQuizView smoke', () => {
  it('単語4択（出題）', () => {
    const options = [
      { display: 'dictionary', variants: ['dictionary'], answer: true, ja: '辞書' },
      { display: 'picture', variants: ['picture'], ja: '写真' },
      { display: 'travel', variants: ['travel'], ja: '旅行' },
      { display: 'morning', variants: ['morning'], ja: '朝' },
    ]
    const wordRuby = { dictionary: { ja: '辞書', kana: 'じしょ' }, picture: { ja: '写真', kana: 'しゃしん' } }
    const { container } = render(
      <DictQuizView
        levelLabel="英英 L1"
        metaSub="単語（4択） / すべて"
        finished={false}
        resultNode={null}
        typedKeys={20}
        correct={5}
        mistakes={1}
        endStatLabel="残り"
        endStatValue="15問"
        progress={0.5}
        prompt="a book that lists words and their meanings"
        promptJa="単語とその意味を並べた本"
        options={options}
        wordRuby={wordRuby}
        input=""
        picked={null}
        hasError={false}
        onPick={noop}
        onAdvance={noop}
      />,
    )
    expect(container.textContent).toContain('dictionary')
  })
})

describe('DictPickView smoke', () => {
  it('説明文4択（出題）', () => {
    const options = [
      { display: 'a book that lists words and their meanings', variants: ['a'], answer: true },
      { display: 'a painting, drawing, or photograph', variants: ['a'] },
      { display: 'the act of going from one place to another', variants: ['the'] },
    ]
    const { container } = render(
      <DictPickView
        levelLabel="英英 L1"
        metaSub="説明（4択） / すべて"
        finished={false}
        resultNode={null}
        typedKeys={18}
        correct={4}
        mistakes={2}
        endStatLabel="残り"
        endStatValue="12問"
        progress={0.45}
        prompt="dictionary"
        headJa="辞書"
        options={options}
        input=""
        picked={null}
        hasError={false}
        onPick={noop}
        onAdvance={noop}
      />,
    )
    expect(container.textContent).toContain('dictionary')
  })
})
