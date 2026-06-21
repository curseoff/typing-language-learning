// スタート画面（レベル・モード/テーマ選択）。
import { MODES, modeDesc, modeLabel } from '../../content/modes.js'
import { RANKS } from '../../content/sentences.js'
import { WORD_LEVELS, WORD_MODES, WORD_THEMES } from '../../content/words.js'
import { recKey } from '../../domain/records/ranking.js'
import { TARGET_KEYS } from '../../domain/marathon/passage.js'
import RecordsTable from '../result/RecordsTable.jsx'

const THEME_OPTIONS = ['すべて', ...WORD_THEMES]

export default function Ready({
  mode,
  onModeChange,
  rank,
  storySelected,
  onRankChange,
  onSelectStory,
  wordLevel,
  wordTheme,
  wordMode,
  onSelectWord,
  onThemeChange,
  onWordModeChange,
  onStart,
  records,
}) {
  const courses = [...new Set(RANKS.map((r) => r.course))]
  const isWord = wordLevel != null
  const isMarathon = !storySelected && !isWord
  return (
    <div className="ready">
      <p className="lead">
        日本人のための英語タイピング教材。レベル（会話・物語・単語）とモードを選んで開始。
        マラソンは{TARGET_KEYS}文字、単語は30語で終了し、記録が出ます。
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
                  className={`rank-btn ${isMarathon && rank === r.rank ? 'active' : ''}`}
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
        <div className="rank-group">
          <div className="rank-course">単語</div>
          <div className="rank-btns">
            {WORD_LEVELS.map((l) => (
              <button
                key={l.level}
                className={`rank-btn ${isWord && wordLevel === l.level ? 'active' : ''}`}
                onClick={() => onSelectWord(l.level)}
              >
                <span className="rank-no">W{l.level}</span>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isWord ? (
        <>
          <div className="section-label">モード</div>
          <div className="mode-select">
            <div className="mode-group">
              <div className="mode-btns">
                {WORD_MODES.map((m) => (
                  <button
                    key={m.key}
                    className={`mode-btn ${wordMode === m.key ? 'active' : ''}`}
                    onClick={() => onWordModeChange(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="section-label">テーマ</div>
          <div className="mode-select">
            <div className="mode-group">
              <div className="mode-btns">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t}
                    className={`mode-btn ${wordTheme === t ? 'active' : ''}`}
                    onClick={() => onThemeChange(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="mode-desc">
            {wordMode === 'quiz-en'
              ? '和訳を見て、4つの英単語から正解を入力（英語訳・4択）。30問で終了。'
              : wordMode === 'quiz-ja'
                ? '英単語を見て、4つの和訳から正解をローマ字入力（日本語訳・4択）。30問で終了。'
                : '単語を入力。30語で終了します。'}
          </p>
        </>
      ) : (
        <>
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
        </>
      )}

      <button className="btn-primary" onClick={onStart}>
        スタート
      </button>
      <p className="key-hint">
        <kbd>↑</kbd> <kbd>↓</kbd> レベル / <kbd>←</kbd> <kbd>→</kbd> モード{isWord ? '（テーマはクリック）' : ''} /{' '}
        <kbd>Enter</kbd> スタート
      </p>

      {isMarathon && (
        <RecordsTable records={records[recKey(mode, rank)]} modeKey={mode} rank={rank} />
      )}
    </div>
  )
}
