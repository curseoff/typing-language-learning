// @vitest-environment jsdom
// presenter smoke（#426 スライス4）：各状態が代表 props で描画が落ちないことを確かめる。
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import SignalingExchangeView from './SignalingExchangeView.presenter'

afterEach(cleanup)

const base = {
  selfId: 'me-1234',
  onSelectHost: () => {},
  onSelectGuest: () => {},
  onSubmitOffer: () => {},
  onSubmitAnswer: () => {},
  onCopy: () => {},
  onBack: () => {},
}

describe('SignalingExchangeView smoke', () => {
  it('役割選択：両ボタンが出て、選択コールバックが発火', () => {
    const onSelectHost = vi.fn()
    const onSelectGuest = vi.fn()
    const { getByText } = render(
      <SignalingExchangeView {...base} role={null} connection="idle" onSelectHost={onSelectHost} onSelectGuest={onSelectGuest} />,
    )
    fireEvent.click(getByText('部屋を作る'))
    fireEvent.click(getByText('部屋に入る'))
    expect(onSelectHost).toHaveBeenCalledOnce()
    expect(onSelectGuest).toHaveBeenCalledOnce()
  })

  it('ホスト：接続コード・共有URLをコピーでき、応答コードを貼って確定できる', () => {
    const onCopy = vi.fn()
    const onSubmitAnswer = vi.fn()
    const { getByText, getByPlaceholderText } = render(
      <SignalingExchangeView
        {...base}
        role="host"
        connection="connecting"
        offerCode="OFFER_CODE"
        shareUrl="https://ex/#versus=OFFER_CODE"
        onCopy={onCopy}
        onSubmitAnswer={onSubmitAnswer}
      />,
    )
    fireEvent.click(getByText('コピー'))
    expect(onCopy).toHaveBeenCalledWith('OFFER_CODE')
    fireEvent.click(getByText('共有URLをコピー'))
    expect(onCopy).toHaveBeenCalledWith('https://ex/#versus=OFFER_CODE')

    const ta = getByPlaceholderText('相手から受け取った応答コードを貼り付け')
    fireEvent.change(ta, { target: { value: '  ANSWER_CODE  ' } })
    fireEvent.click(getByText('接続する'))
    expect(onSubmitAnswer).toHaveBeenCalledWith('ANSWER_CODE')
  })

  it('ホスト：offerCode 未生成なら生成中の表示', () => {
    const { container } = render(
      <SignalingExchangeView {...base} role="host" connection="connecting" offerCode={null} />,
    )
    expect(container.textContent).toContain('接続コードを生成中')
  })

  it('ゲスト：offer 貼付→確定でコールバック、answerCode 表示で返送フェーズ', () => {
    const onSubmitOffer = vi.fn()
    const { getByText, getByPlaceholderText, rerender, container } = render(
      <SignalingExchangeView {...base} role="guest" connection="connecting" onSubmitOffer={onSubmitOffer} />,
    )
    const ta = getByPlaceholderText('ホストから受け取った接続コードを貼り付け')
    fireEvent.change(ta, { target: { value: 'OFFER' } })
    fireEvent.click(getByText('応答コードを作る'))
    expect(onSubmitOffer).toHaveBeenCalledWith('OFFER')

    rerender(<SignalingExchangeView {...base} role="guest" connection="connecting" answerCode="ANSWER" />)
    expect(container.textContent).toContain('ホストに返す')
  })

  it('接続済み：参加者一覧と相手を表示（カウントダウンは出さない）', () => {
    const { container } = render(
      <SignalingExchangeView {...base} role="host" connection="connected" activeIds={['me-1234', 'peer-abcd']} />,
    )
    expect(container.textContent).toContain('接続しました')
    expect(container.textContent).toContain('あなた')
    expect(container.textContent).toContain('peer-abcd')
  })

  it('エラー文と切断バッジを表示', () => {
    const { container } = render(
      <SignalingExchangeView {...base} role="host" connection="disconnected" error="応答コードが正しくありません" />,
    )
    expect(container.textContent).toContain('応答コードが正しくありません')
    expect(container.textContent).toContain('切断されました')
  })
})
