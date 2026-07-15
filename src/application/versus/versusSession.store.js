// #426 対戦基盤スライス3：対戦セッションの純粋リデューサ（application 層の状態ストア）。
// UI/WebRTC からのイベント（action）を受けて、domain のサービスへ委譲しながらセッション状態を進める。
// 純粋・入力非破壊：state は決して変更せず、毎回新しいオブジェクトを返す（副作用・時刻・乱数なし）。
// 実際の時刻採番・送受信・タイマーは useVersus フック側が担い、ここは「状態遷移の規則」だけを持つ。
import { transition } from '../../domain/versus/matchState.service.js'
import { makeRoster, addPeer, removePeer, markFinished, allFinished } from '../../domain/versus/peerRoster.service.js'

// 対戦セッションの初期状態を作る。
//   phase    … 対戦フェーズ（matchState.service の遷移表に従う。初期は 'waiting'）
//   role     … 自分の役割（'host' | 'guest' | null=未確定）
//   roster   … 参加者名簿（自分だけを含む。peerRoster.service で不変更新）
//   startAt  … ホスト時刻でのレース開始時刻（未設定は null。カウントダウン開始で入る）
//   progress … peerId → { typed, total, mistakes, at } の進捗マップ（受信のたび上書き）
export function initSession(selfId) {
  return {
    phase: 'waiting',
    role: null,
    roster: makeRoster(selfId),
    startAt: null,
    progress: {},
  }
}

// action を1つ適用して次の状態を返す（純粋・入力非破壊）。未知 action は現状維持（同一参照を返す）。
// domain の判定・遷移はサービスへ委譲し、ここは「どの action がどのサービスを呼ぶか」の配線に徹する。
export function reduce(state, action) {
  switch (action?.type) {
    // 自分の役割を確定する（host/guest）。
    case 'setRole':
      return { ...state, role: action.role }

    // 参加者の参加（roster に追加。冪等）。
    case 'peerJoined':
      return { ...state, roster: addPeer(state.roster, action.peerId) }

    // 参加者の離脱（roster から left マーク。active から外れる）。
    case 'peerLeft':
      return { ...state, roster: removePeer(state.roster, action.peerId) }

    // ライフサイクルイベントで phase を進める（event は matchState の型：
    // connectStarted/allConnected/raceStarted/allFinished/aborted）。
    // transition は現状維持の寛容既定を持つので、順序外イベントでも壊れない。
    case 'lifecycle':
      return { ...state, phase: transition({ phase: state.phase }, { type: action.event }).phase }

    // 相手の進捗（parseMessage 済みの progress メッセージ）。peerId ごとに最新値で上書きする。
    case 'progress': {
      const m = action.message
      return {
        ...state,
        progress: {
          ...state.progress,
          [m.peerId]: { typed: m.typed, total: m.total, mistakes: m.mistakes, at: m.at },
        },
      }
    }

    // 参加者が完走した。roster に finished を立て、その結果 active 全員が完走なら
    // phase を allFinished で finished へ進める（running → finished）。
    case 'peerFinished': {
      const roster = markFinished(state.roster, action.peerId)
      const phase = allFinished(roster)
        ? transition({ phase: state.phase }, { type: 'allFinished' }).phase
        : state.phase
      return { ...state, roster, phase }
    }

    // カウントダウン開始。startAt を記録しつつ phase を countdown へ入れる。
    // 「接続確立（allConnected）でカウントダウンフェーズに入る」規則を再利用する：
    // 既に countdown 以降なら transition の寛容既定で phase は据え置き、startAt だけ更新される。
    case 'countdown':
      return {
        ...state,
        startAt: action.startAt,
        phase: transition({ phase: state.phase }, { type: 'allConnected' }).phase,
      }

    // 未知 action は状態を一切変えない（同一参照を返す＝再描画を誘発しない）。
    default:
      return state
  }
}
