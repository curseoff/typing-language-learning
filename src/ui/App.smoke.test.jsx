// App のスモークテスト：各モードが「白画面」にならず、開始してプレイ画面が描画されることを自動確認。
// 手作業で全タブをクリックして回る動作確認を肩代わりする。
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
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

  it.each(TABS)('「%s」を選んで開始してもクラッシュせずプレイ画面になる', (label) => {
    const { container } = render(<App />)
    clickTab(container, label)
    start()
    // Ready が外れ、プレイ画面（.game か .story-*）が出ている＝白画面でない
    expect(container.querySelector('.ready')).toBeNull()
    expect(container.querySelector('.game, .story-prompt, .story-en')).not.toBeNull()
  })

  it('単語例文を開始すると例文の打鍵画面（「単語例文 L1」バッジ）が出る', () => {
    const { container } = render(<App />)
    clickTab(container, '単語例文')
    start()
    expect(screen.getByText(/単語例文 L1/)).toBeInTheDocument()
  })

  it('レベル選択（↑↓相当のボタン）でプールが切り替わる：単語例文 L2 を選べる', () => {
    const { container } = render(<App />)
    clickTab(container, '単語例文')
    // 語レベル L2 のボタンをクリック
    fireEvent.click(within(container).getByText('L2', { exact: false }))
    start()
    expect(screen.getByText(/単語例文 L2/)).toBeInTheDocument()
  })
})
