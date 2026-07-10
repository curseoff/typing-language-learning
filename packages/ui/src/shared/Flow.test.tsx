// @vitest-environment jsdom
// presenter smoke（#233 M7）: wrap/ticker 双方の描画パスを通す。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Flow } from './Flow.presenter'

afterEach(cleanup)

const items = [
  { en: 'Good morning', ja: 'おはよう', kana: 'おはよう' },
  { en: 'How are you?', ja: '元気ですか', kana: 'げんきですか' },
]

describe('Flow smoke', () => {
  it('wrap（英日両方）', () => {
    const { container } = render(
      <Flow items={items} cur={0} enDone={5} jaDone={0} activeRow="en" wrap showEn showJa />,
    )
    expect(container.textContent).toContain('Good morning')
  })
  it('ticker', () => {
    const { container } = render(
      <Flow items={items} cur={0} enDone={5} jaDone={0} activeRow="en" ticker showEn showJa />,
    )
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0)
  })
  it('英語のみ / 日本語入力中', () => {
    render(
      <Flow items={items} cur={0} enDone={5} jaDone={0} activeRow="en" wrap showEn showJa={false} />,
    )
    const { container } = render(
      <Flow
        items={items}
        cur={0}
        enDone={12}
        jaDone={2}
        jaKanaDone={2}
        activeRow="ja"
        wrap
        showEn
        showJa
      />,
    )
    expect(container.textContent).toContain('元気')
  })
})
