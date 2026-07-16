// #426/#432 対戦の接続〜対戦導線 container（フロー化）。
// useVersus（対戦セッションの状態機械・WebRTC・手動シグナリング配線）を呼び、返り値の
// connection/approval/config/phase を見て表示を出し分ける（新たなグローバル state は足さない）：
//   1. 未接続            … SignalingExchangeView（接続コード交換）
//   2. 接続済み・設定前   … VersusLobby（対戦条件を選び proposeMatch で提案）
//   3. 提案中（approval）… MatchApprovalView（承認/拒否・投票状況・拒否差し戻し）
//   4. 合意後（config）  … 対戦本体プレースホルダ（countdown/running/finished・PR8 で差し替え）
// この container が持つ app 固有の配線は
//   a. 役割選択の一時状態（ゲストは joinRoom 前に「入る」を選んだ時点で貼付欄を出す）
//   b. 共有URL（location から #versus=<code> を組み立て・コピー）と hash 由来の自動 join
//   c. クリップボードコピー（navigator.clipboard）
//   d. MatchConfig → presenter 向けの人間可読ラベル整形（表示文字列は container 側で作り presenter は表示のみ）
// の4点。個人情報や実 IP は URL に載せない（# 断片のみ・# 断片はサーバーへ送られない）。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SignalingExchangeView, MatchApprovalView } from '@tll/ui'
import { useVersus } from '../../application/versus/useVersus.js'
import { activeIds as rosterActiveIds } from '../../domain/versus/peerRoster.service.js'
import { modeLabel } from '../../content/modes.js'
import { endKind, endValueLabel } from '../../content/endConditions.js'
import VersusLobby from './VersusLobby.container.jsx'
import VersusMatch from './VersusMatch.container.jsx'

// 種目キー → 表示名（ロビーのタブと同じ呼称）。
const GAME_TYPE_LABELS = { words: '単語', wsent: '単語例文', dict: '英英辞典' }

// MatchConfig を MatchApprovalView が期待する表示用サマリ（すべて整形済み文字列）へ変換する。
// presenter は表示に徹する規約のため、ラベル整形はここ（container）で完結させる。
function formatProposal(config) {
  const ec = config.endCondition
  return {
    gameType: GAME_TYPE_LABELS[config.gameType] ?? config.gameType,
    level: config.level,
    theme: config.theme,
    mode: modeLabel(config.mode),
    // 例: 時間60秒 / 問題数25問 / サドンデスライフ3。
    endConditionLabel: `${endKind(ec.kind).label}${endValueLabel(ec.kind, ec.value)}`,
  }
}

// 共有URL経由 auto-join を「同一コードに対し確実に1回だけ」に絞る消化済みセット（module スコープ）。
// ref ガードだと StrictMode（dev）の二重マウントで 1回目 cleanup が予約を消し、2回目 effect が
// ガードで早期 return して永久に発火しない不具合になる。module スコープなら二重マウントを跨いで
// 一度きり判定でき、本番でも一度だけになる（ページ再読込で module 再評価＝セットは初期化）。
const consumedHashCodes = new Set()

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

export default function VersusConnect({ onExit }) {
  const v = useVersus()

  // 対戦を抜ける（Esc 中断など）：ピアを切断してから前の画面（トップ/ready）へ復帰する。
  const handleExit = useCallback(() => {
    v.leave()
    onExit?.()
  }, [v, onExit])

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
  // cleanup で clearTimeout しない：StrictMode の二重マウントで 1回目 cleanup が予約を消すと
  // 2回目 effect が消化済み判定で return し auto-join が永久に発火しなくなるため。二重発火（peer 二重生成）は
  // consumedHashCodes（module スコープ）が防ぐ＝発火は同一コードに対し確実に1回だけ、dev/本番いずれも。
  useEffect(() => {
    const code = parseHashCode(window.location.hash)
    if (!code || consumedHashCodes.has(code)) return
    consumedHashCodes.add(code)
    setTimeout(() => {
      setChosenRole('guest')
      v.joinRoom(code)
    }, 0)
    // mount 時1回のみ（hash は初期表示時の値で確定・v は安定参照でなくても再実行不要）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- 表示の出し分け（useVersus の返り値のみで決める）----

  // 1. 未接続：接続コード交換 UI（従来どおり）。
  if (v.connection !== 'connected') {
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

  // 4. 合意後（config が commit 済み）：対戦本体（VersusMatch）。config は configAccepted まで null なので、
  // この分岐は「可決後の countdown/running/finished」だけを捉える。VersusMatch が content ロード→
  // カウントダウン→穴埋めプレイ→終了（勝敗）まで担う。
  if (v.config) {
    return (
      <VersusMatch
        config={v.config}
        seed={v.seed}
        selfId={v.selfId}
        roster={v.roster}
        progress={v.progress}
        phase={v.phase}
        sendProgress={v.sendProgress}
        sendFinished={v.sendFinished}
        onExit={handleExit}
      />
    )
  }

  // 3. 提案中：承認 UI（設定サマリ＋投票＋拒否差し戻し）。
  if (v.approval) {
    return (
      <MatchApprovalView
        proposal={formatProposal(v.approval.config)}
        proposerId={v.approval.proposer}
        isProposer={v.approval.proposer === v.selfId}
        votes={v.approval.votes}
        rejection={v.rejection}
        onAccept={() => v.voteMatch(true)}
        onReject={() => v.voteMatch(false)}
      />
    )
  }

  // 2. 接続済み・未提案：対戦条件を選ぶロビー。提案が拒否された直後（approval=null・rejection あり）も
  // ここに落ちるため、押した本人（提案者）へ差し戻しを伝えるバナーを上部に出す。
  return (
    <div className="vs vs-lobby-flow">
      {v.rejection && v.rejection.by.length > 0 && (
        <p className="vs-error vs-lobby-rejection" role="alert">
          設定が拒否されました（{v.rejection.by.map((id) => id.slice(0, 8)).join('、')}）。条件を見直して再提案してください。
        </p>
      )}
      <VersusLobby onPropose={(config) => v.proposeMatch(config)} />
    </div>
  )
}
