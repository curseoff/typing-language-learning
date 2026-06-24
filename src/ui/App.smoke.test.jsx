// @vitest-environment jsdom
// App のスモークテスト：各モードが「白画面」にならず、開始してプレイ画面が描画されることを自動確認。
// 手作業で全タブをクリックして回る動作確認を肩代わりする。
// ※ 単語例文(wsent)はレベル別の例文を遅延 import してから開始するため、waitFor で非同期に待つ。
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react'
import App from '../App.jsx'

const TABS = ['物語', '単語', '単語例文', '英英辞典', 'タッチタイピング']

// タブ列(.type-tabs)の中だけでラベルを探す（dev パネル等の同名要素と衝突しないように）
const clickTab = (container, label) => {
  const tabs = container.querySelector('.type-tabs')
  fireEvent.click(within(tabs).getByText(label))
}
const start = () => fireEvent.click(screen.getByRole('button', { name: 'スタート' }))

describe('App スモーク', () => {
  beforeEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('トップ画面が描画され、全タブが並ぶ', () => {
    const { container } = render(<App />)
    expect(screen.getByText('英文・和文タイピング')).toBeInTheDocument()
    const tabs = container.querySelector('.type-tabs')
    for (const t of TABS) expect(within(tabs).getByText(t)).toBeInTheDocument()
  })

  it.each(TABS)('「%s」を選んで開始してもクラッシュせずプレイ画面になる', async (label) => {
    const { container } = render(<App />)
    clickTab(container, label)
    start()
    // Ready が外れ、プレイ画面（.game か .story-*）が出ている＝白画面でない（wsentは非同期）
    await waitFor(() => {
      expect(container.querySelector('.ready')).toBeNull()
      expect(container.querySelector('.game, .story-prompt, .story-en')).not.toBeNull()
    })
  })

  const badgeText = (container) => container.querySelector('.meta-badge.rank')?.textContent

  it('単語例文を開始すると例文の打鍵画面（「単語例文 L1」バッジ）が出る', async () => {
    const { container } = render(<App />)
    clickTab(container, '単語例文')
    start()
    await waitFor(() => expect(badgeText(container)).toMatch(/単語例文 L1/))
  })

  it('レベル選択で別レベルを選べる：単語例文 L2', async () => {
    const { container } = render(<App />)
    clickTab(container, '単語例文')
    fireEvent.click(within(container).getByText('L2', { exact: false }))
    start()
    await waitFor(() => expect(badgeText(container)).toMatch(/単語例文 L2/))
  })
})
