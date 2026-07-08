// かな五十音表グリッド（presenter）：KANA_TABLE の全行（清音/濁音/半濁音/拗音）を常に描画し、
// 各セルにかな＋ローマ字を表示する。出題対象外の行（rowIds に含まれない）は薄く（.out-scope）して
// 「全体を見せつつ今どの範囲を練習中か」を示す。現在打っているかな（current）のセルは枠囲み（.cur）。
// 表データの正本は @tll/core の KANA_TABLE（ui → core は許容）。
import { KANA_TABLE, cellOf } from '@tll/core'

export interface KanaTableProps {
  current: string // 今打っているかな（ハイライト対象）
  rowIds: string[] // 出題レベルの範囲（この行は通常表示・範囲外は薄く）
}

export default function KanaTable({ current, rowIds }: KanaTableProps) {
  const cur = cellOf(current) // { rowId, col } | null
  return (
    <div className="kana-table">
      {KANA_TABLE.map((row) => (
        <div
          key={row.id}
          className={'kana-row' + (rowIds.includes(row.id) ? '' : ' out-scope')}
        >
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
