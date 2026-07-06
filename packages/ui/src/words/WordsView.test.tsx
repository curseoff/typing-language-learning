// @vitest-environment jsdom
// presenter smoke（#233 M7）: 入力モードと4択モード。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { WordTypeView, WordQuizView } from './WordsView'

afterEach(cleanup)

const noop = () => {}
const segments = [
  { type: 'en', en: 'good morning', ja: 'おはよう', kana: 'おはよう', sentenceIndex: 0 },
  { type: 'ja', en: 'good morning', ja: 'おはよう', kana: 'おはよう', sentenceIndex: 0 },
  { type: 'en', en: 'dictionary', ja: '辞書', kana: 'じしょ', sentenceIndex: 1 },
  { type: 'ja', en: 'dictionary', ja: '辞書', kana: 'じしょ', sentenceIndex: 1 },
]
const options = [
  { display: '辞書', variants: ['じしょ'], kana: 'じしょ', answer: true, en: 'dictionary', ja: '辞書', jaKana: 'じしょ' },
  { display: '写真', variants: ['しゃしん'], kana: 'しゃしん', en: 'picture', ja: '写真', jaKana: 'しゃしん' },
  { display: '旅行', variants: ['りょこう'], kana: 'りょこう', en: 'travel', ja: '旅行', jaKana: 'りょこう' },
  { display: '朝', variants: ['あさ'], kana: 'あさ', en: 'morning', ja: '朝', jaKana: 'あさ' },
]

describe('WordTypeView smoke', () => {
  it('入力モード（プレイ中）', () => {
    const { container } = render(
      <WordTypeView
        levelLabel="単語 L1"
        metaSub="英語・日本語 / すべて"
        finished={false}
        resultNode={null}
        typedKeys={84}
        liveSpeed={210}
        mistakes={2}
        endStatLabel="残り"
        endStatValue="24秒"
        progress={0.6}
        segments={segments}
        segIndex={2}
        segInput="dic"
        hasError={false}
      />,
    )
    expect(container.textContent).toContain('単語 L1')
  })
})

describe('WordQuizView smoke', () => {
  it('4択（出題/入力中）', () => {
    render(
      <WordQuizView
        levelLabel="単語 L1"
        metaSub="日本語（4択） / すべて"
        finished={false}
        resultNode={null}
        dir="ja"
        typedKeys={12}
        correct={4}
        mistakes={1}
        endStatLabel="残り"
        endStatValue="18問"
        progress={0.4}
        prompt="dictionary"
        options={options}
        input=""
        picked={null}
        hasError={false}
        onPick={noop}
        onAdvance={noop}
      />,
    )
    const { container } = render(
      <WordQuizView
        levelLabel="単語 L1"
        metaSub="日本語（4択） / すべて"
        finished={false}
        resultNode={null}
        dir="ja"
        typedKeys={13}
        correct={4}
        mistakes={1}
        endStatLabel="残り"
        endStatValue="18問"
        progress={0.4}
        prompt="dictionary"
        options={options}
        input="じ"
        picked={null}
        hasError={false}
        onPick={noop}
        onAdvance={noop}
      />,
    )
    expect(container.textContent).toContain('dictionary')
  })
})
