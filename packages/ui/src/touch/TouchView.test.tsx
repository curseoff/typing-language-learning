// @vitest-environment jsdom
// presenter smoke（#233 M7）: プレイ中/ミス/完了。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import TouchView from './TouchView'

afterEach(cleanup)

const noop = () => {}
const common = {
  showTarget: true,
  typedKeys: 42,
  liveSpeed: 180,
  mistakes: 3,
  elapsedSec: 24,
  hasError: false,
  wrongKey: null,
  pressed: { key: null, tick: 0 },
  onRestart: noop,
  onExit: noop,
}
const targets = ['f', 'j', 'd', 'k', 's', 'l', 'a']

describe('TouchView smoke', () => {
  it('プレイ中', () => {
    const { container } = render(
      <TouchView levelLabel="ホームポジション" modeLabel="やさしい" targets={targets} index={2} target="d" finished={false} {...common} />,
    )
    expect(container.textContent).toContain('ホームポジション')
  })
  it('ミス', () => {
    render(
      <TouchView
        levelLabel="ホームポジション"
        modeLabel="やさしい"
        targets={targets}
        index={2}
        target="d"
        finished={false}
        {...common}
        hasError={true}
        wrongKey="s"
        pressed={{ key: 's', tick: 1, ok: false }}
      />,
    )
  })
  it('完了', () => {
    const { container } = render(
      <TouchView levelLabel="ホームポジション" modeLabel="やさしい" targets={targets} index={7} target="a" finished={true} {...common} />,
    )
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0)
  })
})
