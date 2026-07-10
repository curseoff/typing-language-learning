// @vitest-environment jsdom
// presenter smoke（#233 M7）
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import Keyboard from './Keyboard.presenter'

afterEach(cleanup)

describe('Keyboard smoke', () => {
  it('ハイライト/ブラインド/ミス', () => {
    render(<Keyboard target="f" hasError={false} showTarget={true} />)
    render(<Keyboard target="j" hasError={false} showTarget={false} />)
    const { container } = render(
      <Keyboard target="d" hasError={true} wrongKey="s" pressed={{ key: 's', tick: 1 }} showTarget={true} />,
    )
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0)
  })
})
