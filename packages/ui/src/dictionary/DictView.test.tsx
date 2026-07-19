// @vitest-environment jsdom
// presenter smoke（#233 M7）: 入力モード/単語4択/説明文4択。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { DictTypeView, DictQuizView, DictPickView, DictMirrorView } from './DictView.presenter'
import type { MaskBoardCell } from '../versus/MaskBoard.presenter'

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

  it('compact（対戦）：上部 stats を「残り＋progressバー」だけに絞る', () => {
    const segments = [
      { type: 'en' as const, en: 'a book that lists words and their meanings', ja: '', kana: '', sentenceIndex: 0 },
    ]
    const { container } = render(
      <DictTypeView
        levelLabel="L1"
        metaSub="英英 / 英語入力 / すべて"
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
        compact
      />,
    )
    // compact は stat 枠を1つ（残り）に絞る。タイピング数/速度/ミスのラベルは出さない。
    expect(container.querySelectorAll('.stat')).toHaveLength(1)
    expect(container.textContent).toContain('残り')
    expect(container.textContent).not.toContain('タイピング数')
    // progressバーは維持。
    expect(container.querySelector('.progress-bar')).not.toBeNull()
  })
})

describe('DictMirrorView smoke', () => {
  const cellsFor = (shape: number[], curPos: number, miss = false): MaskBoardCell[] => {
    const sum = shape.reduce((a, b) => a + b, 0)
    const filled = Math.max(0, Math.min(curPos, sum))
    const out: MaskBoardCell[] = []
    let idx = 0
    shape.forEach((len, wi) => {
      if (wi > 0) out.push({ kind: 'space', miss })
      for (let i = 0; i < len; i += 1) {
        out.push({ kind: idx < filled ? 'filled' : 'pending', miss })
        idx += 1
      }
    })
    return out
  }

  it('en モード：見出し語＋ヒント（日本語）を実テキストで描き、答え側（英語）は伏字マス', () => {
    const { container } = render(
      <DictMirrorView
        levelLabel="L1"
        metaSub="英英 / 英語入力 / すべて"
        word="apple"
        wordJa="りんご"
        answerSide="en"
        hint={{ side: 'ja', text: '果物の一種' }}
        cells={cellsFor([1, 5, 4], 3)}
      />,
    )
    const t = container.textContent ?? ''
    // 見出し語と和訳、ヒント（日本語）は実テキストで見える。
    expect(t).toContain('apple')
    expect(t).toContain('りんご')
    expect(t).toContain('果物の一種')
    // 答え側は伏字マス（vs-mb）で描き、英語定義の実文字は出さない。
    expect(container.querySelector('.vs-mb')).not.toBeNull()
  })

  it('ja モード：見出し和訳は隠し（答えになるため）、ヒント（英語）を実テキストで描く', () => {
    const { container } = render(
      <DictMirrorView
        levelLabel="L1"
        metaSub="英英 / 日本語入力 / すべて"
        word="sun"
        answerSide="ja"
        hint={{ side: 'en', text: 'the star that the earth moves around' }}
        cells={cellsFor([4], 2)}
      />,
    )
    const t = container.textContent ?? ''
    expect(t).toContain('sun')
    expect(t).toContain('the star that the earth moves around')
    expect(container.querySelector('.vs-mb')).not.toBeNull()
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
