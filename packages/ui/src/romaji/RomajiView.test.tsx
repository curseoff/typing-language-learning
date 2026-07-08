// @vitest-environment jsdom
// presenter smoke: プレイ中（現在かね・ローマ字ガイド・かな表）／ミス／完了。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import RomajiView from './RomajiView'

afterEach(cleanup)

const noop = () => {}
const common = {
  levelLabel: 'あ行',
  rowIds: ['a'],
  current: 'し',
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
  it('プレイ中：メタ・現在かな・かな表を描く', () => {
    const { container } = render(<RomajiView {...common} rowIds={['sa']} finished={false} />)
    expect(container.textContent).toContain('あ行')
    expect(container.textContent).toContain('し')
    // かな表のセルが描画される
    expect(container.querySelectorAll('.kana-cell').length).toBeGreaterThan(0)
    // 現在かなのセルがハイライトされる
    expect(container.querySelector('.kana-cell.cur')).not.toBeNull()
  })

  it('ミス：ガイドの現在文字に rerr が付く', () => {
    const { container } = render(
      <RomajiView {...common} rowIds={['sa']} finished={false} hasError={true} />,
    )
    // 誤りは per-char の .rerr（現在打つ文字）で表現する。
    expect(container.querySelector('.romaji-guide .rerr')).not.toBeNull()
  })

  it('完了：かな数と完了カードを描く', () => {
    const { container } = render(<RomajiView {...common} finished={true} />)
    expect(container.textContent).toContain('完了')
    expect(container.textContent).toContain('かな数')
  })
})
