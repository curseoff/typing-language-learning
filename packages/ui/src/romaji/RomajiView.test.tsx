// @vitest-environment jsdom
// presenter smoke: プレイ中（予告ストリップ・現在かな強調・かな表）／ミス／完了。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import RomajiView from './RomajiView'

afterEach(cleanup)

const noop = () => {}
const common = {
  levelLabel: 'あ行',
  rowIds: ['a'],
  current: 'し',
  targets: ['し', 'ら', 'り', 'る'],
  index: 0,
  input: 's',
  romaji: 'shi',
  keys: 12,
  liveSpeed: 90,
  mistakes: 2,
  elapsedSec: 18,
  hasError: false,
  onRestart: noop,
  onExit: noop,
}

describe('RomajiView smoke', () => {
  it('プレイ中：メタ・予告ストリップ・かな表を描く', () => {
    const { container } = render(<RomajiView {...common} rowIds={['sa']} finished={false} />)
    expect(container.textContent).toContain('あ行')
    expect(container.textContent).toContain('し')
    // 予告ストリップに複数のかなセルが並ぶ
    expect(container.querySelectorAll('.romaji-cell').length).toBe(common.targets.length)
    // 先頭（現在）のセルが強調される
    expect(container.querySelector('.romaji-cell.current')).not.toBeNull()
    // かな表のセルが描画され、現在かなのセルがハイライトされる
    expect(container.querySelectorAll('.kana-cell').length).toBeGreaterThan(0)
    expect(container.querySelector('.kana-cell.cur')).not.toBeNull()
  })

  it('ミス：現在セルのローマ字に rerr が付く', () => {
    const { container } = render(
      <RomajiView {...common} rowIds={['sa']} finished={false} hasError={true} />,
    )
    // 誤りは現在セルの per-char .rerr（現在打つ文字）で表現する。
    expect(container.querySelector('.romaji-cell.current .rerr')).not.toBeNull()
  })

  it('完了：かな数と完了カードを描く', () => {
    const { container } = render(<RomajiView {...common} finished={true} />)
    expect(container.textContent).toContain('完了')
    expect(container.textContent).toContain('かな数')
  })
})
