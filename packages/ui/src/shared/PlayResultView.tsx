// 単語/英英のプレイ結果（presenter）：主成績・内訳・記録ランキング表を描くだけ。
// 主成績の種類（正解数／速度／タイピング数）は result.endCondition.kind から純粋に導出する。
// 記録詳細モーダル（useRecordDetail フック）は container 側で開き、onRowClick と modal を受ける。
import type { ReactNode } from 'react'
import SegStatsTable, { type SegStat } from '../result/SegStatsTable'

export interface PlayResultData {
  endCondition?: { kind?: string; value?: number } | null
  correctCount?: number
  speed?: number
  keys?: number
  accuracy?: number
  seconds?: number
  correct?: number
  words?: number
  mistakes?: number
  date?: string
  segStats?: SegStat[]
}

export interface PlayRecordRow {
  correctCount?: number
  speed?: number
  keys?: number
  accuracy?: number
  seconds?: number
  date?: string
}

export interface PlayResultViewProps {
  result: PlayResultData
  list: PlayRecordRow[]
  isQuiz: boolean
  showWordCount?: boolean // 非クイズ時に「N 語」を併記（英英のみ）
  onRetry: () => void
  onExit: () => void
  onRowClick: (row: PlayRecordRow, rank: number) => void
  modal?: ReactNode
}

export default function PlayResultView({
  result,
  list,
  isQuiz,
  showWordCount = false,
  onRetry,
  onExit,
  onRowClick,
  modal,
}: PlayResultViewProps) {
  // 問題数制・サドンデス（life）は主成績＝正解数。エンドレスは主成績＝速度（#208 段6）。時間/文字数制はタイピング数。
  const kind = result.endCondition?.kind ?? 'time'
  const isItems = kind === 'items'
  const isCorrect = isItems || kind === 'life' // items は分母つき、life は分母なしで正解数を表示
  const isEndless = kind === 'endless'
  return (
    <div className="result">
      <h2>記録</h2>
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
          <span>正解 {result.correctCount ?? 0}{isItems ? `/${result.endCondition?.value ?? 0}` : ''}問</span>
          <span>正確率 {result.accuracy}%</span>
          <span>{result.seconds} 秒</span>
        </div>
      ) : isQuiz ? (
        <div className="result-sub">
          <span>{isEndless ? `タイピング ${result.keys ?? 0}` : `速度 ${result.speed} 打/分`}</span>
          <span>正解 {result.correct}/{result.words}</span>
          <span>正確率 {result.accuracy}%</span>
          <span>{result.seconds} 秒</span>
        </div>
      ) : (
        <div className="result-sub">
          <span>{isEndless ? `タイピング ${result.keys ?? 0}` : `速度 ${result.speed} 打/分`}</span>
          {showWordCount && <span>{result.words} 語</span>}
          <span>ミス {result.mistakes}</span>
          <span>正確率 {result.accuracy}%</span>
          <span>{result.seconds} 秒</span>
        </div>
      )}
      <div className="ending-actions">
        <button className="btn-primary" onClick={onRetry}>
          もう一度
        </button>
        <button className="story-exit" onClick={onExit}>
          トップへ
        </button>
      </div>
      <p className="key-hint">
        <kbd>Enter</kbd> でもう一度 / <kbd>Esc</kbd> でトップへ
      </p>

      <SegStatsTable segStats={result.segStats} />
      <div className="records">
        <h3>記録ランキング（最大15件）</h3>
        {list.length === 0 ? (
          <p className="no-records">まだ記録がありません。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{isCorrect ? '正解' : isEndless ? '速度' : 'タイピング数'}</th>
                <th>正確率</th>
                <th>時間</th>
                <th>日時</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr
                  key={i}
                  className={`row-click ${r.date === result.date ? 'me' : ''}`}
                  onClick={() => onRowClick(r, i + 1)}
                  title="クリックで記録の詳細"
                >
                  <td>{i + 1}</td>
                  <td className="speed">{isCorrect ? (r.correctCount ?? 0) : isEndless ? (r.speed ?? 0) : (r.keys ?? 0)}</td>
                  <td>{r.accuracy}%</td>
                  <td>{r.seconds}秒</td>
                  <td className="date">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal}
    </div>
  )
}
