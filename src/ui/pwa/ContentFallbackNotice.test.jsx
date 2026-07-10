// @vitest-environment jsdom
// ContentFallbackNotice の結合テスト：発生前は非表示・発生後に表示・「閉じる」で消える。
// role="status" を持つことも確認する。counts はモジュール共有のため vi.resetModules で隔離し、
// 各ケースが初期状態（未発生）から始まるようにする。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// contentFallback を隔離した新規インスタンスで読み込み、対の Notice も同じインスタンスに束ねる。
async function loadIsolated() {
  vi.resetModules()
  const content = await import('../../content/contentFallback.js')
  const mod = await import('./ContentFallbackNotice.container.jsx')
  return { record: content.recordContentFallback, Notice: mod.default }
}

describe('ContentFallbackNotice', () => {
  it('フォールバック未発生では何も表示しない', async () => {
    const { Notice } = await loadIsolated()
    render(<Notice />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('フォールバック発生後に告知を表示し role="status" を持つ', async () => {
    const { record, Notice } = await loadIsolated()
    render(<Notice />)
    act(() => record('words', new Error('boom')))
    const notice = screen.getByRole('status')
    expect(notice).toBeInTheDocument()
    expect(notice).toHaveTextContent('一部の教材を簡易表示しています')
  })

  it('「閉じる」で消える', async () => {
    const { record, Notice } = await loadIsolated()
    render(<Notice />)
    act(() => record('dict', new Error('boom')))
    expect(screen.getByRole('status')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('閉じる'))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
