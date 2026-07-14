// @vitest-environment jsdom
// #364 英英・単語例文の固定範囲プレイ開始の App 配線テスト。range 選択中に開始すると、App が
// 単語データを遅延ロードして freq 結合し（freqMap／範囲スライス）、該当モードへ遷移することを確認する
// （startDict/startWsent の range 分岐＝location/history 配線とは別の「データ結合＆開始」経路）。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor, within, act } from '@testing-library/react'
import App from '../App.jsx'
import { initMemoryPersistence } from '../application/records.service.js'

const setPath = (p) => window.history.replaceState(null, '', p)
const pressEnter = () =>
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })))

describe('App 固定範囲プレイ開始 (#364)', () => {
  beforeEach(() => {
    cleanup()
    localStorage.clear()
    initMemoryPersistence()
    setPath('/')
  })
  afterEach(() => {
    cleanup()
    setPath('/')
  })

  // #396 遅延ロード（英英/単語データ）→freq 結合→遷移の完了を待つ。CI の coverage 計装＋並列では
  // 実ロードが既定 5000ms を稀に超えてタイムアウト（フレーキー）するため、テスト/waitFor とも余裕を持たせる。
  it('英英を範囲指定して開始すると英英プレイ画面へ遷移する（freqMap 結合経路）', async () => {
    setPath('/dict/1/日常/quiz/r1')
    const { container } = render(<App />)
    expect(selectedTab(container, '英英辞典')).toMatch(/sel/)
    pressEnter() // start → startDict(dictRange=1)＝単語(level1)をロードし freqMap を作る
    // ready(type-tabs) が消え、英英プレイの4択が出る（遅延ロード完了まで待つ）。
    await waitFor(() => expect(container.querySelector('.type-tabs')).toBeNull(), { timeout: 15000 })
  }, 20000)

  it('単語例文を範囲指定して開始すると例文プレイ画面へ遷移する（freq 順スライス経路）', async () => {
    setPath('/sentences/1/日常/both/r1')
    const { container } = render(<App />)
    expect(selectedTab(container, '単語例文')).toMatch(/sel/)
    pressEnter() // start → startWsent(wsentRange=1)＝単語(level1)をロードし freq 順にスライス
    await waitFor(() => expect(container.querySelector('.type-tabs')).toBeNull(), { timeout: 15000 })
  }, 20000)
})

// 種類タブの選択状態クラスを取り出す（App.routing.test と同じ流儀）。
function selectedTab(container, label) {
  return within(container.querySelector('.type-tabs')).getByText(label).closest('.type-tab').className
}
