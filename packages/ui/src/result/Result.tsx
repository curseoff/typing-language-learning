// 結果画面（presenter）。主成績・内訳・SegStatsTable・RecordsTable を描くだけ。
// records の解決（recKey）・modeLabel・記録詳細（useRecordDetail）は container に置き、
// ここは props（result / modeText / segStats / 解決済み records / onRowClick / recordsModal 等）で描く。
import type { ReactNode } from 'react'
import SegStatsTable, { type SegStat } from './SegStatsTable'
import RecordsTable, { type RecordRow, type RecordsTableProps } from './RecordsTable'

export interface ResultData {
  mode: string
  rank: number
  theme?: string
  source?: string
  endCondition?: { kind?: string; value?: number | null } | null
  keys?: number
  speed?: number
  correctCount?: number
  mistakes?: number | string
  accuracy?: number | string
  seconds?: number | string
  date?: string
}

export interface ResultProps {
  result: ResultData
  modeText: string // container が解決した modeLabel(result.mode)
  segStats?: SegStat[]
  records?: RecordRow[] // container が解決した records[recKey(...)]
  maxRecords?: number
  onRowClick?: RecordsTableProps['onRowClick']
  recordsModal?: ReactNode // useRecordDetail の modal（container 提供）
  onRetry: () => void
}

export default function Result({
  result,
  modeText,
  segStats,
  records,
  maxRecords,
  onRowClick,
  recordsModal,
  onRetry,
}: ResultProps) {
  const rankText = `単語例文 L${result.rank} / ${result.theme ?? 'すべて'}`
  // 問題数制・サドンデス（life）は主成績＝正解数（一発正解した問題数）。エンドレスは主成績＝速度（#208 段6）。
  // 時間/文字数制は従来どおりタイピング数。
  const kind = result.endCondition?.kind ?? 'time'
  const isItems = kind === 'items'
  const isCorrect = isItems || kind === 'life' // 主成績を正解数で表す（items は分母つき、life は分母なし）
  const isEndless = kind === 'endless'
  return (
    <div className="result">
      <h2>記録</h2>
      <div className="result-mode">
        {rankText} ／ {modeText}
      </div>
      <div className="result-main">
        <div className="result-speed">
          {isCorrect ? (result.correctCount ?? 0) : isEndless ? (result.speed ?? 0) : (result.keys ?? 0)}
        </div>
        <div className="result-unit">
          {isCorrect ? '正解（問）' : isEndless ? '打/分（速度）' : 'タイピング数'}
        </div>
      </div>
      {isCorrect ? (
        <div className="result-sub">
          <span>
            正解 {result.correctCount ?? 0}
            {isItems ? `/${result.endCondition?.value ?? 0}` : ''}問
          </span>
          <span>ミス {result.mistakes}</span>
          <span>正確率 {result.accuracy}%</span>
          <span>{result.seconds} 秒</span>
        </div>
      ) : (
        <div className="result-sub">
          <span>{isEndless ? `タイピング ${result.keys ?? 0}` : `速度 ${result.speed} 打/分`}</span>
          <span>ミス {result.mistakes}</span>
          <span>正確率 {result.accuracy}%</span>
          <span>{result.seconds} 秒</span>
        </div>
      )}
      <button className="btn-primary" onClick={onRetry}>
        もう一度
      </button>
      <p className="key-hint">
        <kbd>Enter</kbd> でもう一度 / <kbd>Esc</kbd> でトップへ
      </p>
      <SegStatsTable segStats={segStats} />
      <RecordsTable
        records={records}
        modeKey={result.mode}
        modeText={modeText}
        rankText={rankText}
        endCondition={result.endCondition}
        highlight={result.date}
        maxRecords={maxRecords}
        onRowClick={onRowClick}
      />
      {recordsModal}
    </div>
  )
}
