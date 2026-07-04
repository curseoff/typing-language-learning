// @vitest-environment jsdom
// #208 段6：エンドレスの結果/ランキング表示は「速度」列で描く（items/life=正解数・既定=タイピング数と別）。
// 結果画面の主成績・ランキング列がエンドレスで速度になること、0件でも壊れないことを確認する。
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import RecordsTable from './RecordsTable.jsx'
import Result from './Result.jsx'
import { WordRecords } from '../ready/parts.jsx'

afterEach(cleanup)

const ENDLESS = { kind: 'endless', value: null }
const rec = (speed, keys, date) => ({
  mode: 'both',
  rank: 1,
  source: 'wsent',
  theme: 'すべて',
  endCondition: ENDLESS,
  speed,
  keys,
  correctCount: 3,
  mistakes: 1,
  accuracy: 98,
  seconds: 45,
  segStats: [],
  date,
})

describe('エンドレスのランキング/結果表示（速度列）', () => {
  it('RecordsTable：エンドレスは主列が速度になり speed 値を出す', () => {
    render(
      <RecordsTable
        records={[rec(520, 260, '2026/07/04 1'), rec(300, 150, '2026/07/04 2')]}
        modeKey="both"
        rankText="単語例文"
        endCondition={ENDLESS}
      />,
    )
    // ヘッダに「速度」列（サブ見出しにも「速度順」）
    expect(screen.getAllByText('速度').length).toBeGreaterThan(0)
    expect(screen.getByText(/速度順/)).toBeTruthy()
    // speed 値が表示される（keys ではなく speed）
    expect(screen.getByText('520')).toBeTruthy()
  })

  it('RecordsTable：記録0件でも「まだ記録がありません」で破綻しない', () => {
    render(<RecordsTable records={[]} modeKey="both" endCondition={ENDLESS} />)
    expect(screen.getByText('まだ記録がありません。')).toBeTruthy()
  })

  it('Result：エンドレスの主成績は速度（打/分）', () => {
    render(
      <Result
        result={rec(480, 240, '2026/07/04')}
        records={{}}
        segStats={[]}
        onRetry={() => {}}
      />,
    )
    expect(screen.getByText('480')).toBeTruthy()
    expect(screen.getByText('打/分（速度）')).toBeTruthy()
  })

  it('WordRecords：エンドレスは主列が速度になる', () => {
    render(<WordRecords list={[rec(410, 205, '2026/07/04')]} isQuiz={false} endCondition={ENDLESS} />)
    expect(screen.getAllByText('速度').length).toBeGreaterThan(0)
    expect(screen.getByText('410')).toBeTruthy()
  })
})
