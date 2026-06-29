// 英英辞典タブ：レベル・テーマ・モード（入力/4択）の選択＋記録/収録一覧。
import { useState, useEffect } from 'react'
import { DICT_MODES, DICT_COUNTS, DICT_AVAILABLE_LEVELS, loadDict } from '../../content/dictionary.js'
import { dictRanking } from '../../application/records.js'
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

const DICT_QUIZ = DICT_MODES.filter((m) => m.key === 'quiz' || m.key === 'pick')
const DICT_INPUT = DICT_MODES.filter((m) => m.key === 'both' || m.key === 'en' || m.key === 'ja')

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

function dictModeDesc(key) {
  switch (key) {
    case 'both':
      return '1語ごとに見出し語の英語の定義→その和訳を続けて入力。'
    case 'pick':
      return '英単語＋意味を見て、4つの説明文から合うものを入力して選ぶ。60秒で終了。'
    case 'en':
      return '見出し語の英語の定義を入力（和訳は参考表示）。'
    case 'ja':
      return '見出し語の和訳をローマ字で入力（英語の定義は参考）。'
    default:
      return '英語の定義を読んで、4つの英単語から正解を入力（4択）。回答後に和訳を表示。60秒で終了。'
  }
}

export default function DictSection({
  dictLevel,
  dictTheme,
  dictMode,
  onDictLevelChange,
  onDictThemeChange,
  onDictModeChange,
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
  )
}
