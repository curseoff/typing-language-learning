// @vitest-environment jsdom
// presenter smoke（#439）：伏字マス列を filled/pending/space で描き、答えの文字を出さないことを確かめる。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import MaskBoard, { type MaskBoardCell } from './MaskBoard.presenter'

afterEach(cleanup)

// shape を curPos 個 filled・語間 space・残り pending へ展開（domain maskBoardCells 相当の入力を作る）。
function cellsFor(shape: number[], curPos: number, miss = false): MaskBoardCell[] {
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

describe('MaskBoard smoke', () => {
  it('filled/pending/space をマス数どおりに描き、aria-label は「X/Y 文字」（実テキスト無し）', () => {
    const { container } = render(<MaskBoard cells={cellsFor([2, 4, 4], 3)} />)
    // 文字マス総数 = 2+4+4 = 10、うち filled = 3。space は語間 2 個。
    expect(container.querySelectorAll('.vs-mb-filled')).toHaveLength(3)
    expect(container.querySelectorAll('.vs-mb-pending')).toHaveLength(7)
    expect(container.querySelectorAll('.vs-mb-space')).toHaveLength(2)
    const board = container.querySelector('.vs-mb')
    expect(board?.getAttribute('role')).toBe('img')
    expect(board?.getAttribute('aria-label')).toBe('相手の入力 3/10 文字')
  })

  it('miss 中は済みマスに vs-mb-miss クラスを付ける', () => {
    const { container } = render(<MaskBoard cells={cellsFor([5], 2, true)} />)
    expect(container.querySelectorAll('.vs-mb-filled.vs-mb-miss')).toHaveLength(2)
  })

  it('未入力（curPos=0）は全マス pending・filled ゼロ', () => {
    const { container } = render(<MaskBoard cells={cellsFor([5], 0)} />)
    expect(container.querySelectorAll('.vs-mb-filled')).toHaveLength(0)
    expect(container.querySelectorAll('.vs-mb-pending')).toHaveLength(5)
    expect(container.querySelector('.vs-mb')?.getAttribute('aria-label')).toBe('相手の入力 0/5 文字')
  })

  it('マスは記号（●/・）だけで、答えの綴りは一切含まない', () => {
    const { container } = render(<MaskBoard cells={cellsFor([2, 4, 4], 3)} />)
    const text = container.textContent ?? ''
    // 使う文字は ● と ・ と空白のみ（英字・かな・漢字などの実文字を持たない）。
    expect(text.replace(/[●・\s]/g, '')).toBe('')
  })
})
