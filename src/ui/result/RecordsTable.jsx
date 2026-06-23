// 記録ランキングテーブル（モード×レベル別）。
import { modeLabel } from '../../content/modes.js'
import { MAX_RECORDS } from '../../domain/records/ranking.js'

export default function RecordsTable({ records, modeKey, rankText, highlight }) {
  const list = records || []
  return (
    <div className="records">
      <h3>
        記録ランキング
        {rankText && <span className="records-mode">{rankText}</span>}
        {modeKey && <span className="records-mode">{modeLabel(modeKey)}</span>}
        <span className="records-sub">（速い順・最大{MAX_RECORDS}件）</span>
      </h3>
      {list.length === 0 ? (
        <p className="no-records">まだ記録がありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>速度</th>
              <th>正確率</th>
              <th>時間</th>
              <th>日時</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={i} className={highlight && r.date === highlight ? 'me' : ''}>
                <td>{i + 1}</td>
                <td className="speed">{r.speed} 打/分</td>
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
