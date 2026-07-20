// @vitest-environment jsdom
// presenter smoke（#432）：承認 UI が設定案を描き、承認側/提案側・拒否バナーを出し分けることを確かめる。
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import MatchApprovalView from './MatchApprovalView.presenter'

afterEach(cleanup)

const proposal = {
  gameType: '穴埋め',
  level: 3,
  theme: '日常',
  mode: 'ノーマル',
  endConditionLabel: '60秒',
}
const SELF_ID = '03ecf8d2-1111'
const PEER_ID = '77bd90ac-2222'

describe('MatchApprovalView smoke', () => {
  it('承認側：設定案を描き、承認/拒否ボタンでコールバックが発火', () => {
    const onAccept = vi.fn()
    const onReject = vi.fn()
    const { getByText, container } = render(
      <MatchApprovalView
        proposal={proposal}
        proposerId={PEER_ID}
        isProposer={false}
        onAccept={onAccept}
        onReject={onReject}
      />,
    )
    const t = container.textContent ?? ''
    expect(t).toContain('穴埋め')
    expect(t).toContain('60秒')
    expect(t).toContain('この設定で対戦しますか？')
    fireEvent.click(getByText('承認する'))
    fireEvent.click(getByText('拒否する'))
    expect(onAccept).toHaveBeenCalledOnce()
    expect(onReject).toHaveBeenCalledOnce()
  })

  it('提案側：承認/拒否ボタンは出さず承認待ちを表示', () => {
    const { container, queryByText } = render(
      <MatchApprovalView
        proposal={proposal}
        proposerId={SELF_ID}
        isProposer
        onAccept={() => {}}
        onReject={() => {}}
      />,
    )
    expect(container.textContent).toContain('相手の承認を待っています')
    expect(queryByText('承認する')).toBeNull()
    expect(queryByText('拒否する')).toBeNull()
  })

  it('拒否バナー：差し戻し通知を赤系で出す', () => {
    const { container } = render(
      <MatchApprovalView
        proposal={proposal}
        proposerId={SELF_ID}
        isProposer
        rejection={{ by: [PEER_ID] }}
        onAccept={() => {}}
        onReject={() => {}}
      />,
    )
    const t = container.textContent ?? ''
    expect(t).toContain('設定が拒否されました')
    expect(t).toContain('77bd90ac')
    expect(container.querySelector('.vs-approval-rejection')).not.toBeNull()
  })
})
