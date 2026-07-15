// #426 対戦基盤スライス4：接続コード交換の container。
// useVersus（対戦セッションの状態機械・WebRTC・手動シグナリング配線）を呼び、@tll/ui の
// SignalingExchangeView（純粋 presenter）へ props/コールバックを渡す。ここが持つ app 固有の配線は
//   1. 役割選択の一時状態（ゲストは joinRoom 前に「入る」を選んだ時点で貼付欄を出す）
//   2. 共有URL（location から #versus=<code> を組み立て・コピー）と hash 由来の自動 join
//   3. クリップボードコピー（navigator.clipboard）
// の3点。個人情報や実 IP は URL に載せない（# 断片のみ・# 断片はサーバーへ送られない）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SignalingExchangeView } from '@tll/ui'
import { useVersus } from '../../application/versus/useVersus.js'
import { activeIds as rosterActiveIds } from '../../domain/versus/peerRoster.service.js'

// location.hash から接続コードを取り出す（`#versus=<code>` 形式・無ければ null）。純粋・DOM 非依存。
function parseHashCode(hash) {
  if (typeof hash !== 'string') return null
  const m = hash.match(/[#&]versus=([^&]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

// 共有URLを組み立てる（origin+pathname に #versus=<code>）。クエリ（? 以降）は載せない＝# 断片のみ。
function buildShareUrl({ origin, pathname }, code) {
  return `${origin}${pathname}#versus=${encodeURIComponent(code)}`
}

export default function VersusConnect() {
  const v = useVersus()

  // ゲストは joinRoom を呼ぶまで reducer 上の role が未確定なので、UI 上の「入る」選択を一時保持する。
  const [chosenRole, setChosenRole] = useState(null)
  const role = v.role ?? chosenRole

  // 参加者一覧（離脱を除いた active な peerId）。roster から算出して presenter へ渡す。
  const ids = useMemo(() => rosterActiveIds(v.roster), [v.roster])

  // ホストの共有URL（offerCode があるときだけ組み立てる）。
  const shareUrl = useMemo(() => {
    if (v.role !== 'host' || !v.offerCode) return null
    return buildShareUrl(window.location, v.offerCode)
  }, [v.role, v.offerCode])

  // クリップボードへコピー（失敗は握りつぶす＝環境非対応でも UI を壊さない）。
  const handleCopy = useCallback((text) => {
    navigator.clipboard?.writeText(text).catch(() => {})
  }, [])

  const onSelectHost = useCallback(() => {
    setChosenRole('host')
    v.createRoom()
  }, [v])

  const onSelectGuest = useCallback(() => setChosenRole('guest'), [])

  // 共有URL経由のゲスト自動参加：mount 時に hash の接続コードを拾って joinRoom へ流す（1回だけ）。
  // effect 内の同期 setState を避けるため setTimeout(…,0) で遅延させる（react-hooks/set-state-in-effect）。
  const autoJoined = useRef(false)
  useEffect(() => {
    if (autoJoined.current) return
    const code = parseHashCode(window.location.hash)
    if (!code) return
    autoJoined.current = true
    const id = setTimeout(() => {
      setChosenRole('guest')
      v.joinRoom(code)
    }, 0)
    return () => clearTimeout(id)
    // mount 時1回のみ（hash は初期表示時の値で確定・v は安定参照でなくても再実行不要）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SignalingExchangeView
      role={role}
      connection={v.connection}
      selfId={v.selfId}
      offerCode={v.offerCode}
      answerCode={v.answerCode}
      shareUrl={shareUrl}
      activeIds={ids}
      error={v.error}
      onSelectHost={onSelectHost}
      onSelectGuest={onSelectGuest}
      onSubmitOffer={v.joinRoom}
      onSubmitAnswer={v.acceptAnswer}
      onCopy={handleCopy}
    />
  )
}
