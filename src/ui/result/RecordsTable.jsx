// 記録ランキングテーブル（モード×レベル別）。行クリックで記録詳細を表示。
import { modeLabel } from '../../content/modes.js'
import { MAX_RECORDS } from '../../domain/records/ranking.js'
import { useRecordDetail } from './useRecordDetail.jsx'

export default function RecordsTable({ records, modeKey, rankText, endCondition, highlight }) {
  const list = records || []
  const { open, modal } = useRecordDetail()
  // 主列は終了条件で切替える。問題数制・サドンデス（life）は「正解数」順、エンドレスは「速度」順、
  // 時間/文字数制は従来どおりタイピング数。#208 段6
  const kind = endCondition?.kind ?? 'time'
  const isItems = kind === 'items' || kind === 'life'
  const isEndless = kind === 'endless'
  const mainHead = isEndless ? '速度' : isItems ? '正解' : 'タイピング数'
  const mainSub = isEndless ? '速度' : isItems ? '正解数' : 'タイピング数'
  const mainValue = (r) => (isEndless ? (r.speed ?? 0) : isItems ? (r.correctCount ?? 0) : (r.keys ?? 0))
  return (
    <div className="records">
      <h3>
        記録ランキング
        {rankText && <span className="records-mode">{rankText}</span>}
        {modeKey && <span className="records-mode">{modeLabel(modeKey)}</span>}
        <span className="records-sub">（{mainSub}順・最大{MAX_RECORDS}件）</span>
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
                onClick={() => open(r, i + 1, { rankText, modeKey, list, isQuiz: false })}
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
      {modal}
    </div>
  )
}
