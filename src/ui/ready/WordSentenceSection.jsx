// 単語例文タブ：レベル・テーマ・モードの選択＋記録/収録一覧。
import { useState, useEffect } from 'react'
import { MODES, modeDesc } from '../../content/modes.js'
import { WSENT_COUNTS, loadWsentLevel, loadWsentThemes } from '../../content/wordSentences/index.js'
import { WORD_LEVELS } from '../../content/words.js'
import { recKey } from '../../domain/records/ranking.js'
import RecordsTable from '../result/RecordsTable.jsx'
import ItemList from './ItemList.jsx'
import { selCls, ModeButtons, SectionLabel, BottomTabs, StartRow, THEME_OPTIONS } from './parts.jsx'

// 単語例文の収録一覧。レベルの例文＋テーママップを遅延読み込みしてから ItemList を出す（初回バンドルに含めない）。
// 読み込んだ結果は対象レベルと一緒に持ち、レベルが変わった直後は「読み込み中…」を表示する。テーマで絞り込む。
function WsentList({ level, theme, mode }) {
  const [loaded, setLoaded] = useState(null) // { level, items, themes }
  useEffect(() => {
    let alive = true
    Promise.all([loadWsentLevel(level), loadWsentThemes()]).then(
      ([arr, themes]) => alive && setLoaded({ level, items: arr, themes: themes[level] ?? {} }),
    )
    return () => {
      alive = false
    }
  }, [level])
  if (!loaded || loaded.level !== level) return <p className="pool-count">読み込み中…</p>
  const items =
    theme === 'すべて' ? loaded.items : loaded.items.filter((s) => loaded.themes[s.word] === theme)
  return <ItemList items={items} type="marathon" mode={mode} />
}

export default function WordSentenceSection({
  mode,
  onModeChange,
  wsentLevel,
  onWsentLevelChange,
  wsentTheme,
  onWsentThemeChange,
  focusSection,
  onFocusSection,
  bottomTab,
  onBottomTabChange,
  onStart,
  records,
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

      <SectionLabel>テーマ</SectionLabel>
      <div className="mode-select">
        <div className="mode-group">
          <div className="mode-btns">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t}
                className={`mode-btn ${selCls(wsentTheme === t, focusSection === 'theme')}`}
                onClick={() => {
                  onWsentThemeChange(t)
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
      <p className="mode-desc">{modeDesc(mode)} 単語を使った例文を打ちます。60秒で終了します。</p>
      <p className="pool-count">この条件の収録: {WSENT_COUNTS[wsentLevel]?.[wsentTheme] ?? 0} 文</p>

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
        <WsentList level={wsentLevel} theme={wsentTheme} mode={mode} />
      ) : (
        <RecordsTable
          records={records[recKey(mode, wsentLevel, 'wsent', wsentTheme)]}
          modeKey={mode}
          rankText={`単語例文 L${wsentLevel} / ${wsentTheme}`}
        />
      )}
    </>
  )
}
