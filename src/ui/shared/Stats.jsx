// ステータス表示の共有部品。

export function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

// ステータス4枚＋進捗バー。stats=[{label,value}], progress=0..1
export function StatsRow({ stats, progress }) {
  return (
    <>
      <div className="stats">
        {stats.map((s, i) => (
          <Stat key={i} label={s.label} value={s.value} />
        ))}
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${Math.min(1, progress) * 100}%` }} />
      </div>
    </>
  )
}
