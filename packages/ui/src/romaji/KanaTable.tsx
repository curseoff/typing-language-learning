// かな五十音表グリッド（presenter）：出題対象の行（rowIds）を段ごとに並べ、各セルに
// かな＋ローマ字を表示する。現在打っているかな（current）のセルを枠囲みハイライト（.cur）する。
// 表データの正本は @tll/core の KANA_TABLE（ui → core は許容）。
import { KANA_TABLE, cellOf } from '@tll/core'

export interface KanaTableProps {
  current: string // 今打っているかな（ハイライト対象）
  rowIds: string[] // 表示する行 id 群（出題レベルの範囲）
}

export default function KanaTable({ current, rowIds }: KanaTableProps) {
  const cur = cellOf(current) // { rowId, col } | null
  const rows = KANA_TABLE.filter((r) => rowIds.includes(r.id))
  return (
    <div className="kana-table">
      {rows.map((row) => (
        <div key={row.id} className="kana-row">
          <span className="kana-row-label">{row.label}</span>
          <div className="kana-cells">
            {row.cells.map((cell, col) =>
              cell ? (
                <span
                  key={col}
                  className={
                    'kana-cell' +
                    (cur && cur.rowId === row.id && cur.col === col ? ' cur' : '')
                  }
                >
                  <span className="kana-cell-kana">{cell.kana}</span>
                  <span className="kana-cell-romaji">{cell.romaji}</span>
                </span>
              ) : (
                <span key={col} className="kana-cell empty" aria-hidden="true" />
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
