// @vitest-environment jsdom
// #451 記録詳細で削除したあと、下敷き（結果ページのランキング）に消したはずの行が残らないこと。
// 結果ページのランキングは App が持つ records state 由来で、削除は application のメモリ像だけを
// 変える。state を読み直さないと「消したのに一覧に残る」＝実画面で観測された不具合になる。
// ここは App と同じ配線（useRecordsStore + RecordDetailProvider + 実 records.service）で再現する。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { initMemoryPersistence, saveRecord, loadRecords } from '../../application/records.service.js'
import { recKey } from '../../domain/records/ranking.service.js'
import Result from './Result.container.jsx'
import RecordDetail from './RecordDetail.container.jsx'
import { RecordDetailProvider } from './RecordDetailContext.context.jsx'
import { useRecordsStore } from './useRecordsStore.jsx'

const base = { mode: 'both', rank: 1, source: 'sentence', mistakes: 0, accuracy: 100, seconds: 60 }
const TOP = { ...base, keys: 300, speed: 300, date: '2026/07/01 10:00' }
const SECOND = { ...base, keys: 200, speed: 200, date: '2026/07/02 10:00' }
const KEY = recKey('both', 1, 'sentence')

// App の下敷き（結果ページ）＋ 単一の記録詳細オーバーレイの配線を最小で再現したもの。
function Harness() {
  const { records, refresh } = useRecordsStore()
  const [sel, setSel] = useState(null) // App の detailRoute 相当（開いている記録＋順位）
  const list = records[KEY] || []
  return (
    <RecordDetailProvider openDetail={(record, position) => setSel({ record, position })}>
      <Result result={TOP} records={records} segStats={[]} onRetry={() => {}} />
      {sel && (
        <RecordDetail
          list={list}
          initial={sel}
          rankText="単語例文"
          modeKey="both"
          onClose={() => setSel(null)}
          onDeleted={() => {
            refresh() // ← ここが無いと下敷きが古いまま（本不具合）
            setSel(null)
          }}
        />
      )}
    </RecordDetailProvider>
  )
}

// 下敷き（結果ページ）のランキング行の日時を並び順で返す。オーバーレイ（.record-page）は除く。
const underlayDates = () =>
  [...document.querySelectorAll('.result > .records tbody tr td.date')].map((td) => td.textContent)

beforeEach(() => {
  initMemoryPersistence()
  saveRecord(TOP)
  saveRecord(SECOND)
})
afterEach(cleanup)

describe('記録削除後の下敷き（結果ページのランキング）', () => {
  it('削除した記録が結果ページのランキングから消える', () => {
    render(<Harness />)
    expect(underlayDates()).toEqual([TOP.date, SECOND.date])

    // 2位の行を開いて削除する（詳細 → 削除 → 本当に削除する）
    fireEvent.click(screen.getAllByText(SECOND.date)[0])
    fireEvent.click(screen.getByRole('button', { name: 'この記録を削除する' }))
    fireEvent.click(screen.getByRole('button', { name: '本当に削除する' }))

    expect(loadRecords()[KEY]).toHaveLength(1) // ストア側は確かに消えている
    expect(underlayDates()).toEqual([TOP.date]) // 下敷きも追随している
  })

  it('1位を消しても残りの記録は下敷きに残る（巻き込み削除でない）', () => {
    render(<Harness />)
    fireEvent.click(screen.getAllByText(TOP.date)[0])
    fireEvent.click(screen.getByRole('button', { name: 'この記録を削除する' }))
    fireEvent.click(screen.getByRole('button', { name: '本当に削除する' }))
    expect(underlayDates()).toEqual([SECOND.date])
  })
})
