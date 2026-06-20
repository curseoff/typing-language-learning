// 結果画面。
import { modeLabel } from '../../content/modes.js'
import { rankLabel } from '../../content/sentences.js'
import { recKey } from '../../domain/records/ranking.js'
import RecordsTable from './RecordsTable.jsx'
import SegStatsTable from './SegStatsTable.jsx'

export default function Result({ result, records, segStats, onRetry }) {
  return (
    <div className="result">
      <h2>記録</h2>
      <div className="result-mode">
        {rankLabel(result.rank)} ／ {modeLabel(result.mode)}
      </div>
      <div className="result-main">
        <div className="result-speed">{result.speed}</div>
        <div className="result-unit">打/分</div>
      </div>
      <div className="result-sub">
        <span>{result.keys} 打</span>
        <span>{result.seconds} 秒</span>
        <span>ミス {result.mistakes}</span>
        <span>正確率 {result.accuracy}%</span>
      </div>
      <button className="btn-primary" onClick={onRetry}>
        もう一度
      </button>
      <p className="key-hint">
        <kbd>Enter</kbd> でもう一度 / <kbd>Esc</kbd> でトップへ
      </p>
      <SegStatsTable segStats={segStats} />
      <RecordsTable
        records={records[recKey(result.mode, result.rank)]}
        modeKey={result.mode}
        rank={result.rank}
        highlight={result.date}
      />
    </div>
  )
}
