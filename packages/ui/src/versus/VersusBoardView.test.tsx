// @vitest-environment jsdom
// presenter smoke（#432）：盤面が人数ぶんのカードを並べ、順位は各カード内に出す（上部バッジは廃止）ことを確かめる。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import VersusBoardView from './VersusBoardView.presenter'
import type { ProgressCardData } from './ProgressCardView.presenter'

afterEach(cleanup)

const SELF_ID = '03ecf8d2-1111'
const PEER_ID = '77bd90ac-2222'
const members: ProgressCardData[] = [
  { id: SELF_ID, self: true, typed: 128, speed: 312, mistakes: 4, correct: 7 },
  { id: PEER_ID, self: false, typed: 96, speed: 240, mistakes: 9, correct: 5 },
]

describe('VersusBoardView smoke', () => {
  it('進行中：人数ぶんのカードを並べ、順位バッジは出さない', () => {
    const { container } = render(<VersusBoardView members={members} />)
    expect(container.querySelectorAll('.vs-card')).toHaveLength(2)
    expect(container.querySelector('.vs-card-rank')).toBeNull()
    expect(container.querySelector('.vs-board-badge')).toBeNull()
  })

  it('順位確定：各カード内に順位バッジを出す（上部の勝者バッジは廃止）', () => {
    const ranked = members.map((m) => ({ ...m, finished: true, rank: m.id === SELF_ID ? 1 : 2 }))
    const { container } = render(<VersusBoardView members={ranked} />)
    const ranks = container.querySelectorAll('.vs-card-rank')
    expect(ranks).toHaveLength(2)
    expect(container.textContent).toContain('1位')
    expect(container.textContent).toContain('2位')
    // 上部の勝者/ドローバッジは廃止されている
    expect(container.querySelector('.vs-board-badge')).toBeNull()
  })

  it('同点：同順位（両者1位）を各カードに出す', () => {
    const draw = members.map((m) => ({ ...m, finished: true, rank: 1 }))
    const { container } = render(<VersusBoardView members={draw} />)
    const ranks = Array.from(container.querySelectorAll('.vs-card-rank')).map((n) => n.textContent)
    expect(ranks).toEqual(['1位', '1位'])
  })
})
