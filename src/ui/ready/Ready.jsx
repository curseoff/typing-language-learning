// スタート画面。種類タブ（文章/物語/単語）で切り替え、選んだ種類の選択肢だけ表示する。
import { selCls } from './parts.jsx'
import WordSentenceSection from './WordSentenceSection.jsx'
import StorySection from './StorySection.jsx'
import WordsSection from './WordsSection.jsx'
import DictSection from './DictSection.jsx'
import TouchSection from './TouchSection.jsx'

const GAME_TYPES = [
  { key: 'story', icon: '📖', label: '物語', sub: '分岐ストーリー' },
  { key: 'words', icon: '🔤', label: '単語', sub: '語彙を覚える' },
  { key: 'wsent', icon: '✍️', label: '単語例文', sub: '単語を文で使う' },
  { key: 'dict', icon: '📚', label: '英英辞典', sub: '英語で意味を学ぶ' },
  { key: 'touch', icon: '⌨️', label: 'タッチタイピング', sub: 'ブラインドタッチ' },
]

export default function Ready({
  gameType,
  onTypeChange,
  mode,
  onModeChange,
  storyId,
  onStoryIdChange,
  wsentLevel,
  onWsentLevelChange,
  wsentTheme,
  onWsentThemeChange,
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
        <WordSentenceSection
          mode={mode}
          onModeChange={onModeChange}
          wsentLevel={wsentLevel}
          onWsentLevelChange={onWsentLevelChange}
          wsentTheme={wsentTheme}
          onWsentThemeChange={onWsentThemeChange}
          focusSection={focusSection}
          onFocusSection={onFocusSection}
          bottomTab={bottomTab}
          onBottomTabChange={onBottomTabChange}
          onStart={onStart}
          records={records}
        />
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
        <WordsSection
          wordLevel={wordLevel}
          wordTheme={wordTheme}
          wordMode={wordMode}
          onWordLevelChange={onWordLevelChange}
          onThemeChange={onThemeChange}
          onWordModeChange={onWordModeChange}
          focusSection={focusSection}
          onFocusSection={onFocusSection}
          bottomTab={bottomTab}
          onBottomTabChange={onBottomTabChange}
          onStart={onStart}
        />
      )}

      {/* ── 英英辞典 ── */}
      {gameType === 'dict' && (
        <DictSection
          dictLevel={dictLevel}
          dictTheme={dictTheme}
          dictMode={dictMode}
          onDictLevelChange={onDictLevelChange}
          onDictThemeChange={onDictThemeChange}
          onDictModeChange={onDictModeChange}
          focusSection={focusSection}
          onFocusSection={onFocusSection}
          bottomTab={bottomTab}
          onBottomTabChange={onBottomTabChange}
          onStart={onStart}
        />
      )}

      {/* ── タッチタイピング ── */}
      {gameType === 'touch' && (
        <TouchSection
          touchLevel={touchLevel}
          onTouchLevelChange={onTouchLevelChange}
          touchMode={touchMode}
          onTouchModeChange={onTouchModeChange}
          focusSection={focusSection}
          onFocusSection={onFocusSection}
          onStart={onStart}
          records={records}
        />
      )}
    </div>
  )
}
