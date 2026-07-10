// ローマ字入力タブ：練習範囲（行グループ）の選択＋記録ランキング。
import { ROMAJI_LEVELS, ROMAJI_MODE } from '../../content/romaji.js'
import { recKey, MAX_RECORDS } from '../../domain/records/ranking.service.js'
import { selCls, SectionLabel, StartRow } from './parts.container.jsx'

// ローマ字入力の記録（タイピング数＝かな数順）。クリック詳細は持たない簡易テーブル。
function RomajiRecords({ list, rankText }) {
  const rows = list || []
  return (
    <div className="records">
      <h3>
        記録ランキング
        {rankText && <span className="records-mode">{rankText}</span>}
        <span className="records-sub">（かな数順・最大{MAX_RECORDS}件）</span>
      </h3>
      {rows.length === 0 ? (
        <p className="no-records">まだ記録がありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>かな数</th>
              <th>正確率</th>
              <th>時間</th>
              <th>日時</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td className="speed">{r.keys ?? 0}</td>
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

export default function RomajiSection({
  romajiLevel,
  onRomajiLevelChange,
  focusSection,
  onFocusSection,
  onStart,
  records,
}) {
  return (
    <>
      <SectionLabel>練習範囲</SectionLabel>
      <div className="rank-select">
        <div className="rank-group">
          <div className="rank-btns">
            {ROMAJI_LEVELS.map((l) => (
              <button
                key={l.key}
                className={`rank-btn ${selCls(romajiLevel === l.key, focusSection === 'level')}`}
                onClick={() => {
                  onRomajiLevelChange(l.key)
                  onFocusSection('level')
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mode-desc">
        表示されたかなをローマ字で打ちます。かな表で今どこを打っているかを確認しながら、指の位置を覚えて練習。60秒で終了。
      </p>

      <StartRow onStart={onStart} />
      <RomajiRecords
        list={records[recKey(ROMAJI_MODE, romajiLevel, 'romaji')]}
        rankText={ROMAJI_LEVELS.find((l) => l.key === romajiLevel)?.label ?? romajiLevel}
      />
    </>
  )
}
