// #432 穴埋め対戦：盤面 presenter（純粋描画・props だけ）。参加者ぶんの ProgressCardView を並べ、
// 終了後は勝者/ドローのバッジを添える。カード自体は数値のみ（カンニング防止）＝盤面も表示に徹する。
import ProgressCardView, { type ProgressCardData } from './ProgressCardView.presenter'

// カード型は ProgressCardView と共有する（再エクスポート）。
export type { ProgressCardData }

export interface VersusBoardViewProps {
  members: ProgressCardData[] // 参加者ぶんのカードデータ（container が roster/進捗から算出）
  winners?: string[] // 勝者 peerId 配列（複数はドロー・1 人は単独勝者）
  finished?: boolean // 対戦終了か（true のときだけ勝敗/ドローバッジを出す）
}

// 勝者バッジの見出しは短縮 ID で示す（生 UUID は冗長なので出さない）。
function shortId(id: string): string {
  return id.slice(0, 8)
}

export default function VersusBoardView({ members, winners, finished }: VersusBoardViewProps) {
  const wins = winners ?? []
  // 終了かつ勝者が確定しているときだけバッジを描く（未終了は結果を見せない）。
  const badge = finished ? (
    wins.length > 1 ? (
      <div className="vs-board-badge vs-board-draw">ドロー</div>
    ) : wins.length === 1 ? (
      <div className="vs-board-badge vs-board-winner">勝者（{shortId(wins[0])}）</div>
    ) : null
  ) : null

  return (
    <div className="vs-board">
      {badge}
      <div className="vs-board-cards">
        {members.map((m) => (
          <ProgressCardView key={m.id} {...m} />
        ))}
      </div>
    </div>
  )
}
