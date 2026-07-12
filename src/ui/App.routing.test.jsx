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
import { routeFromRawRecord } from '../application/recordDetailRoute.policy.js'
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

// #362 単語の固定範囲（range）の App 配線テスト。純 codec（parseRoute/buildRoute の range）と
// wordRange.service は各 policy テストが担保し、ここは「range URL からの cold 初期化・ステッパー操作での
// URL 反映・level/theme 変更での range 無効化（clamp）」という location/history とアプリ state の配線を検証する。
describe('App 単語固定範囲 URL 配線 (#362)', () => {
  beforeEach(() => {
    cleanup()
    localStorage.clear()
    initMemoryPersistence()
    setPath('/')
  })
  afterEach(() => setPath('/'))

  it('cold /words/1/日常/en/r2 で単語タブが選択され URL に r2 が残る', () => {
    setPath('/words/1/日常/en/r2')
    const { container } = render(<App />)
    expect(selectedTab(container, '単語').className).toMatch(/sel/)
    expect(location.pathname).toBe(canonical('/words/1/日常/en/r2'))
    expect(decodeURIComponent(location.pathname)).toContain('/r2')
  })

  it('範囲ステッパーで範囲を選ぶと URL に r1 が付き、範囲指定なしに戻すと従来 URL へ戻る', () => {
    setPath('/words/1/日常/en')
    const { container } = render(<App />)
    expect(decodeURIComponent(location.pathname)).not.toContain('/r')
    act(() => fireEvent.click(within(container).getByLabelText('次の範囲'))) // 範囲1へ
    expect(decodeURIComponent(location.pathname)).toContain('/r1')
    act(() => fireEvent.click(within(container).getByLabelText('前の範囲'))) // 範囲指定なしへ
    expect(decodeURIComponent(location.pathname)).not.toContain('/r')
  })

  it('テーマ変更で範囲数が減ると range が無効化され URL から消える（clamp）', () => {
    setPath('/words/1/日常/en/r3') // 日常=220語→3範囲（r3 有効）
    const { container } = render(<App />)
    expect(decodeURIComponent(location.pathname)).toContain('/r3')
    // ビジネス=40語→1範囲。r3 は範囲外＝未選択へ丸め、URL から range が消える。
    act(() => fireEvent.click(within(container).getByText('ビジネス')))
    expect(decodeURIComponent(location.pathname)).toContain('ビジネス')
    expect(decodeURIComponent(location.pathname)).not.toContain('/r')
  })
})

// #359 view ルート（about/records/result）の App 配線テスト（characterization / 回帰固定）。
// 純 codec（parseRoute/buildRoute の view 分岐）は routing.policy.test.js が別途担保し、ここは
// 「view URL からの cold 初期化・view への遷移で pushState・戻る（popstate）での復元・cold /result の
// TOP 丸め」という location/history とアプリ phase の配線を検証する。BASE は '/'（vite dev と同じ）。
describe('App view ルート配線 (#359)', () => {
  beforeEach(() => {
    cleanup()
    localStorage.clear()
    initMemoryPersistence()
    setPath('/')
  })
  afterEach(() => setPath('/'))

  // menu-bar の trigger を開いてから item を選ぶ（AboutView/AllRecordsView への導線）。
  const openMenuItem = (container, triggerLabel, itemLabel) => {
    const bar = container.querySelector('.menu-bar')
    act(() => fireEvent.click(within(bar).getByText(triggerLabel)))
    act(() => fireEvent.click(within(bar).getByText(itemLabel)))
  }

  it('cold /about で初期化すると「このアプリについて」画面(AboutView)が出る', () => {
    setPath('/about')
    const { container } = render(<App />)
    expect(container.querySelector('.about')).not.toBeNull() // AboutView が描画される
    expect(within(container).getByText('打って、覚える。')).toBeTruthy()
    expect(container.querySelector('.type-tabs')).toBeNull() // TOP(ready) ではない
    expect(location.pathname).toBe('/about') // canonical な view URL のまま
  })

  it('cold /records で初期化すると「すべての記録」画面(AllRecordsView)が出る', () => {
    setPath('/records')
    const { container } = render(<App />)
    expect(container.querySelector('.all-records')).not.toBeNull() // AllRecordsView が描画される
    expect(within(container).getByText('すべての記録')).toBeTruthy() // 一覧の見出し
    expect(container.querySelector('.type-tabs')).toBeNull() // TOP(ready) ではない
    expect(location.pathname).toBe('/records')
  })

  it('cold /result（lastResult 無し）は結果画面でなく TOP(ready) へ丸まり URL も canonical 化される', () => {
    setPath('/result')
    const { container } = render(<App />)
    // lastResult 不在＝結果画面は出さず TOP(ready) を表示（白画面にならない）
    expect(container.querySelector('.type-tabs')).not.toBeNull()
    expect(container.querySelector('.about')).toBeNull()
    expect(container.querySelector('.all-records')).toBeNull()
    // view:'result' の cold ロードは phase ready へ丸め、URL は現在選択の canonical（既定＝root '/'）へ
    expect(location.pathname).toBe('/')
  })

  it('ready からメニューで「このアプリについて」へ遷移すると /about へ pushState され、戻る(popstate)で content 画面へ復帰する', () => {
    const { container } = render(<App />)
    expect(location.pathname).toBe('/') // 初期は単語例文＝root
    const before = window.history.length
    // メニュー導線（onNavigateAbout）で about へ → pushState（戻る/進むが効く）
    openMenuItem(container, '英文・和文タイピング', 'このアプリについて')
    expect(container.querySelector('.about')).not.toBeNull()
    expect(location.pathname).toBe('/about')
    expect(window.history.length).toBe(before + 1)
    // 戻る（履歴の別エントリを模擬）→ popstate で直前の content ルート(root=ready)へ復元
    act(() => {
      window.history.pushState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(container.querySelector('.type-tabs')).not.toBeNull() // TOP(ready) に復帰
    expect(container.querySelector('.about')).toBeNull()
    expect(location.pathname).toBe('/')
  })

  it('深い content ルートから「すべての記録」へ遷移し、戻る(popstate)で直前の content 画面・URL に復帰する', () => {
    setPath('/story/climbing')
    const { container } = render(<App />)
    expect(selectedTab(container, '物語').className).toMatch(/sel/)
    // メニュー導線（onNavigateAllRecords）で allrecords へ → view URL へ pushState
    openMenuItem(container, 'データ', 'すべての記録')
    expect(container.querySelector('.all-records')).not.toBeNull()
    expect(location.pathname).toBe('/records')
    // 戻る → popstate で物語ルート（直前の content 画面・URL）へ復元
    act(() => {
      window.history.pushState(null, '', '/story/climbing')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(selectedTab(container, '物語').className).toMatch(/sel/)
    expect(container.querySelector('.all-records')).toBeNull()
    expect(location.pathname).toBe('/story/climbing')
  })
})

// #360 記録詳細 URL（record-detail）の App 配線テスト（characterization）。純 codec と
// recordDetailRoute.policy（routeFromRawRecord/resolveColdDetail）は各 policy テストが担保し、
// ここは「URL 由来の単一オーバーレイ所有・cold 直開き・行クリックで pushState・戻るで閉じる・
// cold not-found の一覧のみ丸め」という location/history とオーバーレイの配線を検証する。
describe('App 記録詳細 URL 配線 (#360)', () => {
  const wordRec = {
    source: 'word', level: 1, theme: '旅行', mode: 'en',
    speed: 300, accuracy: 95, mistakes: 1, keys: 80, seconds: 60,
    date: '2026/7/4 08:00:00',
  }
  // cold 直開き用の canonical な record-detail パス（BASE='/' なので location.pathname になる）。
  const detailPath = buildRoute(routeFromRawRecord(wordRec, 1))

  beforeEach(() => {
    cleanup()
    localStorage.clear()
    initMemoryPersistence({ wordRecords: { 'L1__旅行__en': [wordRec] } })
    setPath('/')
  })
  afterEach(() => setPath('/'))

  it('cold record-detail URL で初期化すると一覧の上に記録詳細オーバーレイが出る', () => {
    setPath(detailPath)
    const { container } = render(<App />)
    // 下敷きは一覧（allrecords）、その上に RecordDetail（.record-page）が重なる。
    expect(container.querySelector('.all-records')).not.toBeNull()
    expect(container.querySelector('.record-page')).not.toBeNull()
    expect(location.pathname).toBe(detailPath) // URL は detail のまま（潰さない）
  })

  it('cold record-detail の not-found（記録なし）は一覧のみでオーバーレイを出さない（白画面/例外なし）', () => {
    initMemoryPersistence() // 記録を空にする＝resolveColdDetail は null
    setPath(detailPath)
    const { container } = render(<App />)
    expect(container.querySelector('.all-records')).not.toBeNull() // 一覧は出る
    expect(container.querySelector('.record-page')).toBeNull() // モーダルは出さない
  })

  it('一覧の行クリックで detail URL へ pushState されオーバーレイが開く', () => {
    setPath('/records')
    const { container } = render(<App />)
    expect(container.querySelector('.record-page')).toBeNull()
    const before = window.history.length
    act(() => fireEvent.click(within(container).getByText('単語'))) // データ行（単語）をクリック
    expect(container.querySelector('.record-page')).not.toBeNull() // オーバーレイが開く
    expect(location.pathname).toBe(detailPath) // detail URL へ
    expect(window.history.length).toBe(before + 1) // pushState で1エントリ増える
  })

  it('戻る（popstate で detail URL を抜ける）とオーバーレイが閉じる', () => {
    setPath('/records')
    const { container } = render(<App />)
    act(() => fireEvent.click(within(container).getByText('単語')))
    expect(container.querySelector('.record-page')).not.toBeNull()
    // 戻る＝一覧 URL へ（open で積んだエントリを戻す）→ popstate で detailRoute 再計算＝null
    act(() => {
      window.history.pushState(null, '', '/records')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(container.querySelector('.record-page')).toBeNull() // オーバーレイが閉じる
    expect(container.querySelector('.all-records')).not.toBeNull() // 一覧に戻る
  })
})
