// @vitest-environment jsdom
// #439 対戦：相手の伏字複製盤面（共有 presenter）の smoke。答え側は伏字マス（実文字を出さない）、
// 非答え側はヒントの実テキスト。見出し語（word）は任意（単語モードは空＝出さない）。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import PlayMirrorView from './PlayMirrorView.presenter'
import type { MaskBoardCell } from './MaskBoard.presenter'

afterEach(cleanup)

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

describe('PlayMirrorView smoke', () => {
  it('en モード：見出し語＋ヒント（日本語）を実テキストで描き、答え側（英語）は伏字マス', () => {
    const { container } = render(
      <PlayMirrorView
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
    // PlayMeta/StatsRow は持たない（上部の独立ヘッダバーへ集約）。
    expect(container.querySelector('.play-meta')).toBeNull()
    expect(container.querySelector('.progress-bar')).toBeNull()
  })

  it('ja モード：見出し和訳は隠し（答えになるため）、ヒント（英語）を実テキストで描く', () => {
    const { container } = render(
      <PlayMirrorView
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

  it('単語モード：見出し語なし（word 空）でも答え側の伏字マスを描く', () => {
    const { container } = render(
      <PlayMirrorView answerSide="en" hint={{ side: 'ja', text: 'りんご' }} cells={cellsFor([5], 2)} />,
    )
    // 見出し（seg-word）は出さない。
    expect(container.querySelector('.seg-word')).toBeNull()
    expect(container.querySelector('.vs-mb')).not.toBeNull()
    expect(container.textContent).toContain('りんご')
  })
})
