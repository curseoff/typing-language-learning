// 全記録横断ビュー（Issue #248）の presenter。文章/物語/単語/英英の記録を1つの表に集約表示する。
// 純粋描画：content/application/フックを import しない。行データ（正規化済み）と並べ替え関数 sortFn を
// props で受け取り、列ヘッダークリックのソート状態だけを内部 useState で持つ（UI 状態）。
import { useMemo, useState } from 'react'

// flattenRecords が生む1行の形（表示に使う列のみ宣言）。application 由来だが型のみ独立定義。
export interface AllRecordRow {
  kind: string
  kindLabel: string
  level: number | null
  levelLabel: string
  mode: string | null
  modeLabel: string
  theme: string | null
  speed: number
  accuracy: number
  mistakes: number
  keys: number
  seconds: number
  date: string | null
  dateTs: number
  // 行クリックで記録詳細へ遷移する用の文脈（#250）。表示には使わず onRowClick へ素通しする。
  raw?: unknown
  siblings?: unknown[]
  position?: number
}

export type SortKey =
  | 'kind'
  | 'level'
  | 'mode'
  | 'theme'
  | 'speed'
  | 'accuracy'
  | 'mistakes'
  | 'date'
export type SortDir = 'asc' | 'desc'

export interface AllRecordsViewProps {
  rows: AllRecordRow[]
  // application の sortAllRecords を注入（presenter が application を import しないため props 経由）。
  sortFn: (list: AllRecordRow[], key: string, dir: SortDir) => AllRecordRow[]
  onExit: () => void
  // データ行クリックで記録詳細を開く（#250）。open 呼び出しは container が row から組む。
  onRowClick?: (row: AllRecordRow) => void
}

// 列定義（表示順＝種類→レベル→モード→テーマ→速度→正確率→ミス→日時）。
const COLUMNS: Array<{ key: SortKey; label: string; numeric: boolean }> = [
  { key: 'kind', label: '種類', numeric: false },
  { key: 'level', label: 'レベル', numeric: false },
  { key: 'mode', label: 'モード', numeric: false },
  { key: 'theme', label: 'テーマ', numeric: false },
  { key: 'speed', label: '速度', numeric: true },
  { key: 'accuracy', label: '正確率', numeric: true },
  { key: 'mistakes', label: 'ミス', numeric: true },
  { key: 'date', label: '日時', numeric: true },
]

// 列ごとの既定の並び向き（数値・日時は降順＝大きい/新しい順が有用、文字列は昇順）。
const defaultDir = (key: SortKey): SortDir =>
  key === 'date' || key === 'speed' || key === 'accuracy' || key === 'mistakes' || key === 'level'
    ? 'desc'
    : 'asc'

export default function AllRecordsView({ rows, sortFn, onExit, onRowClick }: AllRecordsViewProps) {
  // 既定は日時の新しい順（date desc）。
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => sortFn(rows, sortKey, sortDir), [rows, sortKey, sortDir, sortFn])

  // ヘッダークリック：同じ列は昇降トグル、別の列はその列の既定向きから。
  const onHeader = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(defaultDir(key))
    }
  }

  const ariaSort = (key: SortKey): 'ascending' | 'descending' | 'none' =>
    key === sortKey ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'

  return (
    <div className="all-records">
      <button type="button" className="about-back" onClick={onExit}>
        ← 戻る
      </button>
      <h2 className="all-records-title">すべての記録</h2>
      <p className="all-records-sub">文章・物語・単語・英英の記録を横断して並べ替えられます。</p>

      {sorted.length === 0 ? (
        <p className="no-records">まだ記録がありません。</p>
      ) : (
        // 列が多い（8列）ので狭幅で溢れないよう横スクロールラッパに包む（#243 の .seg-scroll 流用）。
        <div className="seg-scroll">
          <table className="records-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} aria-sort={ariaSort(c.key)} className={c.numeric ? 'num' : ''}>
                    <button
                      type="button"
                      className={`sort-th ${c.key === sortKey ? 'active' : ''}`}
                      onClick={() => onHeader(c.key)}
                    >
                      {c.label}
                      <span className="sort-ind" aria-hidden="true">
                        {c.key === sortKey ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr
                  key={i}
                  className={onRowClick ? 'row-click' : ''}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  title={onRowClick ? 'クリックで記録の詳細' : undefined}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          // Enter / Space で行を開く（キーボード操作。ヘッダーのソートとは別行）。
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onRowClick(r)
                          }
                        }
                      : undefined
                  }
                >
                  <td>{r.kindLabel}</td>
                  <td>{r.levelLabel}</td>
                  <td>{r.modeLabel}</td>
                  <td>{r.theme ?? ''}</td>
                  <td className="num speed">{r.speed}</td>
                  <td className="num">{r.accuracy}%</td>
                  <td className="num">{r.mistakes}</td>
                  <td className="date">{r.date ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
