// @vitest-environment jsdom
// presenter smoke（#432）：盤面が人数ぶんのカードを並べ、終了状態でバッジを出し分けることを確かめる。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import VersusBoardView from './VersusBoardView.presenter'
import type { ProgressCardData } from './ProgressCardView.presenter'

afterEach(cleanup)

const SELF_ID = '03ecf8d2-1111'
const PEER_ID = '77bd90ac-2222'
const members: ProgressCardData[] = [
  { id: SELF_ID, self: true, typed: 128, speed: 312, mistakes: 4, elapsedSec: 42, correct: 7 },
  { id: PEER_ID, self: false, typed: 96, speed: 240, mistakes: 9, elapsedSec: 42, correct: 5 },
]

describe('VersusBoardView smoke', () => {
  it('進行中：人数ぶんのカードを並べ、勝敗バッジは出さない', () => {
    const { container } = render(<VersusBoardView members={members} />)
    expect(container.querySelectorAll('.vs-card')).toHaveLength(2)
    expect(container.querySelector('.vs-board-badge')).toBeNull()
  })

  it('勝者確定：単独勝者を短縮 ID バッジで強調', () => {
    const { container } = render(<VersusBoardView members={members} finished winners={[SELF_ID]} />)
    const t = container.textContent ?? ''
    expect(t).toContain('勝者（03ecf8d2）')
    expect(container.querySelector('.vs-board-winner')).not.toBeNull()
  })

  it('ドロー：勝者複数はドローバッジ', () => {
    const { container } = render(
      <VersusBoardView members={members} finished winners={[SELF_ID, PEER_ID]} />,
    )
    expect(container.textContent).toContain('ドロー')
    expect(container.querySelector('.vs-board-draw')).not.toBeNull()
  })
})
