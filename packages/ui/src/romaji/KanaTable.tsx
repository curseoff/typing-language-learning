// かな五十音表グリッド（presenter）：KANA_TABLE の全行（清音/濁音/半濁音/拗音）を常に描画し、
// 各セルにかな＋ローマ字を表示する。出題対象外の行（rowIds に含まれない）は薄く（.out-scope）して
// 「全体を見せつつ今どの範囲を練習中か」を示す。現在打っているかな（current）のセルは枠囲み（.cur）。
// 表データの正本は @tll/core の KANA_TABLE（ui → core は許容）。
// 全行を常に描画するため出題かなが下方に来ると .cur が画面外に出うる。現在セルに ref を持たせ、
// current 変化時に scrollIntoView で内部スクロール器（.kana-table）を追従させる（DOM操作のみ・setState しない）。
import { useEffect, useRef } from 'react'
import { KANA_TABLE, cellOf } from '@tll/core'

export interface KanaTableProps {
  current: string // 今打っているかな（ハイライト対象）
  rowIds: string[] // 出題レベルの範囲（この行は通常表示・範囲外は薄く）
}

export default function KanaTable({ current, rowIds }: KanaTableProps) {
  const cur = cellOf(current) // { rowId, col } | null
  const curRef = useRef<HTMLSpanElement>(null)
  // 現在かなが変わるたび、そのセルを表示域内に収める（block/inline とも nearest で最小スクロール）。
  useEffect(() => {
    // jsdom には scrollIntoView が無いので存在チェックしてから呼ぶ。
    curRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [current])
  return (
    <div className="kana-table">
      {KANA_TABLE.map((row) => (
        <div
          key={row.id}
          className={'kana-row' + (rowIds.includes(row.id) ? '' : ' out-scope')}
        >
          <span className="kana-row-label">{row.label}</span>
          <div className="kana-cells">
            {row.cells.map((cell, col) => {
              const isCur = !!(cur && cur.rowId === row.id && cur.col === col)
              return cell ? (
                <span
                  key={col}
                  ref={isCur ? curRef : undefined}
                  className={'kana-cell' + (isCur ? ' cur' : '')}
                >
                  <span className="kana-cell-kana">{cell.kana}</span>
                  <span className="kana-cell-romaji">{cell.romaji}</span>
                </span>
              ) : (
                <span key={col} className="kana-cell empty" aria-hidden="true" />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
