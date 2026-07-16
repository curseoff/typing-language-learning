// #432 穴埋め対戦：設定案の承認 UI presenter（純粋描画・props とコールバックだけ）。
// 一方が提案した対戦設定（種目/レベル/テーマ/モード/終了条件）を相手に見せ、承認/拒否を受ける。
// ラベルはすべて呼び出し側で整形済みの文字列を渡す前提（ここは表示に徹する）。
export interface MatchProposal {
  gameType: string // 種目（表示用ラベル・整形済み）
  level: number // レベル
  theme: string // テーマ（表示用ラベル・整形済み）
  mode: string // モード（表示用ラベル・整形済み）
  endConditionLabel: string // 終了条件（表示用ラベル・整形済み）
}

export interface MatchApprovalViewProps {
  proposal: MatchProposal // 設定案サマリ
  proposerId: string // 提案者の peerId（短縮 ID で示す）
  isProposer: boolean // 自分がこの案の提案者か（true は承認待ち表示・ボタンは出さない）
  votes?: Record<string, 'pending' | 'accept' | 'reject'> // 各メンバーの投票状況（任意表示）
  rejection?: { by: string[] } | null // 拒否通知（押した人向けの差し戻しバナー）。null/未指定なら非表示
  onAccept: () => void // 承認
  onReject: () => void // 拒否
}

// peerId（生 UUID）は先頭 8 文字だけ表示する。
function shortId(id: string): string {
  return id.slice(0, 8)
}

// 投票状況の日本語ラベル。
const VOTE_LABEL: Record<'pending' | 'accept' | 'reject', string> = {
  pending: '未回答',
  accept: '承認',
  reject: '拒否',
}

export default function MatchApprovalView({
  proposal,
  proposerId,
  isProposer,
  votes,
  rejection,
  onAccept,
  onReject,
}: MatchApprovalViewProps) {
  const voteEntries = votes ? Object.entries(votes) : []

  return (
    <div className="vs vs-approval">
      <header className="vs-header">
        <h2 className="vs-title">対戦の設定</h2>
      </header>

      {/* 拒否通知：提案者に差し戻しを知らせる赤系バナー。 */}
      {rejection && rejection.by.length > 0 && (
        <p className="vs-error vs-approval-rejection" role="alert">
          設定が拒否されました（{rejection.by.map(shortId).join('、')}）。設定を見直してください。
        </p>
      )}

      {/* 設定案サマリ。 */}
      <dl className="vs-approval-summary">
        <div className="vs-approval-row">
          <dt>種目</dt>
          <dd>{proposal.gameType}</dd>
        </div>
        <div className="vs-approval-row">
          <dt>レベル</dt>
          <dd>{proposal.level}</dd>
        </div>
        <div className="vs-approval-row">
          <dt>テーマ</dt>
          <dd>{proposal.theme}</dd>
        </div>
        <div className="vs-approval-row">
          <dt>モード</dt>
          <dd>{proposal.mode}</dd>
        </div>
        <div className="vs-approval-row">
          <dt>終了条件</dt>
          <dd>{proposal.endConditionLabel}</dd>
        </div>
      </dl>

      {/* 投票状況（任意）。 */}
      {voteEntries.length > 0 && (
        <ul className="vs-approval-votes">
          {voteEntries.map(([id, v]) => (
            <li key={id} className={`vs-vote vs-vote-${v}`}>
              {shortId(id)}：{VOTE_LABEL[v]}
            </li>
          ))}
        </ul>
      )}

      {isProposer ? (
        // 自分の提案：承認/拒否は出さず、相手の承認を待つ。
        <p className="vs-approval-waiting">
          あなた（{shortId(proposerId)}）の提案です。相手の承認を待っています…
        </p>
      ) : (
        // 相手の提案：この設定で対戦するかを選ぶ。
        <>
          <p className="vs-approval-ask">この設定で対戦しますか？</p>
          <div className="vs-role-buttons">
            <button type="button" className="vs-btn vs-btn-primary" onClick={onAccept}>
              承認する
            </button>
            <button type="button" className="vs-btn vs-btn-secondary" onClick={onReject}>
              拒否する
            </button>
          </div>
        </>
      )}
    </div>
  )
}
