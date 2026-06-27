// 結果画面。
import { modeLabel } from '../../content/modes.js'
import { recKey } from '../../domain/records/ranking.js'
import RecordsTable from './RecordsTable.jsx'
import SegStatsTable from './SegStatsTable.jsx'

export default function Result({ result, records, segStats, onRetry }) {
  const rankText = `単語例文 L${result.rank}`
  return (
    <div className="result">
      <h2>記録</h2>
      <div className="result-mode">
        {rankText} ／ {modeLabel(result.mode)}
      </div>
      <div className="result-main">
        <div className="result-speed">{result.keys ?? 0}</div>
        <div className="result-unit">タイピング数</div>
      </div>
      <div className="result-sub">
        <span>速度 {result.speed} 打/分</span>
        <span>ミス {result.mistakes}</span>
        <span>正確率 {result.accuracy}%</span>
        <span>{result.seconds} 秒</span>
      </div>
      <button className="btn-primary" onClick={onRetry}>
        もう一度
      </button>
      <p className="key-hint">
        <kbd>Enter</kbd> でもう一度 / <kbd>Esc</kbd> でトップへ
      </p>
      <SegStatsTable segStats={segStats} />
      <RecordsTable
        records={records[recKey(result.mode, result.rank, result.source)]}
        modeKey={result.mode}
        rankText={rankText}
        highlight={result.date}
      />
    </div>
  )
}
