// @vitest-environment jsdom
// #439 道Y：相手の伏字複製盤面を「本物の TopFlow」で描く共有 presenter の smoke。
// 答え側（answerSide）の行は全面伏字（実文字を出さない＝カンニング防止）、非答え側はヒントとして実テキスト表示。
// 進捗は curPos（表示単位）から導き、打鍵済みぶんは実文字ではなく filled マス(●)で示す（実綴りは出さない）。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import MirrorPlayView from './MirrorPlayView.presenter'
import type { TopSeg } from '../marathon/TopFlow.presenter'

afterEach(cleanup)

const dictEnSegs: TopSeg[] = [
  { type: 'en', en: 'a round fruit', ja: '丸い果物', kana: 'まるいくだもの', sentenceIndex: 0 },
  { type: 'en', en: 'the star', ja: '星', kana: 'ほし', sentenceIndex: 1 },
]

describe('MirrorPlayView smoke', () => {
  it('en モード：見出し語＋和訳＋ヒント（日本語）は実テキスト、答え側（英語定義）は伏字で実文字を出さない', () => {
    const { container } = render(
      <MirrorPlayView segments={dictEnSegs} segIndex={1} answerSide="en" curPos={3} word="sun" wordJa="太陽" />,
    )
    const t = container.textContent ?? ''
    // 見出し語・和訳・ヒント（日本語）は実テキストで見える。
    expect(t).toContain('sun')
    expect(t).toContain('太陽')
    expect(t).toContain('星') // 現在問題のヒント（日本語）
    // 答え側（英語定義）の実文字は打鍵済みでも一切出さない（原文も打鍵済みプレフィックス 'the' も現れない）。
    expect(t).not.toContain('the star')
    expect(t).not.toContain('the')
    // 伏字マス（mch）で描き、打鍵済みぶん（curPos=3）は filled マス(●)にする。
    expect(container.querySelector('.mch')).not.toBeNull()
    expect(container.querySelector('.mch.filled')).not.toBeNull()
    expect(t).toContain('●')
    // PlayMeta/StatsRow は持たない（上部の独立ヘッダバーへ集約）。
    expect(container.querySelector('.play-meta')).toBeNull()
    expect(container.querySelector('.progress-bar')).toBeNull()
  })

  it('ja モード：見出し和訳は隠し（答えになるため）、ヒント（英語）は実テキストで描く', () => {
    const jaSegs: TopSeg[] = [{ type: 'ja', en: 'the star', ja: '太陽', kana: 'たいよう', sentenceIndex: 0 }]
    const { container } = render(
      <MirrorPlayView segments={jaSegs} segIndex={0} answerSide="ja" curPos={0} word="sun" wordJa="太陽" />,
    )
    const t = container.textContent ?? ''
    expect(t).toContain('sun') // 見出し語は出る
    expect(t).toContain('the star') // ヒント（英語）は実テキスト
    // 見出し和訳（太陽）は答えになるので隠す＝seg-word-ja を出さない。
    expect(container.querySelector('.seg-word-ja')).toBeNull()
  })

  it('単語モード：見出し語なし（word 未指定）でも答え側の伏字を描く', () => {
    const wordSegs: TopSeg[] = [{ type: 'en', en: 'apple', ja: 'りんご', kana: 'りんご', sentenceIndex: 0 }]
    const { container } = render(
      <MirrorPlayView segments={wordSegs} segIndex={0} answerSide="en" curPos={2} />,
    )
    // 見出し（seg-word）は出さない。
    expect(container.querySelector('.seg-word')).toBeNull()
    // 答え側は伏字（mch）。和訳ヒントは実テキスト。
    expect(container.querySelector('.mch')).not.toBeNull()
    expect(container.textContent).toContain('りんご')
  })
})
