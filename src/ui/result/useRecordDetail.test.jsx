// @vitest-environment jsdom
// useRecordDetail は Provider を持たない経路（各テーブルがローカルに詳細ページを開く）のフォールバック。
// open で開き、閉じる／削除のどちらでも modal が畳まれる（sel が null に戻る）ことを固定する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { useRecordDetail } from './useRecordDetail.jsx'

// 削除の実体は application 側で担保済み。ここは開閉の配線だけを見る。
const svc = vi.hoisted(() => ({
  deleteRecordAt: vi.fn(() => true),
  getPersistRole: vi.fn(() => 'primary'),
}))
vi.mock('../../application/records.service.js', () => svc)

const REC = {
  source: 'words',
  mode: 'en',
  speed: 200,
  keys: 300,
  mistakes: 1,
  accuracy: 99,
  seconds: 60,
  date: '2026/07/01',
}

// 行クリックで open するテーブルの最小形（実利用と同じ形＝open して末尾に {modal} を描く）。
function Harness() {
  const { open, modal } = useRecordDetail()
  return (
    <div>
      <button onClick={() => open(REC, 1, { rankText: '単語', modeKey: 'en' })}>開く</button>
      {modal}
    </div>
  )
}

const isOpen = () => document.querySelector('.record-page') != null

beforeEach(() => {
  svc.deleteRecordAt.mockReset().mockReturnValue(true)
  svc.getPersistRole.mockReset().mockReturnValue('primary')
})
afterEach(cleanup)

describe('useRecordDetail', () => {
  it('open で詳細ページを開き、閉じるボタンで畳む', () => {
    render(<Harness />)
    expect(isOpen()).toBe(false)
    fireEvent.click(screen.getByText('開く'))
    expect(isOpen()).toBe(true)
    // 「閉じる」は × (.modal-close) とボタン行の2箇所にあるので後者を指す
    fireEvent.click(document.querySelector('.ending-actions .story-exit'))
    expect(isOpen()).toBe(false)
  })

  it('削除しても畳む（一覧を持たない経路なので閉じるだけでよい）', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('開く'))
    fireEvent.click(screen.getByRole('button', { name: 'この記録を削除する' }))
    fireEvent.click(screen.getByRole('button', { name: '本当に削除する' }))
    expect(svc.deleteRecordAt).toHaveBeenCalledWith(REC, 1)
    expect(isOpen()).toBe(false)
  })
})
