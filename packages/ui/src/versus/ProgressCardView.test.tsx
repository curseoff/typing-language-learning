// @vitest-environment jsdom
// presenter smoke（#432）：進捗カードが代表 props で主要な値を描くことを確かめる。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import ProgressCardView from './ProgressCardView.presenter'

afterEach(cleanup)

describe('ProgressCardView smoke', () => {
  it('自分：3 枠の数値と正解問題数を描く（#439 時間枠は撤去）', () => {
    const { container } = render(
      <ProgressCardView id="03ecf8d2-1111" self typed={128} speed={312} mistakes={4} correct={7} />,
    )
    const t = container.textContent ?? ''
    expect(t).toContain('あなた（03ecf8d2）')
    expect(t).toContain('128') // タイピング数
    expect(t).toContain('312') // 速度
    expect(t).toContain('正解問題数')
    expect(t).toContain('7')
    // #439 時間枠は撤去（カードに「時間」ラベルを出さない＝progressバーへ集約）。
    expect(t).not.toContain('時間')
    expect(container.querySelectorAll('.vs-card-stat')).toHaveLength(3)
  })

  it('相手：name を主見出しにし、短縮 ID を併記する', () => {
    const { container } = render(
      <ProgressCardView
        id="77bd90ac-2222"
        name="ゲスト"
        self={false}
        typed={96}
        speed={240}
        mistakes={9}
        correct={5}
      />,
    )
    const t = container.textContent ?? ''
    expect(t).toContain('ゲスト')
    expect(t).toContain('相手（77bd90ac）')
  })

  it('lives 指定でハートを残数ぶん描く（undefined なら非表示）', () => {
    const { container, rerender } = render(
      <ProgressCardView id="a" self typed={0} speed={0} mistakes={0} correct={0} lives={3} />,
    )
    expect(container.querySelectorAll('.vs-heart')).toHaveLength(3)

    rerender(<ProgressCardView id="a" self typed={0} speed={0} mistakes={0} correct={0} />)
    expect(container.querySelectorAll('.vs-heart')).toHaveLength(0)
  })
})
