// @vitest-environment jsdom
// presenter smoke（#439）：盤面複製が「見出し語ヘッダ＋ヒント実テキスト＋答え側伏字マス」を描き、
// 答え側の実テキストは出さないこと・ja モードでは見出し和訳を隠すことを確かめる。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import MirrorBoardView from './MirrorBoardView.presenter'
import type { MaskBoardCell } from './MaskBoard.presenter'

afterEach(cleanup)

function cellsFor(shape: number[], curPos: number): MaskBoardCell[] {
  const sum = shape.reduce((a, b) => a + b, 0)
  const filled = Math.max(0, Math.min(curPos, sum))
  const out: MaskBoardCell[] = []
  let idx = 0
  shape.forEach((len, wi) => {
    if (wi > 0) out.push({ kind: 'space', miss: false })
    for (let i = 0; i < len; i += 1) {
      out.push({ kind: idx < filled ? 'filled' : 'pending', miss: false })
      idx += 1
    }
  })
  return out
}

describe('MirrorBoardView smoke', () => {
  it('en モード：見出し語＋和訳ヘッダ・日本語ヒントは実テキスト・英語行は伏字マス', () => {
    const { container } = render(
      <MirrorBoardView
        word="apple"
        wordJa="りんご"
        answerSide="en"
        hint={{ side: 'ja', text: '果物の一種' }}
        cells={cellsFor([2, 4, 4], 3)}
      />,
    )
    const t = container.textContent ?? ''
    expect(t).toContain('apple') // 見出し語
    expect(t).toContain('りんご') // 見出し和訳（en モードは表示）
    expect(t).toContain('果物の一種') // 日本語ヒントは実テキスト
    // 答え側（英語）は伏字マスで、定義の綴りは出さない。
    expect(container.querySelector('.vs-mb')).not.toBeNull()
  })

  it('ja モード：見出し和訳を隠し、英語ヒントは実テキスト・日本語行は伏字マス', () => {
    const { container } = render(
      <MirrorBoardView
        word="sun"
        answerSide="ja"
        hint={{ side: 'en', text: 'the star of the day' }}
        cells={cellsFor([4], 2)}
      />,
    )
    const t = container.textContent ?? ''
    expect(t).toContain('sun') // 見出し語は出す
    expect(t).not.toContain('（') // 和訳（括弧）は出さない＝答えが和訳のため
    expect(t).toContain('the star of the day') // 英語ヒントは実テキスト
    expect(container.querySelector('.vs-mb')).not.toBeNull()
  })

  it('日本語ヒントの kana でルビ（rt）が付く（読み補助・答え側ではない）', () => {
    const { container } = render(
      <MirrorBoardView
        word="太陽"
        answerSide="en"
        hint={{ side: 'ja', text: '太陽', kana: 'たいよう' }}
        cells={cellsFor([3], 1)}
      />,
    )
    expect(container.querySelector('rt')).not.toBeNull()
  })

  it('hint 無し（VO が落とした）でも答え側の伏字マスは描く', () => {
    const { container } = render(
      <MirrorBoardView word="apple" wordJa="りんご" answerSide="en" cells={cellsFor([5], 1)} />,
    )
    expect(container.querySelector('.vs-mb')).not.toBeNull()
    expect(container.textContent).toContain('apple')
  })
})
