// #439 対戦：相手の「答え側」盤面を伏字マスで複製する軽量 presenter（純粋描画）。
// domain maskBoardCells が返す構造マス列（filled/pending/space・答えの文字は一切持たない）だけを受け、
// 済み色●／薄い・／語間の余白で相手の入力進捗を「実テキストを出さずに」複製する（カンニング防止）。
// MaskedText/MaskedRuby は通過分に実文字を描くため方式B（構造送信）では流用不可＝専用に切り出す。
// ルビ無し・カーソル点滅無し（相手の1文を静止複製）。miss 中は済みマスを静的な赤にする。

// 1マス。filled＝●（相手が打てた分）/ pending＝・（未入力）/ space＝語間の余白。
// miss＝相手がミス中か（filled/カーソルを赤描画するフラグ・maskBoardCells が全マスへ付与）。
export interface MaskBoardCell {
  kind: 'filled' | 'pending' | 'space'
  miss: boolean
}

export interface MaskBoardProps {
  cells: MaskBoardCell[]
}

export default function MaskBoard({ cells }: MaskBoardProps) {
  // 文字マス（filled/pending）だけを数える（space はカウント外）。aria-label は「X/Y 文字」＝実テキストは出さない。
  const charCells = cells.filter((c) => c.kind !== 'space')
  const filled = charCells.filter((c) => c.kind === 'filled').length
  return (
    <div className="vs-mb" role="img" aria-label={`相手の入力 ${filled}/${charCells.length} 文字`}>
      {cells.map((c, i) =>
        c.kind === 'space' ? (
          <span key={i} className="vs-mb-space" aria-hidden="true" />
        ) : (
          <span
            key={i}
            className={`vs-mb-cell vs-mb-${c.kind}${c.miss ? ' vs-mb-miss' : ''}`}
            aria-hidden="true"
          >
            {c.kind === 'filled' ? '●' : '・'}
          </span>
        ),
      )}
    </div>
  )
}
