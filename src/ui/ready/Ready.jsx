// スタート画面（レベル・モード選択）。
import { MODES, modeDesc, modeLabel } from '../../content/modes.js'
import { RANKS } from '../../content/sentences.js'
import { recKey } from '../../domain/records/ranking.js'
import { TARGET_KEYS } from '../../domain/marathon/passage.js'
import RecordsTable from '../result/RecordsTable.jsx'

export default function Ready({
  mode,
  onModeChange,
  rank,
  storySelected,
  onRankChange,
  onSelectStory,
  onStart,
  records,
}) {
  const courses = [...new Set(RANKS.map((r) => r.course))]
  return (
    <div className="ready">
      <p className="lead">
        日本人のための英語タイピング教材。レベル（日常会話→ビジネス会話→物語）とモードを選んで開始。
        マラソンは{TARGET_KEYS}文字で終了し、記録が出ます。
      </p>

      <div className="section-label">レベル</div>
      <div className="rank-select">
        {courses.map((course) => (
          <div className="rank-group" key={course}>
            <div className="rank-course">{course}</div>
            <div className="rank-btns">
              {RANKS.filter((r) => r.course === course).map((r) => (
                <button
                  key={r.rank}
                  className={`rank-btn ${!storySelected && rank === r.rank ? 'active' : ''}`}
                  onClick={() => onRankChange(r.rank)}
                >
                  <span className="rank-no">R{r.rank}</span>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="rank-group">
          <div className="rank-course">物語</div>
          <div className="rank-btns">
            <button
              className={`rank-btn story ${storySelected ? 'active' : ''}`}
              onClick={onSelectStory}
            >
              📖 海外旅行アドベンチャー
            </button>
          </div>
        </div>
      </div>

      <div className="section-label">モード</div>
      <div className="mode-select">
        {[...new Set(MODES.map((m) => m.group))].map((g) => (
          <div className="mode-group" key={g}>
            <div className="mode-course">{g}</div>
            <div className="mode-btns">
              {MODES.filter((m) => m.group === g).map((m) => (
                <button
                  key={m.key}
                  className={`mode-btn ${mode === m.key ? 'active' : ''}`}
                  onClick={() => onModeChange(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mode-desc">
        {storySelected
          ? `「${modeLabel(mode)}」で物語を進め、選択肢で分岐。複数のエンドあり。`
          : modeDesc(mode)}
      </p>

      <button className="btn-primary" onClick={onStart}>
        スタート
      </button>
      <p className="key-hint">
        <kbd>↑</kbd> <kbd>↓</kbd> レベル / <kbd>←</kbd> <kbd>→</kbd> モード / <kbd>Enter</kbd> スタート
      </p>

      {!storySelected && (
        <RecordsTable records={records[recKey(mode, rank)]} modeKey={mode} rank={rank} />
      )}
    </div>
  )
}
