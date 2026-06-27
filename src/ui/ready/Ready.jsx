// スタート画面。種類タブ（文章/物語/単語）で切り替え、選んだ種類の選択肢だけ表示する。
import { useState, useEffect } from 'react'
import { MODES, modeDesc, modeLabel } from '../../content/modes.js'
import { WSENT_COUNTS, loadWsentLevel } from '../../content/wordSentences/index.js'
import { WORD_LEVELS, WORD_MODES, WORD_THEMES, WORD_COUNTS, loadWords } from '../../content/words.js'
import { DICT_MODES, DICT_COUNTS, DICT_AVAILABLE_LEVELS, loadDict } from '../../content/dictionary.js'
import { TOUCH_LEVELS, TOUCH_MODES } from '../../content/keyboard.js'
import { STORIES, storyById } from '../../content/stories/index.js'
import { recKey, MAX_RECORDS } from '../../domain/records/ranking.js'
import {
  loadStoryRecords,
  loadItemStats,
  wordRanking,
  dictRanking,
  storyStatId,
} from '../../application/records.js'
import RecordsTable from '../result/RecordsTable.jsx'
import { useRecordDetail } from '../result/useRecordDetail.jsx'
import ItemList from './ItemList.jsx'

const GAME_TYPES = [
  { key: 'story', icon: '📖', label: '物語', sub: '分岐ストーリー' },
  { key: 'words', icon: '🔤', label: '単語', sub: '語彙を覚える' },
  { key: 'wsent', icon: '✍️', label: '単語例文', sub: '単語を文で使う' },
  { key: 'dict', icon: '📚', label: '英英辞典', sub: '英語で意味を学ぶ' },
  { key: 'touch', icon: '⌨️', label: 'タッチタイピング', sub: 'ブラインドタッチ' },
]
const THEME_OPTIONS = ['すべて', ...WORD_THEMES]
const WORD_INPUT = WORD_MODES.filter((m) => !m.key.startsWith('quiz'))
const WORD_QUIZ = WORD_MODES.filter((m) => m.key.startsWith('quiz'))
const DICT_QUIZ = DICT_MODES.filter((m) => m.key === 'quiz' || m.key === 'pick')
const DICT_INPUT = DICT_MODES.filter((m) => m.key === 'en' || m.key === 'ja')
const dictLevelLabel = (lv) => WORD_LEVELS.find((l) => l.level === lv)?.label ?? ''

// 選択状態のクラス。フォーカス行の選択＝青枠(sel-focus)、非フォーカス行の選択＝青背景(sel)。
const selCls = (selected, focused) => (selected ? (focused ? 'sel-focus' : 'sel') : '')

function ModeButtons({ modes, value, onChange, focused }) {
  return (
    <div className="mode-btns">
      {modes.map((m) => (
        <button
          key={m.key}
          className={`mode-btn ${selCls(value === m.key, focused)}`}
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

// 単語例文の収録一覧。レベルの例文を遅延読み込みしてから ItemList を出す（初回バンドルに含めない）。
// 読み込んだ結果は対象レベルと一緒に持ち、レベルが変わった直後は「読み込み中…」を表示する。
function WsentList({ level, mode }) {
  const [loaded, setLoaded] = useState(null) // { level, items }
  useEffect(() => {
    let alive = true
    loadWsentLevel(level).then((arr) => alive && setLoaded({ level, items: arr }))
    return () => {
      alive = false
    }
  }, [level])
  if (!loaded || loaded.level !== level) return <p className="pool-count">読み込み中…</p>
  return <ItemList items={loaded.items} type="marathon" mode={mode} />
}

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

// 英英の収録一覧。英英データを遅延読み込みしてレベル×テーマで絞る。
function DictList({ level, theme, mode }) {
  const [dict, setDict] = useState(null)
  useEffect(() => {
    let alive = true
    loadDict().then((arr) => alive && setDict(arr))
    return () => {
      alive = false
    }
  }, [])
  if (!dict) return <p className="pool-count">読み込み中…</p>
  const items = dict.filter((d) => d.level === level && (theme === 'すべて' || d.theme === theme))
  return <ItemList items={items} type="dict" mode={mode} />
}

// 下部の「記録ランキング / 収録一覧」切り替え
function BottomTabs({ value, onChange, focused }) {
  return (
    <div className="bottom-tabs">
      {[
        ['records', '記録ランキング'],
        ['list', '収録一覧'],
      ].map(([k, label]) => (
        <button
          key={k}
          className={`bottom-tab ${selCls(value === k, focused)}`}
          onClick={() => onChange(k)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// 物語タブ：物語の選択カード＋モード＋記録/一覧。
function StorySection({ storyId, onStoryIdChange, mode, onModeChange, onStart, bottomTab, onBottomTabChange, focusSection, onFocusSection }) {
  const story = storyById(storyId)
  return (
    <>
      <SectionLabel>物語</SectionLabel>
      <div className="story-select">
        {STORIES.map((s) => (
          <button
            key={s.id}
            className={`story-card ${selCls(storyId === s.id, focusSection === 'story')}`}
            onClick={() => {
              onStoryIdChange(s.id)
              onFocusSection('story')
            }}
          >
            <span className="story-card-title">📖 {s.title}</span>
            <span className="story-card-sub">
              {Object.keys(s.nodes).length} 場面 / {s.endingCount} エンド
            </span>
          </button>
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
              focused={focusSection === 'mode'}
              onChange={(k) => {
                onModeChange(k)
                onFocusSection('mode')
              }}
            />
          </div>
        ))}
      </div>
      <p className="mode-desc">「{modeLabel(mode)}」で物語を進め、選択肢で分岐します。</p>
      <p className="pool-count">
        この物語の収録: {Object.keys(story.nodes).length} 場面 / {story.endingCount} エンド
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
        <StoryScenes story={story} mode={mode} />
      ) : (
        <StoryRecords list={loadStoryRecords(storyId)} rankText={story.title} />
      )}
    </>
  )
}

export default function Ready({
  gameType,
  onTypeChange,
  mode,
  onModeChange,
  storyId,
  onStoryIdChange,
  wsentLevel,
  onWsentLevelChange,
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
  touchLevel,
  onTouchLevelChange,
  touchMode,
  onTouchModeChange,
  focusSection,
  onFocusSection,
  bottomTab,
  onBottomTabChange,
  onStart,
  records,
}) {

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
            className={`type-tab ${selCls(gameType === t.key, focusSection === 'type')}`}
            onClick={() => {
              onTypeChange(t.key)
              onFocusSection('type')
            }}
          >
            <span className="type-icon">{t.icon}</span>
            <span className="type-label">{t.label}</span>
            <span className="type-sub">{t.sub}</span>
          </button>
        ))}
      </div>

      {/* ── 単語例文（レベル別） ── */}
      {gameType === 'wsent' && (
        <>
          <SectionLabel>レベル</SectionLabel>
          <div className="rank-select">
            <div className="rank-group">
              <div className="rank-course">語レベル</div>
              <div className="rank-btns">
                {WORD_LEVELS.map((l) => (
                  <button
                    key={l.level}
                    className={`rank-btn ${selCls(wsentLevel === l.level, focusSection === 'level')}`}
                    onClick={() => {
                      onWsentLevelChange(l.level)
                      onFocusSection('level')
                    }}
                  >
                    <span className="rank-no">L{l.level}</span>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <SectionLabel>モード</SectionLabel>
          <div className="mode-select">
            {[...new Set(MODES.map((m) => m.group))].map((g) => (
              <div className="mode-group" key={g}>
                <div className="mode-course">{g}</div>
                <ModeButtons
                  modes={MODES.filter((m) => m.group === g)}
                  value={mode}
                  focused={focusSection === 'mode'}
                  onChange={(k) => {
                    onModeChange(k)
                    onFocusSection('mode')
                  }}
                />
              </div>
            ))}
          </div>
          <p className="mode-desc">{modeDesc(mode)} 単語を使った例文を打ちます。600文字で終了します。</p>
          <p className="pool-count">この条件の収録: {WSENT_COUNTS[wsentLevel]} 文</p>

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
            <WsentList level={wsentLevel} mode={mode} />
          ) : (
            <RecordsTable
              records={records[recKey(mode, wsentLevel, 'wsent')]}
              modeKey={mode}
              rankText={`単語例文 L${wsentLevel}`}
            />
          )}
        </>
      )}

      {/* ── 物語 ── */}
      {gameType === 'story' && (
        <StorySection
          storyId={storyId}
          onStoryIdChange={onStoryIdChange}
          mode={mode}
          onModeChange={onModeChange}
          onStart={onStart}
          bottomTab={bottomTab}
          onBottomTabChange={onBottomTabChange}
          focusSection={focusSection}
          onFocusSection={onFocusSection}
        />
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
                    className={`rank-btn ${selCls(dictLevel === lv, focusSection === 'level')}`}
                    onClick={() => {
                      onDictLevelChange(lv)
                      onFocusSection('level')
                    }}
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
                    className={`mode-btn ${selCls(dictTheme === t, focusSection === 'theme')}`}
                    onClick={() => {
                      onDictThemeChange(t)
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
              <div className="mode-course">4択</div>
              <ModeButtons
                modes={DICT_QUIZ}
                value={dictMode}
                focused={focusSection === 'mode'}
                onChange={(k) => {
                  onDictModeChange(k)
                  onFocusSection('mode')
                }}
              />
            </div>
            <div className="mode-group">
              <div className="mode-course">入力</div>
              <ModeButtons
                modes={DICT_INPUT}
                value={dictMode}
                focused={focusSection === 'mode'}
                onChange={(k) => {
                  onDictModeChange(k)
                  onFocusSection('mode')
                }}
              />
            </div>
          </div>
          <p className="mode-desc">{dictModeDesc(dictMode)}</p>
          <p className="pool-count">この条件の収録: {DICT_COUNTS[dictLevel]?.[dictTheme] ?? 0} 語</p>

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
            <DictList level={dictLevel} theme={dictTheme} mode={dictMode} />
          ) : (
            <WordRecords
              list={dictRanking(dictLevel, dictTheme, dictMode)}
              isQuiz={dictMode === 'quiz' || dictMode === 'pick'}
              rankText={`英英 ${dictLevelLabel(dictLevel)} ${dictTheme}`}
            />
          )}
        </>
      )}

      {/* ── タッチタイピング ── */}
      {gameType === 'touch' && (
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
              ? '打つキーはハイライトされません。位置を思い出してブラインドタッチ。ミスすると押したキーが光ります。40打で終了。'
              : '打つキーが画面のキーボードでハイライトされます。指の位置を覚えて練習。ミスすると押したキーが光ります。40打で終了。'}
          </p>

          <StartRow onStart={onStart} />
          <TouchRecords
            list={records[recKey(touchMode, touchLevel, 'touch')]}
            rankText={`${TOUCH_LEVELS.find((l) => l.key === touchLevel)?.label ?? touchLevel} ・ ${
              TOUCH_MODES.find((m) => m.key === touchMode)?.label ?? touchMode
            }`}
          />
        </>
      )}
    </div>
  )
}

function dictModeDesc(key) {
  switch (key) {
    case 'pick':
      return '英単語＋意味を見て、4つの説明文から合うものを入力して選ぶ（12問）。'
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
        <kbd>↑</kbd> <kbd>↓</kbd> 項目 / <kbd>←</kbd> <kbd>→</kbd> 選択 / <kbd>Enter</kbd> スタート
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

// タッチタイピングの記録（速い順）。クリック詳細は持たない簡易テーブル。
function TouchRecords({ list, rankText }) {
  const rows = list || []
  return (
    <div className="records">
      <h3>
        記録ランキング
        {rankText && <span className="records-mode">{rankText}</span>}
        <span className="records-sub">（速い順・最大{MAX_RECORDS}件）</span>
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
                <td className="date">{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// 単語の記録（入力=速度、4択=正解数）。行クリックで詳細。
function WordRecords({ list, isQuiz, rankText }) {
  const rows = list || []
  const { open, modal } = useRecordDetail()
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
              <tr
                key={i}
                className="row-click"
                onClick={() => open(r, i + 1, { rankText, list: rows, isQuiz })}
                title="クリックで記録の詳細"
              >
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
      {modal}
    </div>
  )
}

// 物語の記録（速度・エンド）
// 物語の場面一覧（入力した本文）。未プレイの場面は ？？？ で伏せる。
function StoryScenes({ story, mode }) {
  const stats = loadItemStats()
  return (
    <ol className="browse-list">
      {Object.entries(story.nodes).map(([id, n]) => {
        const s = stats[storyStatId(mode, story.id, id)]
        return (
          <li key={id} className="browse-item">
            {s ? (
              <>
                <span className="bi-en">{n.en}</span>
                <span className="bi-ja">{n.ja}</span>
                <span className="bi-stat">
                  練習 {s.count}回 ・ 平均ミス {(s.mistakes / s.count).toFixed(1)} ・{' '}
                  {(s.ms > 0 ? s.keys / (s.ms / 1000) : 0).toFixed(1)} 打/秒
                </span>
              </>
            ) : (
              <span className="bi-en">？？？</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function StoryRecords({ list, rankText = '物語' }) {
  const rows = list || []
  const { open, modal } = useRecordDetail()
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
              <tr
                key={i}
                className="row-click"
                onClick={() => open(r, i + 1, { rankText, list: rows, hasEnding: true })}
                title="クリックで記録の詳細"
              >
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
      {modal}
    </div>
  )
}
