// #432 穴埋め対戦：盤面 presenter（純粋描画・props だけ）。参加者ぶんの ProgressCardView を並べる。
// 勝敗は「上部の勝者/ドローバッジ」ではなく、各カード内の順位（rank）で示す（container が rankMap で算出）。
// カード自体は数値のみ（カンニング防止）＝盤面も表示に徹する。
import ProgressCardView, { type ProgressCardData } from './ProgressCardView.presenter'

// カード型は ProgressCardView と共有する（再エクスポート）。
export type { ProgressCardData }

export interface VersusBoardViewProps {
  members: ProgressCardData[] // 参加者ぶんのカードデータ（container が roster/進捗/順位から算出）
}

export default function VersusBoardView({ members }: VersusBoardViewProps) {
  return (
    <div className="vs-board">
      <div className="vs-board-cards">
        {members.map((m) => (
          <ProgressCardView key={m.id} {...m} />
        ))}
      </div>
    </div>
  )
}
