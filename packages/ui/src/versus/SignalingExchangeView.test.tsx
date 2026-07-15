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

  it('接続済み：自分/相手を短縮ID付きラベルで描き分け（生UUIDや要約行は出さない）', () => {
    const selfId = '03ecf8d2-1111-4a2b-9c3d-aaaaaaaaaaaa'
    const peerId = '77bd90ac-2222-4f5e-8d6c-bbbbbbbbbbbb'
    const { container } = render(
      <SignalingExchangeView {...base} selfId={selfId} role="host" connection="connected" activeIds={[selfId, peerId]} />,
    )
    expect(container.textContent).toContain('接続しました')
    // 自分は「あなた（<短縮ID>）」、相手は「相手（<短縮ID>）」で、それぞれ別の短縮 ID が並ぶ。
    expect(container.textContent).toContain('あなた（03ecf8d2）')
    expect(container.textContent).toContain('相手（77bd90ac）')
    // 生 UUID（full）は冗長なので出さない。
    expect(container.textContent).not.toContain(selfId)
    expect(container.textContent).not.toContain(peerId)
    // 「相手: …」の要約行は削除済み。
    expect(container.textContent).not.toContain('相手:')
  })

  it('エラー文と切断バッジを表示', () => {
    const { container } = render(
      <SignalingExchangeView {...base} role="host" connection="disconnected" error="応答コードが正しくありません" />,
    )
    expect(container.textContent).toContain('応答コードが正しくありません')
    expect(container.textContent).toContain('切断されました')
  })
})
