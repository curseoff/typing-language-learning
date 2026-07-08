// @vitest-environment jsdom
// presenter smoke（#248）: 記録あり/空・列ヘッダークリックでソートが呼ばれ aria-sort が動く。
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import AllRecordsView from './AllRecordsView'
import type { AllRecordRow, SortDir } from './AllRecordsView'

afterEach(cleanup)

const row = (over: Partial<AllRecordRow>): AllRecordRow => ({
  kind: 'words',
  kindLabel: '単語',
  level: 1,
  levelLabel: '基礎',
  mode: 'en',
  modeLabel: '英語',
  theme: 'すべて',
  speed: 0,
  accuracy: 0,
  mistakes: 0,
  keys: 0,
  seconds: 0,
  date: '2026/7/1 09:00:00',
  dateTs: 1,
  ...over,
})

const rows: AllRecordRow[] = [
  row({ kind: 'wsent', kindLabel: '文章', speed: 480, date: '2026/7/7 12:00:00', dateTs: 7 }),
  row({ kind: 'story', kindLabel: '物語', level: null, levelLabel: '', theme: null, speed: 350, date: '2026/7/3 07:00:00', dateTs: 3 }),
]

describe('AllRecordsView smoke', () => {
  it('記録行を描く（種類ラベルが出る）', () => {
    const sortFn = (list: AllRecordRow[]) => list
    const { getByText } = render(<AllRecordsView rows={rows} sortFn={sortFn} onExit={() => {}} />)
    expect(getByText('文章')).toBeTruthy()
    expect(getByText('物語')).toBeTruthy()
  })

  it('空記録ではプレースホルダを出す', () => {
    const sortFn = (list: AllRecordRow[]) => list
    const { getByText } = render(<AllRecordsView rows={[]} sortFn={sortFn} onExit={() => {}} />)
    expect(getByText('まだ記録がありません。')).toBeTruthy()
  })

  it('列ヘッダークリックで sortFn が対象キー・向きで呼ばれる', () => {
    const sortFn = vi.fn((list: AllRecordRow[]) => list)
    const { getByText } = render(<AllRecordsView rows={rows} sortFn={sortFn} onExit={() => {}} />)
    sortFn.mockClear()
    fireEvent.click(getByText('速度'))
    // 速度は数値列＝既定 desc で呼ばれる。
    const calledKeys = sortFn.mock.calls.map((c) => c[1])
    const calledDirs = sortFn.mock.calls.map((c) => c[2] as SortDir)
    expect(calledKeys).toContain('speed')
    expect(calledDirs).toContain('desc')
  })

  it('同じ列の再クリックで昇降がトグルする', () => {
    const sortFn = vi.fn((list: AllRecordRow[]) => list)
    const { getByText } = render(<AllRecordsView rows={rows} sortFn={sortFn} onExit={() => {}} />)
    fireEvent.click(getByText('速度')) // desc
    fireEvent.click(getByText('速度')) // asc へトグル
    const lastDir = sortFn.mock.calls.at(-1)?.[2]
    expect(lastDir).toBe('asc')
  })

  it('データ行クリックで onRowClick がその行で呼ばれる（ヘッダーのソートとは別）', () => {
    const onRowClick = vi.fn()
    const sortFn = (list: AllRecordRow[]) => list
    const { getByText } = render(
      <AllRecordsView rows={rows} sortFn={sortFn} onExit={() => {}} onRowClick={onRowClick} />,
    )
    fireEvent.click(getByText('文章'))
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick.mock.calls[0][0].kind).toBe('wsent')
  })

  it('データ行は Enter キーで onRowClick が発火する（キーボード到達）', () => {
    const onRowClick = vi.fn()
    const sortFn = (list: AllRecordRow[]) => list
    const { getByText } = render(
      <AllRecordsView rows={rows} sortFn={sortFn} onExit={() => {}} onRowClick={onRowClick} />,
    )
    const rowEl = getByText('物語').closest('tr') as HTMLElement
    fireEvent.keyDown(rowEl, { key: 'Enter' })
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick.mock.calls[0][0].kind).toBe('story')
  })

  it('戻るボタンで onExit を呼ぶ', () => {
    const onExit = vi.fn()
    const sortFn = (list: AllRecordRow[]) => list
    const { getByText } = render(<AllRecordsView rows={rows} sortFn={sortFn} onExit={onExit} />)
    fireEvent.click(getByText('← 戻る'))
    expect(onExit).toHaveBeenCalled()
  })
})
