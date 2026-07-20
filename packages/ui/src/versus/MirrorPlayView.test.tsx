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

  // #439 道Y (4)：both（英語・日本語）は typedSide に依らず英語行＝伏字／日本語行＝実表示に統一する。
  const bothSegs: TopSeg[] = [
    { type: 'en', en: 'apple', ja: '林檎', kana: 'りんご', sentenceIndex: 0 },
    { type: 'ja', en: 'apple', ja: '林檎', kana: 'りんご', sentenceIndex: 0 },
  ]

  it('both×英語入力中（typedSide=en）：英語は伏字（実綴りを出さない）、日本語は実テキストで全表示', () => {
    const { container } = render(
      <MirrorPlayView segments={bothSegs} segIndex={0} answerSide="en" curPos={3} />,
    )
    const t = container.textContent ?? ''
    // 英語（答え側）の実綴りは打鍵済みでも出さない。伏字マス（●/filled）で描く。
    expect(t).not.toContain('apple')
    expect(t).not.toContain('app')
    expect(container.querySelector('.mch.filled')).not.toBeNull()
    // 日本語は実テキスト（漢字＋ふりがな）で全表示。
    expect(t).toContain('林檎')
  })

  it('both×日本語入力中（typedSide=ja）：日本語が出ず英語が実表示になる不具合を直し、英語＝伏字／日本語＝実表示', () => {
    const { container } = render(
      <MirrorPlayView segments={bothSegs} segIndex={1} answerSide="ja" curPos={2} />,
    )
    const t = container.textContent ?? ''
    // 日本語入力中でも英語の実綴りは一切出さない（本人スクショ#15 の不具合＝英語が実表示、を防ぐ）。
    expect(t).not.toContain('apple')
    // 英語行は伏字マス（英語は入力済み＝全 filled）。
    expect(container.querySelector('.mch.filled')).not.toBeNull()
    // 日本語は実テキストで全表示（マスクしない）。
    expect(t).toContain('林檎')
  })
})
