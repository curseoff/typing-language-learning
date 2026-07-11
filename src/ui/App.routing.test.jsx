// @vitest-environment jsdom
// #357 パス型ルーティングの App 配線テスト：深いパスからの初期化・タブ切替の pushState・
// popstate での復元を自動確認する。純 codec（parseRoute/buildRoute）は routing.policy.test.js が
// 別途担保しており、ここは「location/history とアプリ state の配線」を検証する。
// テスト環境の BASE_URL は '/'（vite dev と同じ）＝深いパスは先頭からの絶対パスで表す。
// canonical パスは codec が全 param を必ず出す形（既定 ec のみ省略）なので、期待値は buildRoute で導く。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent, within, act } from '@testing-library/react'
import App from '../App.jsx'
import { parseRoute, buildRoute } from '../application/routing.policy.js'
import { initMemoryPersistence } from '../application/records.service.js'

const setPath = (p) => window.history.replaceState(null, '', p)
// 種類タブ（.type-tabs 内）で label のタブ要素を取り、選択状態（sel/sel-focus）かを見る
const selectedTab = (container, label) =>
  within(container.querySelector('.type-tabs')).getByText(label).closest('.type-tab')
// codec が返す canonical な app 相対パス（BASE='/' なのでそのまま location.pathname になる）
const canonical = (appPath) => buildRoute(parseRoute(appPath))

describe('App パス型ルーティング配線 (#357)', () => {
  beforeEach(() => {
    cleanup()
    localStorage.clear()
    initMemoryPersistence()
    setPath('/')
  })
  afterEach(() => setPath('/'))

  it('深いパスで初期化：/words/2 で単語タブが選択され canonical に正規化される', () => {
    setPath('/words/2')
    const { container } = render(<App />)
    expect(selectedTab(container, '単語').className).toMatch(/sel/)
    // 欠落 param は既定補完され、非 canonical な入力は canonical へ replaceState される
    expect(location.pathname).toBe(canonical('/words/2'))
    expect(decodeURIComponent(location.pathname).startsWith('/words/2')).toBe(true)
  })

  it('base 直下では旧 ?tab= を後方互換で参照して該当タブへ復元し search を温存する', () => {
    setPath('/?tab=romaji')
    const { container } = render(<App />)
    expect(selectedTab(container, 'ローマ字入力').className).toMatch(/sel/)
    expect(location.pathname.startsWith('/romaji')).toBe(true) // path は canonical 化
    expect(location.search).toBe('?tab=romaji') // ?preview/?persist と同様に search は温存
  })

  it('タブ切替で pushState（履歴が増える）され、popstate で別ルートへ復元される', () => {
    const { container } = render(<App />)
    expect(location.pathname).toBe('/') // 初期は単語例文＝root
    const before = window.history.length
    // 単語タブへ切替 → pushState（戻る/進むが効く）
    act(() => fireEvent.click(within(container.querySelector('.type-tabs')).getByText('単語')))
    expect(window.history.length).toBe(before + 1)
    expect(location.pathname).toBe(canonical('/words'))
    // 戻る（履歴の別エントリを模擬）→ popstate で物語ルートへ復元
    act(() => {
      window.history.pushState(null, '', '/story/climbing')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(selectedTab(container, '物語').className).toMatch(/sel/)
    expect(location.pathname).toBe('/story/climbing') // 復元後の書き戻しで崩れない
  })

  it('同一ページ内の param 変更は replaceState（履歴を汚さずアドレスバーは追従）', () => {
    const { container } = render(<App />)
    const before = window.history.length
    // 単語例文でレベル L2 を選ぶ → replace（同一ページ）
    fireEvent.click(within(container).getByText('L2', { exact: false }))
    expect(location.pathname).toBe(canonical('/sentences/2'))
    expect(window.history.length).toBe(before) // push されていない＝履歴が増えない
  })
})
