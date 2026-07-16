// #426 対戦基盤スライス3：対戦セッションの React フック（配線）。
// versusSession.store（純粋リデューサ）を useReducer で駆動し、WebRTC アダプタ・手動シグナリング・
// ICE 設定・メッセージ VO・開始時刻サービスを結線する。実際の P2P 挙動（接続・送受信・切断）は
// pwa-verifier の実ブラウザ検証で担保するため、ここは薄い配線に徹する（RTCPeerConnection/crypto/
// performance に依存＝jsdom/node で意味のある単体計測ができず、coverage 対象外＝vite.config.js）。
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { initSession, reduce } from './versusSession.store.js'
import { makeSeed } from '../seed.policy.js'
import { parseMessage, buildMessage } from '../../domain/versus/versusMessage.vo.js'
import { localStartTime } from '../../domain/versus/startClock.service.js'
import { activeIds } from '../../domain/versus/peerRoster.service.js'
import { isAllAccepted, isRejected } from '../../domain/versus/approvalState.service.js'
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

  // 最新 state を毎レンダー保持する ref。handleMessage/effect が useCallback 依存に state 全体を
  // 抱えずに最新 roster/approval/role/seed を安全に読むための「最新値ホルダー」（単一ピア設計に合わせた最小変更）。
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  // UI 向けの補助状態（reducer の対戦状態とは別に、接続導線の一時値を持つ）。
  const [iceMode, setIceModeState] = useState(() => getIceMode())
  const [offerCode, setOfferCode] = useState(null) // ホストが提示する接続コード
  const [answerCode, setAnswerCode] = useState(null) // ゲストが返す応答コード
  const [error, setError] = useState(null) // 直近のエラー文（コード不正・生成失敗など）
  const [connection, setConnection] = useState('idle') // 'idle'|'connecting'|'connected'|'disconnected'

  const peerRef = useRef(null) // 現在の WebRTC ピア（webrtcPeer.adapter の返り値）
  const remoteIdRef = useRef(null) // hello で判明した相手の peerId（切断時の peerLeft 用）
  const raceTimerRef = useRef(null) // カウントダウン→ raceStarted のタイマー
  const endingRef = useRef(false) // 意図的なセッション終了中フラグ（handleClose の state 上書きを抑制する）

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
        case 'propose':
          // 相手からの設定提案。memberIds は自分視点の最新 active 名簿で起こす（stateRef で最新 roster を読む）。
          dispatch({
            type: 'propose',
            config: msg.config,
            seed: msg.seed,
            memberIds: activeIds(stateRef.current.roster),
            proposer: msg.peerId,
          })
          break
        case 'vote':
          dispatch({ type: 'vote', peerId: msg.peerId, vote: msg.accept ? 'accept' : 'reject' })
          break
        case 'start':
          // ホストが可決を確定→配布した start。ゲストは approval.config を commit する（seed は propose 時に取得済み）。
          dispatch({ type: 'configAccepted' })
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
  // ただし自分から意図的にセッションを終えた（endSession）場合は、reset で作った未接続の綺麗な初期状態を
  // 保つため、peer.close() が非同期に発火する本ハンドラの state 上書き（peerLeft/aborted/disconnected）を抑制する。
  const handleClose = useCallback(() => {
    if (endingRef.current) return
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

  // 設定提案を起こす（誰でも押下可）。共有 seed を採番し、自分視点の全 active を memberIds として
  // approval を起こす。相手へは propose メッセージを配信する（peerId/config/seed のみ運ぶ）。
  const proposeMatch = useCallback(
    (config) => {
      const seed = makeSeed()
      const memberIds = activeIds(stateRef.current.roster)
      dispatch({ type: 'propose', config, seed, memberIds, proposer: selfId })
      peerRef.current?.send(JSON.stringify(buildMessage('propose', { peerId: selfId, config, seed })))
    },
    [selfId],
  )

  // 提案への賛否を投じる（accept=true で賛成）。自分ぶんを反映しつつ相手へも vote を配信する。
  const voteMatch = useCallback(
    (accept) => {
      dispatch({ type: 'vote', peerId: selfId, vote: accept ? 'accept' : 'reject' })
      peerRef.current?.send(JSON.stringify(buildMessage('vote', { peerId: selfId, accept })))
    },
    [selfId],
  )

  // 承認状態の集約：投票が出揃った結果を1箇所で判定する。
  //  - 誰かが reject → 全員ロビーへ差し戻し（configRejected で approval が null になり再発火しない）。
  //  - 全員 accept かつ自分がホスト → start を配布し config を commit してカウントダウン開始。
  //    ゲストは local all-accepted でも動かず、ホストの start 受信で commit する（開始権限をホストに一本化）。
  useEffect(() => {
    const ap = state.approval
    if (!ap) return
    if (isRejected(ap)) {
      dispatch({ type: 'configRejected' })
      return
    }
    if (isAllAccepted(ap) && state.role === 'host') {
      peerRef.current?.send(JSON.stringify(buildMessage('start', { seed: stateRef.current.seed, config: ap.config })))
      dispatch({ type: 'configAccepted' })
      startMatch()
    }
    // startMatch は scheduleRace（安定）のみに依存する安定コールバックのため依存に含めない（意図的）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.approval, state.role])

  // 進捗を配信し、自分ぶんもローカルへ反映する（peerId は自 ID・時刻は performance.now）。
  // correct（一発正解数）・lives（サドンデス残機）・speed（打鍵速度）・elapsedMs（経過時間）は
  // 与えられたときだけ message に含める（無指定は従来どおり＝後方互換）。
  const sendProgress = useCallback(
    ({ typed, total, mistakes, correct, lives, speed, elapsedMs }) => {
      const payload = { peerId: selfId, typed, total, mistakes, at: performance.now() }
      if (correct !== undefined) payload.correct = correct
      if (lives !== undefined) payload.lives = lives
      if (speed !== undefined) payload.speed = speed
      if (elapsedMs !== undefined) payload.elapsedMs = elapsedMs
      const msg = buildMessage('progress', payload)
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

  // 対戦を抜ける（Esc 中断など）：タイマー停止＋ピア切断で後始末する。UI 側は onExit で前画面へ戻す。
  // close は handleClose 経由で peerLeft/aborted を流し、connection を disconnected にする。
  const leave = useCallback(() => {
    clearTimeout(raceTimerRef.current)
    peerRef.current?.close()
  }, [])

  // 対戦中/終了後にルール選択ロビーへ戻る（#432 ナビ改善）。接続は保ったまま resetMatch で
  // config/approval/seed/rejection/progress をクリアし phase を countdown（接続済みロビー）へ戻す。
  // ローカルの race タイマーは止めておく（次戦のカウントダウンと二重発火しないよう）。
  const returnToLobby = useCallback(() => {
    clearTimeout(raceTimerRef.current)
    dispatch({ type: 'resetMatch' })
  }, [])

  // セッションを終了して接続画面（未接続）へ戻る（#432 ナビ改善）。ピアを閉じ、接続導線の一時値を初期化し、
  // reduce を initSession 相当へ reset する。endingRef を立てておくことで、peer.close() が非同期に発火する
  // handleClose が connection を 'disconnected' に上書きするのを抑制し、綺麗な未接続の初期状態を保つ。
  const endSession = useCallback(() => {
    endingRef.current = true
    clearTimeout(raceTimerRef.current)
    peerRef.current?.close()
    peerRef.current = null
    remoteIdRef.current = null
    setConnection('idle')
    setOfferCode(null)
    setAnswerCode(null)
    setError(null)
    dispatch({ type: 'reset', selfId })
  }, [selfId])

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
    // 承認フロー（設定提案）
    config: state.config,
    approval: state.approval,
    rejection: state.rejection,
    seed: state.seed,
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
    leave,
    returnToLobby,
    endSession,
    // 対戦操作
    proposeMatch,
    voteMatch,
    startMatch,
    sendProgress,
    sendFinished,
  }
}
