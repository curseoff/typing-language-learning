// 結果画面。
import { modeLabel } from '../../content/modes.js'
import { recKey } from '../../domain/records/ranking.js'
import RecordsTable from './RecordsTable.jsx'
import SegStatsTable from './SegStatsTable.jsx'

export default function Result({ result, records, segStats, onRetry }) {
  const rankText = `単語例文 L${result.rank} / ${result.theme ?? 'すべて'}`
  // 問題数制・サドンデス（life）は主成績＝正解数（一発正解した問題数）。時間/文字数制は従来どおりタイピング数。
  const kind = result.endCondition?.kind ?? 'time'
  const isItems = kind === 'items'
  const isCorrect = isItems || kind === 'life' // 主成績を正解数で表す（items は分母つき、life は分母なし）
  return (
    <div className="result">
      <h2>記録</h2>
      <div className="result-mode">
        {rankText} ／ {modeLabel(result.mode)}
      </div>
      <div className="result-main">
        <div className="result-speed">{isCorrect ? (result.correctCount ?? 0) : (result.keys ?? 0)}</div>
        <div className="result-unit">{isCorrect ? '正解（問）' : 'タイピング数'}</div>
      </div>
      {isCorrect ? (
        <div className="result-sub">
          <span>正解 {result.correctCount ?? 0}{isItems ? `/${result.endCondition?.value ?? 0}` : ''}問</span>
          <span>ミス {result.mistakes}</span>
          <span>正確率 {result.accuracy}%</span>
          <span>{result.seconds} 秒</span>
        </div>
      ) : (
        <div className="result-sub">
          <span>速度 {result.speed} 打/分</span>
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
        records={records[recKey(result.mode, result.rank, result.source, result.theme, result.endCondition)]}
        modeKey={result.mode}
        rankText={rankText}
        endCondition={result.endCondition}
        highlight={result.date}
      />
    </div>
  )
}
