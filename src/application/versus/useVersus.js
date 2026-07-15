// #426 対戦基盤スライス3：対戦セッションの React フック（配線）。
// versusSession.store（純粋リデューサ）を useReducer で駆動し、WebRTC アダプタ・手動シグナリング・
// ICE 設定・メッセージ VO・開始時刻サービスを結線する。実際の P2P 挙動（接続・送受信・切断）は
// pwa-verifier の実ブラウザ検証で担保するため、ここは薄い配線に徹する（RTCPeerConnection/crypto/
// performance に依存＝jsdom/node で意味のある単体計測ができず、coverage 対象外＝vite.config.js）。
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { initSession, reduce } from './versusSession.store.js'
import { parseMessage, buildMessage } from '../../domain/versus/versusMessage.vo.js'
import { localStartTime } from '../../domain/versus/startClock.service.js'
import { createPeer } from '../../infrastructure/p2p/webrtcPeer.adapter.js'
import { encodeSignal, decodeSignal } from '../../infrastructure/p2p/manualSignaling.adapter.js'
import { getIceMode, setIceMode as persistIceMode, iceServersFor } from '../../infrastructure/p2p/iceConfig.repository.js'

// カウントダウン猶予（ホストが startMatch してからレース開始までの ms）。
const COUNTDOWN_MS = 3000

// 一意な自 ID を採番する（crypto.randomUUID＝ブラウザ API。無い環境は時刻＋乱数でフォールバック）。
function genSelfId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// DataChannel は文字列を運ぶ。送信は JSON 文字列化、受信は JSON パース→ parseMessage で検証する。
function safeParseJson(data) {
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

// 対戦セッションフック。selfId は呼び出し側から渡せる（テスト用）が、無ければ内部生成する。
export function useVersus({ selfId: providedSelfId } = {}) {
  const selfId = useMemo(() => providedSelfId ?? genSelfId(), [providedSelfId])
  const [state, dispatch] = useReducer(reduce, selfId, initSession)

  // UI 向けの補助状態（reducer の対戦状態とは別に、接続導線の一時値を持つ）。
  const [iceMode, setIceModeState] = useState(() => getIceMode())
  const [offerCode, setOfferCode] = useState(null) // ホストが提示する接続コード
  const [answerCode, setAnswerCode] = useState(null) // ゲストが返す応答コード
  const [error, setError] = useState(null) // 直近のエラー文（コード不正・生成失敗など）
  const [connection, setConnection] = useState('idle') // 'idle'|'connecting'|'connected'|'disconnected'

  const peerRef = useRef(null) // 現在の WebRTC ピア（webrtcPeer.adapter の返り値）
  const remoteIdRef = useRef(null) // hello で判明した相手の peerId（切断時の peerLeft 用）
  const raceTimerRef = useRef(null) // カウントダウン→ raceStarted のタイマー

  // ICE モードを切り替える（永続化＋ UI 反映）。次に生成するピアから反映される。
  const setIceMode = useCallback((mode) => {
    persistIceMode(mode)
    setIceModeState(getIceMode())
  }, [])

  // レース開始時刻（ローカル時刻）に合わせて raceStarted を発火する。
  // MVP は時計ずれを 0 と仮定（同時刻）。TODO(#426): ping/pong によるオフセット推定で精緻化する。
  const scheduleRace = useCallback((hostStartAt) => {
    const localAt = localStartTime({ hostStartAt, clockOffsetMs: 0 })
    const delay = Math.max(0, localAt - performance.now())
    clearTimeout(raceTimerRef.current)
    raceTimerRef.current = setTimeout(() => {
      dispatch({ type: 'lifecycle', event: 'raceStarted' })
    }, delay)
  }, [])

  // DataChannel 受信の振り分け（すべて parseMessage を通した信頼済みメッセージのみ処理）。
  const handleMessage = useCallback(
    (data) => {
      const msg = parseMessage(safeParseJson(data))
      if (!msg) return // 不正・非対応メッセージは無視（境界で握りつぶす）
      switch (msg.type) {
        case 'hello':
          // 相手の実 peerId が判明した時点で roster に参加させる（手動シグナリングは接続確立時に
          // 相手 ID を運ばないため、hello ハンドシェイクで確定する）。
          remoteIdRef.current = msg.peerId
          dispatch({ type: 'peerJoined', peerId: msg.peerId })
          break
        case 'progress':
          dispatch({ type: 'progress', message: msg })
          break
        case 'finished':
          dispatch({ type: 'peerFinished', peerId: msg.peerId })
          break
        case 'countdown':
          dispatch({ type: 'countdown', startAt: msg.startAt })
          scheduleRace(msg.startAt)
          break
        case 'peerLeft':
          dispatch({ type: 'peerLeft', peerId: msg.peerId })
          break
        default:
          break
      }
    },
    [scheduleRace],
  )

  // 接続確立（DataChannel open）：自 ID を hello で通知し、フェーズを countdown（ロビー）へ進める。
  const handleOpen = useCallback(() => {
    peerRef.current?.send(JSON.stringify(buildMessage('hello', { peerId: selfId })))
    dispatch({ type: 'lifecycle', event: 'allConnected' })
    setConnection('connected')
  }, [selfId])

  // 切断：相手が判明していれば離脱扱いにし、対戦を aborted で終了させる。
  const handleClose = useCallback(() => {
    if (remoteIdRef.current) dispatch({ type: 'peerLeft', peerId: remoteIdRef.current })
    dispatch({ type: 'lifecycle', event: 'aborted' })
    setConnection('disconnected')
  }, [])

  // 現在の ICE モードに応じた iceServers でピアを生成し、ハンドラを配線する。
  const spawnPeer = useCallback(() => {
    const peer = createPeer({
      iceServers: iceServersFor(getIceMode()),
      onMessage: handleMessage,
      onOpen: handleOpen,
      onClose: handleClose,
    })
    peerRef.current = peer
    return peer
  }, [handleMessage, handleOpen, handleClose])

  // ホスト：ピアを作り offer を生成、接続コード（offerCode）を UI へ公開する。
  const createRoom = useCallback(async () => {
    setError(null)
    dispatch({ type: 'setRole', role: 'host' })
    dispatch({ type: 'lifecycle', event: 'connectStarted' })
    setConnection('connecting')
    const peer = spawnPeer()
    try {
      const offer = await peer.createOffer()
      setOfferCode(await encodeSignal(offer))
    } catch {
      setError('接続コードの生成に失敗しました')
    }
  }, [spawnPeer])

  // ゲスト：offer コードを復号→受理→ answer を生成、応答コード（answerCode）を UI へ公開する。
  const joinRoom = useCallback(
    async (code) => {
      setError(null)
      const offer = await decodeSignal(code)
      if (offer === null) {
        setError('接続コードが正しくありません')
        return
      }
      dispatch({ type: 'setRole', role: 'guest' })
      dispatch({ type: 'lifecycle', event: 'connectStarted' })
      setConnection('connecting')
      const peer = spawnPeer()
      try {
        const answer = await peer.acceptOffer(offer)
        setAnswerCode(await encodeSignal(answer))
      } catch {
        setError('応答コードの生成に失敗しました')
      }
    },
    [spawnPeer],
  )

  // ホスト：ゲストの応答コードを復号→受理して接続を確立する。
  const acceptAnswer = useCallback(async (code) => {
    setError(null)
    const answer = await decodeSignal(code)
    if (answer === null) {
      setError('応答コードが正しくありません')
      return
    }
    try {
      await peerRef.current?.acceptAnswer(answer)
    } catch {
      setError('接続の確立に失敗しました')
    }
  }, [])

  // ホスト：レース開始時刻を決めて全員へ配信し、自分もカウントダウンへ入る。
  const startMatch = useCallback(() => {
    const startAt = performance.now() + COUNTDOWN_MS
    peerRef.current?.send(JSON.stringify(buildMessage('countdown', { startAt })))
    dispatch({ type: 'countdown', startAt })
    scheduleRace(startAt)
  }, [scheduleRace])

  // 進捗を配信し、自分ぶんもローカルへ反映する（peerId は自 ID・時刻は performance.now）。
  const sendProgress = useCallback(
    ({ typed, total, mistakes }) => {
      const msg = buildMessage('progress', { peerId: selfId, typed, total, mistakes, at: performance.now() })
      peerRef.current?.send(JSON.stringify(msg))
      dispatch({ type: 'progress', message: msg })
    },
    [selfId],
  )

  // 完走を配信し、自分ぶんも finished マークする（active 全員完走で phase=finished）。
  const sendFinished = useCallback(
    ({ keys, mistakes, elapsedMs }) => {
      const msg = buildMessage('finished', { peerId: selfId, keys, mistakes, elapsedMs })
      peerRef.current?.send(JSON.stringify(msg))
      dispatch({ type: 'peerFinished', peerId: selfId })
    },
    [selfId],
  )

  // アンマウント時にタイマーとピアを後始末する（同期 setState を避けるためクリーンアップのみ）。
  useEffect(() => {
    return () => {
      clearTimeout(raceTimerRef.current)
      peerRef.current?.close()
    }
  }, [])

  // レース開始のローカル時刻（startAt 未設定なら null）。MVP は clockOffsetMs=0（同時刻仮定）。
  const localStartAt = useMemo(
    () => (state.startAt === null ? null : localStartTime({ hostStartAt: state.startAt, clockOffsetMs: 0 })),
    [state.startAt],
  )

  return {
    // 対戦状態（reducer 由来）
    selfId,
    phase: state.phase,
    role: state.role,
    roster: state.roster,
    progress: state.progress,
    startAt: state.startAt,
    localStartAt,
    // 接続導線
    iceMode,
    setIceMode,
    offerCode,
    answerCode,
    error,
    connection,
    createRoom,
    joinRoom,
    acceptAnswer,
    // 対戦操作
    startMatch,
    sendProgress,
    sendFinished,
  }
}
