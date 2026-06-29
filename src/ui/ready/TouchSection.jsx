// タッチタイピングタブ：レベル・モードの選択＋記録ランキング。
import { TOUCH_LEVELS, TOUCH_MODES } from '../../content/keyboard.js'
import { recKey, MAX_RECORDS } from '../../domain/records/ranking.js'
import { selCls, ModeButtons, SectionLabel, StartRow } from './parts.jsx'

// タッチタイピングの記録（速い順）。クリック詳細は持たない簡易テーブル。
function TouchRecords({ list, rankText }) {
  const rows = list || []
  return (
    <div className="records">
      <h3>
        記録ランキング
        {rankText && <span className="records-mode">{rankText}</span>}
        <span className="records-sub">（タイピング数順・最大{MAX_RECORDS}件）</span>
      </h3>
      {rows.length === 0 ? (
        <p className="no-records">まだ記録がありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>タイピング数</th>
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

export default function TouchSection({
  touchLevel,
  onTouchLevelChange,
  touchMode,
  onTouchModeChange,
  focusSection,
  onFocusSection,
  onStart,
  records,
}) {
  return (
    <>
      <SectionLabel>レベル</SectionLabel>
      <div className="rank-select">
        <div className="rank-group">
          <div className="rank-btns">
            {TOUCH_LEVELS.map((l) => (
              <button
                key={l.key}
                className={`rank-btn ${selCls(touchLevel === l.key, focusSection === 'level')}`}
                onClick={() => {
                  onTouchLevelChange(l.key)
                  onFocusSection('level')
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <SectionLabel>モード</SectionLabel>
      <div className="mode-select">
        <div className="mode-group">
          <ModeButtons
            modes={TOUCH_MODES}
            value={touchMode}
            focused={focusSection === 'mode'}
            onChange={(k) => {
              onTouchModeChange(k)
              onFocusSection('mode')
            }}
          />
        </div>
      </div>
      <p className="mode-desc">
        {touchMode === 'hard'
          ? '打つキーはハイライトされません。位置を思い出してブラインドタッチ。ミスすると押したキーが光ります。60秒で終了。'
          : '打つキーが画面のキーボードでハイライトされます。指の位置を覚えて練習。ミスすると押したキーが光ります。60秒で終了。'}
      </p>

      <StartRow onStart={onStart} />
      <TouchRecords
        list={records[recKey(touchMode, touchLevel, 'touch')]}
        rankText={`${TOUCH_LEVELS.find((l) => l.key === touchLevel)?.label ?? touchLevel} ・ ${
          TOUCH_MODES.find((m) => m.key === touchMode)?.label ?? touchMode
        }`}
      />
    </>
  )
}
