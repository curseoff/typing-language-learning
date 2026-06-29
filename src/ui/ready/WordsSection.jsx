// 単語タブ：レベル・テーマ・モード（入力/4択）の選択＋記録/収録一覧。
import { useState, useEffect } from 'react'
import { WORD_LEVELS, WORD_MODES, WORD_COUNTS, loadWords } from '../../content/words.js'
import { wordRanking } from '../../application/records.js'
import ItemList from './ItemList.jsx'
import {
  selCls,
  ModeButtons,
  SectionLabel,
  BottomTabs,
  StartRow,
  WordRecords,
  THEME_OPTIONS,
  dictLevelLabel,
} from './parts.jsx'

const WORD_INPUT = WORD_MODES.filter((m) => !m.key.startsWith('quiz'))
const WORD_QUIZ = WORD_MODES.filter((m) => m.key.startsWith('quiz'))

// 単語の収録一覧。単語データを遅延読み込みしてレベル×テーマで絞る。
function WordsList({ level, theme, mode }) {
  const [words, setWords] = useState(null)
  useEffect(() => {
    let alive = true
    loadWords().then((arr) => alive && setWords(arr))
    return () => {
      alive = false
    }
  }, [])
  if (!words) return <p className="pool-count">読み込み中…</p>
  const items = words.filter((w) => w.level === level && (theme === 'すべて' || w.theme === theme))
  return <ItemList items={items} type="words" mode={mode} />
}

function wordModeDesc(key) {
  switch (key) {
    case 'quiz-en':
      return '和訳を見て、4つの英単語から正解を入力（4択）。60秒で終了。'
    case 'quiz-ja':
      return '英単語を見て、4つの和訳から正解をローマ字入力（4択）。60秒で終了。'
    case 'ja':
      return '英単語を見て和訳をローマ字入力。60秒で終了。'
    case 'both':
      return '1語ごとに英語→その和訳を入力。60秒で終了。'
    default:
      return '和訳を見て英単語を入力。60秒で終了。'
  }
}

export default function WordsSection({
  wordLevel,
  wordTheme,
  wordMode,
  onWordLevelChange,
  onThemeChange,
  onWordModeChange,
  focusSection,
  onFocusSection,
  bottomTab,
  onBottomTabChange,
  onStart,
}) {
  return (
    <>
      <SectionLabel>レベル</SectionLabel>
      <div className="rank-select">
        <div className="rank-group">
          <div className="rank-btns">
            {WORD_LEVELS.map((l) => (
              <button
                key={l.level}
                className={`rank-btn ${selCls(wordLevel === l.level, focusSection === 'level')}`}
                onClick={() => {
                  onWordLevelChange(l.level)
                  onFocusSection('level')
                }}
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
                className={`mode-btn ${selCls(wordTheme === t, focusSection === 'theme')}`}
                onClick={() => {
                  onThemeChange(t)
                  onFocusSection('theme')
                }}
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
          <ModeButtons
            modes={WORD_INPUT}
            value={wordMode}
            focused={focusSection === 'mode'}
            onChange={(k) => {
              onWordModeChange(k)
              onFocusSection('mode')
            }}
          />
        </div>
        <div className="mode-group">
          <div className="mode-course">4択クイズ</div>
          <ModeButtons
            modes={WORD_QUIZ}
            value={wordMode}
            focused={focusSection === 'mode'}
            onChange={(k) => {
              onWordModeChange(k)
              onFocusSection('mode')
            }}
          />
        </div>
      </div>
      <p className="mode-desc">{wordModeDesc(wordMode)}</p>
      <p className="pool-count">
        この条件の収録: {WORD_COUNTS[wordLevel]?.[wordTheme] ?? 0} 語
      </p>

      <StartRow onStart={onStart} />
      <BottomTabs
        value={bottomTab}
        focused={focusSection === 'bottom'}
        onChange={(k) => {
          onBottomTabChange(k)
          onFocusSection('bottom')
        }}
      />
      {bottomTab === 'list' ? (
        <WordsList level={wordLevel} theme={wordTheme} mode={wordMode} />
      ) : (
        <WordRecords
          list={wordRanking(wordLevel, wordTheme, wordMode)}
          isQuiz={wordMode.startsWith('quiz')}
          rankText={`単語 ${dictLevelLabel(wordLevel)} ${wordTheme}`}
        />
      )}
    </>
  )
}
