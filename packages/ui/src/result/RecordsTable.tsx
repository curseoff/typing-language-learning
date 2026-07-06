// 記録ランキングテーブル（presenter）。モード×レベル別の順位表を描くだけ。
// 行クリックの記録詳細（useRecordDetail/RecordDetail）は container に置き、ここは onRowClick を呼ぶだけ。
// modeLabel（content）・MAX_RECORDS（domain）に依存しないよう、表示済みの modeText / maxRecords を props で受ける。

export interface RecordRow {
  speed?: number
  keys?: number
  correctCount?: number
  accuracy?: number | string
  seconds?: number | string
  date?: string
}

export interface EndCond {
  kind?: string
  value?: number | null
}

export interface RecordsTableProps {
  records?: RecordRow[]
  modeKey?: string
  modeText?: string // container が解決した modeLabel(modeKey)
  rankText?: string
  endCondition?: EndCond | null
  highlight?: string // 自分の記録（date）をハイライト
  maxRecords?: number // MAX_RECORDS
  // open(record, position, ctx) 相当。ctx は presenter が自分の props から組む。
  onRowClick?: (
    record: RecordRow,
    position: number,
    ctx: { rankText?: string; modeKey?: string; list: RecordRow[]; isQuiz: boolean },
  ) => void
}

export default function RecordsTable({
  records,
  modeKey,
  modeText,
  rankText,
  endCondition,
  highlight,
  maxRecords = 15,
  onRowClick,
}: RecordsTableProps) {
  const list = records || []
  // 主列は終了条件で切替える。問題数制・サドンデス（life）は「正解数」順、エンドレスは「速度」順、
  // 時間/文字数制は従来どおりタイピング数。#208 段6
  const kind = endCondition?.kind ?? 'time'
  const isItems = kind === 'items' || kind === 'life'
  const isEndless = kind === 'endless'
  const mainHead = isEndless ? '速度' : isItems ? '正解' : 'タイピング数'
  const mainSub = isEndless ? '速度' : isItems ? '正解数' : 'タイピング数'
  const mainValue = (r: RecordRow) =>
    isEndless ? (r.speed ?? 0) : isItems ? (r.correctCount ?? 0) : (r.keys ?? 0)
  return (
    <div className="records">
      <h3>
        記録ランキング
        {rankText && <span className="records-mode">{rankText}</span>}
        {modeText && <span className="records-mode">{modeText}</span>}
        <span className="records-sub">
          （{mainSub}順・最大{maxRecords}件）
        </span>
      </h3>
      {list.length === 0 ? (
        <p className="no-records">まだ記録がありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>{mainHead}</th>
              <th>正確率</th>
              <th>時間</th>
              <th>日時</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr
                key={i}
                className={`row-click ${highlight && r.date === highlight ? 'me' : ''}`}
                onClick={() =>
                  onRowClick?.(r, i + 1, { rankText, modeKey, list, isQuiz: false })
                }
                title="クリックで記録の詳細"
              >
                <td>{i + 1}</td>
                <td className="speed">{mainValue(r)}</td>
                <td>{r.accuracy}%</td>
                <td>{r.seconds}秒</td>
                <td className="date">{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
