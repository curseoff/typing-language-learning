// @vitest-environment jsdom
// #450 収録一覧が「通常プレイ＋対戦」の学習統計を合算して見せることの仕様テスト（読み出し側）。
// 統計は書き込み側で通常 id（'w:...'）と対戦 id（'vw:...'）に分けて積まれる。分けて持つのは
// solo の苦手判断に対戦の打鍵を混ぜないためだが、収録一覧は「その問題をどれだけ練習したか」を
// 見せる場所なので、表示は両方を足した1つの値になる。
// 併せて「どちらにも記録が無い問題は従来どおり未練習のまま」＝見た目の回帰が無いことを固定する。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup, within } from '@testing-library/react'
import ItemList from './ItemList.container.jsx'
import { initMemoryPersistence } from '../../application/records.service.js'

const items = [
  { en: 'apple', ja: 'りんご' },
  { en: 'banana', ja: 'バナナ' },
]

// 収録一覧の各行の統計欄テキスト（'未練習' or '練習 N回 …'）。
const statTexts = (container) =>
  [...container.querySelectorAll('.bi-stat')].map((el) => el.textContent)

const rowOf = (container, en) =>
  [...container.querySelectorAll('.browse-item')].find((li) => within(li).queryByText(en))

beforeEach(cleanup)
afterEach(cleanup)

describe('ItemList container の統計合算 (#450)', () => {
  it('通常プレイと対戦の両方に記録がある問題は合算して表示する', () => {
    initMemoryPersistence({
      itemStats: {
        'w:en:apple': { count: 2, keys: 10, mistakes: 1, ms: 2000 },
        'vw:en:apple': { count: 3, keys: 20, mistakes: 4, ms: 3000 },
      },
    })
    const { container } = render(<ItemList items={items} type="words" mode="en" />)
    // 練習回数は 2+3=5 回、平均ミスは (1+4)/5=1.0、打/秒は (10+20)/((2000+3000)/1000)=6.0。
    const row = rowOf(container, 'apple')
    expect(within(row).getByText(/練習 5回/)).toBeTruthy()
    expect(within(row).getByText(/平均ミス 1\.0/)).toBeTruthy()
    expect(within(row).getByText(/6\.0 打\/秒/)).toBeTruthy()
  })

  it('対戦の記録しか無い問題も表示される（対戦ぶんが迷子にならない）', () => {
    initMemoryPersistence({
      itemStats: { 'vw:en:banana': { count: 4, keys: 12, mistakes: 0, ms: 2000 } },
    })
    const { container } = render(<ItemList items={items} type="words" mode="en" />)
    expect(within(rowOf(container, 'banana')).getByText(/練習 4回/)).toBeTruthy()
  })

  it('通常プレイの記録しか無い問題は従来と同じ値のまま（既存データ互換の回帰）', () => {
    initMemoryPersistence({
      itemStats: { 'w:en:apple': { count: 7, keys: 14, mistakes: 7, ms: 2000 } },
    })
    const { container } = render(<ItemList items={items} type="words" mode="en" />)
    const row = rowOf(container, 'apple')
    expect(within(row).getByText(/練習 7回/)).toBeTruthy()
    expect(within(row).getByText(/平均ミス 1\.0/)).toBeTruthy()
  })

  it('どちらにも記録が無い問題は未練習のまま（0 が並ぶ表示回帰を防ぐ）', () => {
    initMemoryPersistence({ itemStats: {} })
    const { container } = render(<ItemList items={items} type="words" mode="en" />)
    expect(statTexts(container)).toEqual(['未練習', '未練習'])
  })

  it('英英（dict）も見出し語ごとに通常＋対戦を合算する（type→接頭辞の変換込み）', () => {
    initMemoryPersistence({
      itemStats: {
        'd:ja:apple': { count: 1, keys: 5, mistakes: 0, ms: 1000 },
        'vd:ja:apple': { count: 2, keys: 5, mistakes: 0, ms: 1000 },
      },
    })
    const dictItems = [{ word: 'apple', def: 'a fruit', ja: 'りんご' }]
    const { container } = render(<ItemList items={dictItems} type="dict" mode="ja" />)
    expect(within(rowOf(container, 'apple')).getByText(/練習 3回/)).toBeTruthy()
  })

  it('単語例文（marathon）も通常＋対戦を合算する', () => {
    initMemoryPersistence({
      itemStats: {
        's:en:I eat an apple.': { count: 1, keys: 8, mistakes: 1, ms: 1000 },
        'vs:en:I eat an apple.': { count: 5, keys: 8, mistakes: 1, ms: 1000 },
      },
    })
    const sentItems = [{ en: 'I eat an apple.', ja: '私はりんごを食べる。' }]
    const { container } = render(<ItemList items={sentItems} type="marathon" mode="en" />)
    expect(within(rowOf(container, 'I eat an apple.')).getByText(/練習 6回/)).toBeTruthy()
  })
})
