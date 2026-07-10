// @vitest-environment jsdom
// presenter smoke（#233 M7）: parts.tsx の各部品。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ModeButtons, SectionLabel, BottomTabs, StartRow } from './parts.presenter'

afterEach(cleanup)

const noop = () => {}
const modes = [
  { key: 'both', label: '英語・日本語' },
  { key: 'en', label: '英語' },
  { key: 'ja', label: '日本語' },
]

describe('ready/parts smoke', () => {
  it('ModeButtons（選択/非フォーカス）', () => {
    render(<ModeButtons modes={modes} value="both" onChange={noop} focused={true} />)
    const { container } = render(<ModeButtons modes={modes} value="en" onChange={noop} focused={false} />)
    expect(container.textContent).toContain('英語')
  })
  it('SectionLabel', () => {
    const { container } = render(<SectionLabel>レベル</SectionLabel>)
    expect(container.textContent).toContain('レベル')
  })
  it('BottomTabs', () => {
    render(<BottomTabs value="records" onChange={noop} focused={true} />)
    const { container } = render(<BottomTabs value="list" onChange={noop} focused={false} />)
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0)
  })
  it('StartRow', () => {
    const { container } = render(<StartRow onStart={noop} />)
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0)
  })
})
