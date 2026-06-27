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

  it.each(TABS)(
    '「%s」を選んで開始してもクラッシュせずプレイ画面になる',
    async (label) => {
      const { container } = render(<App />)
      clickTab(container, label)
      start()
      // Ready が外れ、プレイ画面（.game か物語 .story）が出ている＝白画面でない
      // 単語/単語例文は対象データを遅延 import するため、CI遅延を見込んで待つ
      await waitFor(
        () => {
          expect(container.querySelector('.ready')).toBeNull()
          expect(container.querySelector('.game, .story')).not.toBeNull()
        },
        { timeout: 8000 },
      )
    },
    15000,
  )

  const badgeText = (container) => container.querySelector('.meta-badge.rank')?.textContent

  it('単語例文を開始すると例文の打鍵画面（「単語例文 L1」バッジ）が出る', async () => {
    const { container } = render(<App />)
    clickTab(container, '単語例文')
    start()
    await waitFor(() => expect(badgeText(container)).toMatch(/単語例文 L1/), { timeout: 8000 })
  })

  it('物語タブでクライミングを選んで開始するとそのタイトルのバッジが出る', async () => {
    const { container } = render(<App />)
    clickTab(container, '物語')
    fireEvent.click(within(container).getByText('クライミング', { exact: false }))
    start()
    await waitFor(() => expect(badgeText(container)).toMatch(/クライミング/), { timeout: 8000 })
  })

  it('レベル選択で別レベルを選べる：単語例文 L2', async () => {
    const { container } = render(<App />)
    clickTab(container, '単語例文')
    fireEvent.click(within(container).getByText('L2', { exact: false }))
    start()
    await waitFor(() => expect(badgeText(container)).toMatch(/単語例文 L2/), { timeout: 8000 })
  })

  it('↑↓で行フォーカス、←→で行内の選択が動く', () => {
    const { container } = render(<App />)
    const tabs = container.querySelector('.type-tabs')
    // 初期は種類行フォーカス＝種類タブが青枠(sel-focus)
    expect(tabs.querySelector('.type-tab.sel-focus')).not.toBeNull()
    // ↓：フォーカスが下の行へ → 種類の選択は青背景(sel)に変わる
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(tabs.querySelector('.type-tab.sel-focus')).toBeNull()
    expect(tabs.querySelector('.type-tab.sel')).not.toBeNull()
    // ↑：種類行へ戻る
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(tabs.querySelector('.type-tab.sel-focus')).not.toBeNull()
    // ←→：種類行内で選択（種類タブ）が移動する
    const before = tabs.querySelector('.type-tab.sel-focus').textContent
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(tabs.querySelector('.type-tab.sel-focus').textContent).not.toBe(before)
  })
})
