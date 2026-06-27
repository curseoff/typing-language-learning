// @vitest-environment jsdom
// App のスモークテスト：各モードが「白画面」にならず、開始してプレイ画面が描画されることを自動確認。
// 手作業で全タブをクリックして回る動作確認を肩代わりする。
// ※ 単語例文(wsent)はレベル別の例文を遅延 import してから開始するため、waitFor で非同期に待つ。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within, waitFor, act } from '@testing-library/react'
import App from '../App.jsx'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.js'

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

  it('単語例文でテーマ「日常」を選んで開始してもプレイ画面になる（絞り込み）', async () => {
    const { container } = render(<App />)
    clickTab(container, '単語例文')
    // テーマ行の「日常」ボタン（種類タブ外）をクリック
    fireEvent.click(within(container).getByRole('button', { name: '日常' }))
    start()
    await waitFor(() => expect(badgeText(container)).toMatch(/単語例文 L1/), { timeout: 8000 })
  })

  it('単語例文でテーマを変えると収録件数の表示が変わる', async () => {
    const { container } = render(<App />)
    clickTab(container, '単語例文')
    const poolText = () =>
      [...container.querySelectorAll('.pool-count')].map((n) => n.textContent).join(' ')
    await waitFor(() => expect(poolText()).toMatch(/収録: \d+ 文/))
    const allText = poolText()
    fireEvent.click(within(container).getByRole('button', { name: 'ビジネス' }))
    await waitFor(() => expect(poolText()).not.toBe(allText))
    expect(poolText()).toMatch(/収録: \d+ 文/)
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

  it('タッチタイピングを数打したあと60秒で完了し記録ランキングに保存される', () => {
    // 60秒制：時間経過をシミュレートして完了させるため、このテストだけ fake timer を使う。
    vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] })
    try {
      const { container } = render(<App />)
      clickTab(container, 'タッチタイピング')
      start()
      // 現在ターゲット（ストリップの現在キー）を読み、正しいキーを何打か送る
      for (let i = 0; i < 20; i++) {
        if (container.querySelector('.result')) break
        const cur = container.querySelector('.strip-key.current')
        if (!cur) break
        act(() => {
          fireEvent.keyDown(window, { key: cur.textContent.trim().toLowerCase() })
        })
        act(() => vi.advanceTimersByTime(10))
      }
      // 最初の打鍵から60秒経過で完了
      act(() => vi.advanceTimersByTime(TIME_LIMIT_MS + 200))
      act(() => vi.runOnlyPendingTimers())
      expect(container.querySelector('.result')).not.toBeNull() // 完了画面
      // home/easy のキーに記録が積まれている
      const recs = JSON.parse(localStorage.getItem('typing-records-v3') || '{}')
      expect(recs['easy__touchhome']?.length ?? 0).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
