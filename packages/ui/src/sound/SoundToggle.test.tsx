// @vitest-environment jsdom
// presenter smoke（#233 M7）
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import SoundToggle from './SoundToggle.presenter'

afterEach(cleanup)

const noop = () => {}

describe('SoundToggle smoke', () => {
  it('on/muted の双方を描く', () => {
    render(<SoundToggle muted={false} onToggle={noop} />)
    const { container } = render(<SoundToggle muted={true} onToggle={noop} />)
    expect(container.querySelector('button')).toBeTruthy()
  })
})
