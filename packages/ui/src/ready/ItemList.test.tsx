// @vitest-environment jsdom
// presenter smoke（#233 M7）: 単語/辞書/クイズの各一覧。
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import ItemList from './ItemList'

afterEach(cleanup)

const words = [
  { en: 'dictionary', ja: '辞書', freq: 1200 },
  { en: 'picture', ja: '写真', freq: 800 },
  { en: 'travel', ja: '旅行', freq: 500 },
]
const dicts = [
  { word: 'dictionary', def: 'a book that lists words and their meanings', ja: '辞書' },
  { word: 'picture', def: 'a painting, drawing, or photograph', ja: '写真' },
]

describe('ItemList smoke', () => {
  it('単語一覧', () => {
    const { container } = render(<ItemList items={words} type="words" mode="normal" />)
    expect(container.textContent).toContain('dictionary')
  })
  it('英英一覧', () => {
    const { container } = render(<ItemList items={dicts} type="dict" mode="normal" />)
    expect(container.textContent).toContain('辞書')
  })
  it('クイズモード', () => {
    const { container } = render(<ItemList items={words} type="words" mode="quiz" />)
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0)
  })
})
