// スタート画面。種類タブ（文章/物語/単語）で切り替え、選んだ種類の選択肢だけ表示する。
import { MODES, modeDesc, modeLabel } from '../../content/modes.js'
import { RANKS } from '../../content/sentences.js'
import { WORD_LEVELS, WORD_MODES, WORD_THEMES } from '../../content/words.js'
import { DICT_MODES } from '../../content/dictionary.js'
import { STORY } from '../../content/story.js'
import { recKey } from '../../domain/records/ranking.js'
import { DICT_AVAILABLE_LEVELS } from '../../domain/dictionary/dictset.js'
import { loadWordRecords, wordRecKey } from '../../infrastructure/wordsRepository.js'
import { loadStoryRecords } from '../../infrastructure/storyRepository.js'
import { loadDictRecords, dictRecKey } from '../../infrastructure/dictRepository.js'
import RecordsTable from '../result/RecordsTable.jsx'

const GAME_TYPES = [
  { key: 'marathon', icon: '📝', label: '文章', sub: '会話文を打つ' },
  { key: 'story', icon: '📖', label: '物語', sub: '分岐ストーリー' },
  { key: 'words', icon: '🔤', label: '単語', sub: '語彙を覚える' },
  { key: 'dict', icon: '📚', label: '英英辞典', sub: '英語で意味を学ぶ' },
]
const THEME_OPTIONS = ['すべて', ...WORD_THEMES]
const WORD_INPUT = WORD_MODES.filter((m) => !m.key.startsWith('quiz'))
const WORD_QUIZ = WORD_MODES.filter((m) => m.key.startsWith('quiz'))
const DICT_QUIZ = DICT_MODES.filter((m) => m.key === 'quiz')
const DICT_INPUT = DICT_MODES.filter((m) => m.key !== 'quiz')
const dictLevelLabel = (lv) => WORD_LEVELS.find((l) => l.level === lv)?.label ?? ''

function ModeButtons({ modes, value, onChange }) {
  return (
    <div className="mode-btns">
      {modes.map((m) => (
        <button
          key={m.key}
          className={`mode-btn ${value === m.key ? 'active' : ''}`}
          onClick={() => onChange(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

function SectionLabel({ children }) {
  return <div className="section-label">{children}</div>
}

export default function Ready({
  gameType,
  onTypeChange,
  mode,
  onModeChange,
  rank,
  onRankChange,
  wordLevel,
  wordTheme,
  wordMode,
  onWordLevelChange,
  onThemeChange,
  onWordModeChange,
  dictLevel,
  dictTheme,
  dictMode,
  onDictLevelChange,
  onDictThemeChange,
  onDictModeChange,
  onStart,
  records,
}) {
  const courses = [...new Set(RANKS.map((r) => r.course))]

  return (
    <div className="ready">
      <p className="lead">
        日本人のための英語タイピング教材。種類・レベル・モードを選んでスタート。
      </p>

      {/* 種類タブ */}
      <div className="type-tabs">
        {GAME_TYPES.map((t) => (
          <button
            key={t.key}
            className={`type-tab ${gameType === t.key ? 'active' : ''}`}
            onClick={() => onTypeChange(t.key)}
          >
            <span className="type-icon">{t.icon}</span>
            <span className="type-label">{t.label}</span>
            <span className="type-sub">{t.sub}</span>
          </button>
        ))}
      </div>

      {/* ── 文章（マラソン） ── */}
      {gameType === 'marathon' && (
        <>
          <SectionLabel>レベル</SectionLabel>
          <div className="rank-select">
            {courses.map((course) => (
              <div className="rank-group" key={course}>
                <div className="rank-course">{course}</div>
                <div className="rank-btns">
                  {RANKS.filter((r) => r.course === course).map((r) => (
                    <button
                      key={r.rank}
                      className={`rank-btn ${rank === r.rank ? 'active' : ''}`}
                      onClick={() => onRankChange(r.rank)}
                    >
                      <span className="rank-no">R{r.rank}</span>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <SectionLabel>モード</SectionLabel>
          <div className="mode-select">
            {[...new Set(MODES.map((m) => m.group))].map((g) => (
              <div className="mode-group" key={g}>
                <div className="mode-course">{g}</div>
                <ModeButtons
                  modes={MODES.filter((m) => m.group === g)}
                  value={mode}
                  onChange={onModeChange}
                />
              </div>
            ))}
          </div>
          <p className="mode-desc">{modeDesc(mode)} 600文字で終了します。</p>

          <StartRow onStart={onStart} />
          <RecordsTable records={records[recKey(mode, rank)]} modeKey={mode} rank={rank} />
        </>
      )}

      {/* ── 物語 ── */}
      {gameType === 'story' && (
        <>
          <div className="story-pick">📖 {STORY.title}（分岐・複数エンド）</div>
          <SectionLabel>モード</SectionLabel>
          <div className="mode-select">
            {[...new Set(MODES.map((m) => m.group))].map((g) => (
              <div className="mode-group" key={g}>
                <div className="mode-course">{g}</div>
                <ModeButtons
                  modes={MODES.filter((m) => m.group === g)}
                  value={mode}
                  onChange={onModeChange}
                />
              </div>
            ))}
          </div>
          <p className="mode-desc">「{modeLabel(mode)}」で物語を進め、選択肢で分岐します。</p>

          <StartRow onStart={onStart} />
          <StoryRecords list={loadStoryRecords()} />
        </>
      )}

      {/* ── 単語 ── */}
      {gameType === 'words' && (
        <>
          <SectionLabel>レベル</SectionLabel>
          <div className="rank-select">
            <div className="rank-group">
              <div className="rank-btns">
                {WORD_LEVELS.map((l) => (
                  <button
                    key={l.level}
                    className={`rank-btn ${wordLevel === l.level ? 'active' : ''}`}
                    onClick={() => onWordLevelChange(l.level)}
                  >
                    <span className="rank-no">W{l.level}</span>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <SectionLabel>テーマ</SectionLabel>
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

          <SectionLabel>モード</SectionLabel>
          <div className="mode-select">
            <div className="mode-group">
              <div className="mode-course">入力</div>
              <ModeButtons modes={WORD_INPUT} value={wordMode} onChange={onWordModeChange} />
            </div>
            <div className="mode-group">
              <div className="mode-course">4択クイズ</div>
              <ModeButtons modes={WORD_QUIZ} value={wordMode} onChange={onWordModeChange} />
            </div>
          </div>
          <p className="mode-desc">{wordModeDesc(wordMode)}</p>

          <StartRow onStart={onStart} />
          <WordRecords
            list={loadWordRecords()[wordRecKey(wordLevel, wordTheme, wordMode)]}
            isQuiz={wordMode.startsWith('quiz')}
          />
        </>
      )}

      {/* ── 英英辞典 ── */}
      {gameType === 'dict' && (
        <>
          <SectionLabel>レベル</SectionLabel>
          <div className="rank-select">
            <div className="rank-group">
              <div className="rank-btns">
                {DICT_AVAILABLE_LEVELS.map((lv) => (
                  <button
                    key={lv}
                    className={`rank-btn ${dictLevel === lv ? 'active' : ''}`}
                    onClick={() => onDictLevelChange(lv)}
                  >
                    <span className="rank-no">L{lv}</span>
                    {dictLevelLabel(lv)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <SectionLabel>テーマ</SectionLabel>
          <div className="mode-select">
            <div className="mode-group">
              <div className="mode-btns">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t}
                    className={`mode-btn ${dictTheme === t ? 'active' : ''}`}
                    onClick={() => onDictThemeChange(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <SectionLabel>モード</SectionLabel>
          <div className="mode-select">
            <div className="mode-group">
              <div className="mode-course">4択</div>
              <ModeButtons modes={DICT_QUIZ} value={dictMode} onChange={onDictModeChange} />
            </div>
            <div className="mode-group">
              <div className="mode-course">入力</div>
              <ModeButtons modes={DICT_INPUT} value={dictMode} onChange={onDictModeChange} />
            </div>
          </div>
          <p className="mode-desc">{dictModeDesc(dictMode)}</p>

          <StartRow onStart={onStart} />
          <WordRecords
            list={loadDictRecords()[dictRecKey(dictLevel, dictTheme, dictMode)]}
            isQuiz={dictMode === 'quiz'}
          />
        </>
      )}
    </div>
  )
}

function dictModeDesc(key) {
  switch (key) {
    case 'en':
      return '見出し語の英語の定義を入力（和訳は参考表示）。'
    case 'ja':
      return '見出し語の和訳をローマ字で入力（英語の定義は参考）。'
    default:
      return '英語の定義を読んで、4つの英単語から正解を入力（4択・20問）。回答後に和訳を表示。'
  }
}

function StartRow({ onStart }) {
  return (
    <>
      <button className="btn-primary" onClick={onStart}>
        スタート
      </button>
      <p className="key-hint">
        <kbd>Tab</kbd> 種類 / <kbd>↑</kbd> <kbd>↓</kbd> レベル / <kbd>←</kbd> <kbd>→</kbd> モード /{' '}
        <kbd>Enter</kbd> スタート
      </p>
    </>
  )
}

function wordModeDesc(key) {
  switch (key) {
    case 'quiz-en':
      return '和訳を見て、4つの英単語から正解を入力（4択）。30問で終了。'
    case 'quiz-ja':
      return '英単語を見て、4つの和訳から正解をローマ字入力（4択）。30問で終了。'
    case 'ja':
      return '英単語を見て和訳をローマ字入力。600文字で終了。'
    case 'both':
      return '1語ごとに英語→その和訳を入力。600文字で終了。'
    default:
      return '和訳を見て英単語を入力。600文字で終了。'
  }
}

// 単語の記録（入力=速度、4択=正解数）
function WordRecords({ list, isQuiz }) {
  const rows = list || []
  return (
    <div className="records">
      <h3>
        記録ランキング<span className="records-sub">（最大15件）</span>
      </h3>
      {rows.length === 0 ? (
        <p className="no-records">まだ記録がありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>{isQuiz ? '正解' : '速度'}</th>
              <th>正確率</th>
              <th>時間</th>
              <th>日時</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td className="speed">{isQuiz ? `${r.correct}/${r.words}` : `${r.speed} 打/分`}</td>
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

// 物語の記録（速度・エンド）
function StoryRecords({ list }) {
  const rows = list || []
  return (
    <div className="records">
      <h3>
        記録ランキング<span className="records-sub">（速い順・最大15件）</span>
      </h3>
      {rows.length === 0 ? (
        <p className="no-records">まだ記録がありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>速度</th>
              <th>正確率</th>
              <th>時間</th>
              <th>エンド</th>
              <th>日時</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td className="speed">{r.speed} 打/分</td>
                <td>{r.accuracy}%</td>
                <td>{r.seconds}秒</td>
                <td>{r.endLabel}</td>
                <td className="date">{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
