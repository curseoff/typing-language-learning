// 問題ごとの記録テーブル。入力系（速度）と4択クイズ系（正誤）の両対応。
export default function SegStatsTable({ segStats }) {
  if (!segStats || segStats.length === 0) return null
  const isQuiz = segStats[0].correct !== undefined

  if (isQuiz) {
    return (
      <div className="seg-stats">
        <h3>問題ごとの記録</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>問題</th>
              <th>正誤</th>
              <th>ミス</th>
            </tr>
          </thead>
          <tbody>
            {segStats.map((s) => (
              <tr key={s.no} className={s.correct ? '' : 'has-miss'}>
                <td>{s.no}</td>
                <td className="q-label">
                  {s.label}
                  {s.answer && <span className="q-answer"> → {s.answer}</span>}
                </td>
                <td className={s.correct ? 'ok' : 'miss'}>{s.correct ? '○' : '×'}</td>
                <td className={s.mistakes > 0 ? 'miss' : ''}>{s.mistakes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="seg-stats">
      <h3>問題ごとの記録</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>種別</th>
            <th>問題</th>
            <th>速度</th>
            <th>ミス</th>
          </tr>
        </thead>
        <tbody>
          {segStats.map((s) => (
            <tr key={s.no} className={s.mistakes > 0 ? 'has-miss' : ''}>
              <td>{s.no}</td>
              <td>
                <span className={`type-badge ${s.type}`}>{s.type === 'en' ? '英' : '和'}</span>
              </td>
              <td className="q-label">
                {s.label}
                {s.partial && <span className="partial-tag">途中</span>}
              </td>
              <td className="speed">{s.speed} 打/分</td>
              <td className={s.mistakes > 0 ? 'miss' : ''}>{s.mistakes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
