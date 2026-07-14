// @vitest-environment jsdom
// #364 英英の固定範囲セレクタ（共有 RangeStepper）の UI テスト。範囲別ラベル・記録表示（rankText の
// 範囲サフィックス）の配線を固定する。ステッパーの端挙動は WordsSection.test が共有部品として担保。
//
// #404 実データ（dictionaryData.js は jaWords 付与で約6MB・wordsData.js 1.6MB 等）を実 import すると、
// 「収録一覧タブ＋範囲指定」テストが英英＋単語を遅延ロードし、CI の coverage 計装＋並列下で 5秒
// タイムアウト（フレーキー）した（#396 で App.range.test に適用済みと同手法）。ここでは container が
// 呼ぶローダ関数（loadDict/loadWords）だけを小さなフィクスチャへ vi.mock でスタブし、決定的かつ高速に
// する。定数（DICT_COUNTS 等）は importActual で実物を維持＝範囲数「7」等は実定数のまま検証する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, within, waitFor } from '@testing-library/react'
import DictSection from './DictSection.container.jsx'
import { initMemoryPersistence } from '../../application/records.service.js'

// --- フィクスチャ（level1・theme=日常 の最小データ。件数は少なくてよい＝該当テストは
// 「読み込み中…」が消えることだけを assert する）------------------------------------------------
const fx = vi.hoisted(() => {
  // loadWords(1) の返り値形＝{en, ja, kana, level, theme, freq}（wordsData.js 実データに準拠）。
  const WORDS = [
    { en: 'water', ja: '水', kana: 'みず', level: 1, theme: '日常', freq: 1 },
    { en: 'friend', ja: '友達', kana: 'ともだち', level: 1, theme: '日常', freq: 2 },
    { en: 'house', ja: '家', kana: 'いえ', level: 1, theme: '日常', freq: 3 },
  ]
  // loadDict(1) の返り値形＝{word, def, ja, kana, level, theme}（dictionaryData.js 実データに準拠）。
  const DICT = [
    { word: 'water', def: 'a clear liquid that people drink', ja: '人が飲む透明な液体', kana: 'ひとがのむとうめいなえきたい', level: 1, theme: '日常' },
    { word: 'friend', def: 'a person you like and trust', ja: '好きで信頼する人', kana: 'すきでしんらいするひと', level: 1, theme: '日常' },
    { word: 'house', def: 'a building where a family lives', ja: '家族が住む建物', kana: 'かぞくがすむたてもの', level: 1, theme: '日常' },
  ]
  return { WORDS, DICT }
})

// 重いローダ関数だけ差し替え、container が import する定数（DICT_COUNTS/DICT_MODES/
// DICT_AVAILABLE_LEVELS 等）は実物を維持する（範囲数「7」= DICT_COUNTS[1]['日常']=639 に依存）。
vi.mock('../../content/words.js', async () => {
  const actual = await vi.importActual('../../content/words.js')
  return { ...actual, loadWords: vi.fn(async () => fx.WORDS) }
})
vi.mock('../../content/dictionary.js', async () => {
  const actual = await vi.importActual('../../content/dictionary.js')
  return { ...actual, loadDict: vi.fn(async () => fx.DICT) }
})

const noop = () => {}
const baseProps = {
  dictLevel: 1,
  dictTheme: '日常', // DICT_COUNTS[1]['日常'] = 639 → 範囲数 7
  dictMode: 'quiz',
  dictRange: null,
  onDictLevelChange: noop,
  onDictThemeChange: noop,
  onDictModeChange: noop,
  onDictRangeChange: noop,
  focusSection: 'level',
  onFocusSection: noop,
  bottomTab: 'records',
  onBottomTabChange: noop,
  onStart: noop,
  endCondition: { kind: 'time', value: 60 },
  onEndConditionChange: noop,
}

const stepper = (container) => container.querySelector('.range-stepper')

describe('DictSection 範囲ステッパー (#364)', () => {
  beforeEach(() => {
    cleanup()
    initMemoryPersistence()
  })
  afterEach(cleanup)

  it('既定は「範囲指定なし（全体）」で位置は — / 7（639語→7範囲）', () => {
    const { container } = render(<DictSection {...baseProps} />)
    const s = stepper(container)
    expect(within(s).getByText(/範囲指定なし/)).toBeTruthy()
    expect(within(s).getByText('— / 7')).toBeTruthy()
  })

  it('▶ で範囲1へ（onDictRangeChange(1)）', () => {
    let picked = 'unset'
    const { container } = render(
      <DictSection {...baseProps} onDictRangeChange={(r) => (picked = r)} />,
    )
    fireEvent.click(within(stepper(container)).getByLabelText('次の範囲'))
    expect(picked).toBe(1)
  })

  it('範囲選択中はラベルを「語」単位で表示し位置も範囲別になる', () => {
    const { container } = render(<DictSection {...baseProps} dictRange={1} />)
    const s = stepper(container)
    expect(within(s).getByText('1-100 語')).toBeTruthy()
    expect(within(s).getByText('1 / 7')).toBeTruthy()
  })

  it('収録一覧タブ＋範囲指定で該当範囲の英英を読み込んで表示する（freq 結合）', async () => {
    const { container } = render(<DictSection {...baseProps} bottomTab="list" dictRange={1} />)
    // range 時は英英＋単語(freqMap)を遅延ロード＝はじめは「読み込み中…」。
    expect(within(container).getByText('読み込み中…')).toBeTruthy()
    await waitFor(() => expect(within(container).queryByText('読み込み中…')).toBeNull(), { timeout: 5000 })
  })
})
