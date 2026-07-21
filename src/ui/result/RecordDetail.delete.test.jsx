// @vitest-environment jsdom
// #451 記録詳細の「削除」ボタン。誤爆が取り返しのつかない操作なので、2段階確認（1回目＝確認へ、
// 2回目＝実行）と、表示中の記録を切り替えたら確認状態が必ず解けることを固定する。
// 副タブ（secondary）は読み取り専用＝消しても主タブの snapshot で戻るため、ボタン自体を出さない。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import RecordDetail from './RecordDetail.container.jsx'

// 削除の実体（記録メモリ像＋sqlite への書込み）は application 側で担保済み。ここは配線だけを見る。
const svc = vi.hoisted(() => ({
  deleteRecordAt: vi.fn(() => true),
  getPersistRole: vi.fn(() => 'primary'),
}))
vi.mock('../../application/records.service.js', () => svc)

const rec = (date, keys) => ({
  source: 'words',
  mode: 'en',
  speed: 200,
  keys,
  mistakes: 1,
  accuracy: 99,
  seconds: 60,
  date,
})

const A = rec('2026/07/01', 300)
const B = rec('2026/07/02', 200)

const renderDetail = (props = {}) =>
  render(
    <RecordDetail
      list={[A, B]}
      initial={{ record: A, position: 1 }}
      rankText="単語"
      modeKey="en"
      isQuiz={false}
      onClose={() => {}}
      {...props}
    />,
  )

const delButton = () => screen.queryByRole('button', { name: 'この記録を削除する' })
const confirmButton = () => screen.queryByRole('button', { name: '本当に削除する' })

beforeEach(() => {
  svc.deleteRecordAt.mockReset().mockReturnValue(true)
  svc.getPersistRole.mockReset().mockReturnValue('primary')
})
afterEach(cleanup)

describe('RecordDetail：削除の2段階確認', () => {
  it('1回目のクリックでは削除せず、確認状態になるだけ', () => {
    renderDetail()
    fireEvent.click(delButton())
    expect(svc.deleteRecordAt).not.toHaveBeenCalled()
    expect(confirmButton()).not.toBeNull()
    expect(screen.getByText('この記録を削除します。取り消せません。')).toBeTruthy()
  })

  it('2回目（確認ボタン）のクリックで表示中の記録と順位を渡して削除する', () => {
    renderDetail()
    fireEvent.click(delButton())
    fireEvent.click(confirmButton())
    expect(svc.deleteRecordAt).toHaveBeenCalledTimes(1)
    expect(svc.deleteRecordAt).toHaveBeenCalledWith(A, 1)
  })

  it('ランキング表で別の記録に切り替えた後は、その記録と順位を渡す', () => {
    renderDetail()
    fireEvent.click(document.querySelectorAll('.records tbody tr')[1])
    fireEvent.click(delButton())
    fireEvent.click(confirmButton())
    expect(svc.deleteRecordAt).toHaveBeenCalledWith(B, 2)
  })

  it('確認ボタンは「やめる」より後ろに置く（1クリック目の直下に来ないようにする）', () => {
    renderDetail()
    fireEvent.click(delButton())
    const labels = [...document.querySelectorAll('.ending-actions button')].map((b) => b.textContent)
    expect(labels).toEqual(['閉じる', 'やめる', '本当に削除する'])
  })

  it('確認状態になったら安全側の「やめる」にフォーカスを移す（body に落とさない）', () => {
    renderDetail()
    fireEvent.click(delButton())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'やめる' }))
  })

  it('「やめる」で確認状態から抜けられる', () => {
    renderDetail()
    fireEvent.click(delButton())
    fireEvent.click(screen.getByRole('button', { name: 'やめる' }))
    expect(confirmButton()).toBeNull()
    expect(delButton()).not.toBeNull()
    expect(svc.deleteRecordAt).not.toHaveBeenCalled()
  })

  it('確認状態のまま別の記録に切り替えると確認は解除される（別物を消す事故を防ぐ）', () => {
    renderDetail()
    fireEvent.click(delButton())
    expect(confirmButton()).not.toBeNull()
    fireEvent.click(document.querySelectorAll('.records tbody tr')[1])
    expect(confirmButton()).toBeNull()
    expect(delButton()).not.toBeNull()
  })
})

describe('RecordDetail：削除の結果', () => {
  it('成功したら onDeleted を呼ぶ（一覧の読み直しは呼び出し側の責務）', () => {
    const onDeleted = vi.fn()
    const onClose = vi.fn()
    renderDetail({ onDeleted, onClose })
    fireEvent.click(delButton())
    fireEvent.click(confirmButton())
    expect(onDeleted).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('onDeleted が無ければ onClose にフォールバックする', () => {
    const onClose = vi.fn()
    renderDetail({ onClose })
    fireEvent.click(delButton())
    fireEvent.click(confirmButton())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('失敗（false）なら閉じずに、消えなかったことを伝える', () => {
    svc.deleteRecordAt.mockReturnValue(false)
    const onDeleted = vi.fn()
    const onClose = vi.fn()
    renderDetail({ onDeleted, onClose })
    fireEvent.click(delButton())
    fireEvent.click(confirmButton())
    expect(onDeleted).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText(/削除できませんでした/)).toBeTruthy()
  })
})

describe('RecordDetail：副タブ（読み取り専用）', () => {
  it('secondary では削除ボタンを出さない（消したつもりが戻るのを防ぐ）', () => {
    svc.getPersistRole.mockReturnValue('secondary')
    renderDetail()
    expect(delButton()).toBeNull()
    expect(confirmButton()).toBeNull()
  })

  it('secondary では削除の注意文欄も描かない（出ない文言のために余白を取らない）', () => {
    svc.getPersistRole.mockReturnValue('secondary')
    renderDetail()
    expect(document.querySelector('.record-delete-note')).toBeNull()
  })
})
