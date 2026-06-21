import { useCallback, useEffect, useState } from 'react'
import { RANKS } from './content/sentences.js'
import { MODES, modeLabel } from './content/modes.js'
import { WORD_LEVELS, WORD_MODES } from './content/words.js'
import { TARGET_KEYS } from './domain/marathon/passage.js'
import { recKey } from './domain/records/ranking.js'
import { loadRecords, saveRecord } from './infrastructure/recordsRepository.js'
import { useMarathon } from './application/useMarathon.js'
import Ready from './ui/ready/Ready.jsx'
import MarathonView from './ui/marathon/MarathonView.jsx'
import Result from './ui/result/Result.jsx'
import StoryView from './ui/story/StoryView.jsx'
import WordsView from './ui/words/WordsView.jsx'

const WORD_MODE_KEYS = WORD_MODES.map((m) => m.key)
const wordModeLabel = (key) => WORD_MODES.find((m) => m.key === key)?.label ?? key

export default function App() {
  const [phase, setPhase] = useState('ready') // ready | playing | result | story
  const [mode, setMode] = useState('both') // both | en | ja | en-tr | ja-tr
  const [rank, setRank] = useState(1) // 1-6
  const [storySelected, setStorySelected] = useState(false) // 物語モードを選択中か
  const [storyStart, setStoryStart] = useState(null) // 物語の開始状態(Devジャンプ用)
  const [wordLevel, setWordLevel] = useState(null) // 単語モードのレベル(1-4)or null
  const [wordTheme, setWordTheme] = useState('すべて') // 単語のテーマフィルタ
  const [wordMode, setWordMode] = useState('en') // both | en | ja | quiz
  const [records, setRecords] = useState(loadRecords())
  const [lastResult, setLastResult] = useState(null)
  const [segStats, setSegStats] = useState([]) // 問題ごとの記録(結果表示用)

  // マラソンのゲームセッション
  const onFinish = useCallback((record, stats) => {
    setRecords(saveRecord(record))
    setLastResult(record)
    setSegStats(stats)
    setPhase('result')
  }, [])
  const {
    start: startMarathon,
    segments,
    segIndex,
    segInput,
    completed,
    hasError,
    typedKeys,
    mistakes,
    liveSpeed,
    elapsedSec,
  } = useMarathon({ active: phase === 'playing', onFinish })

  const startGame = useCallback(() => {
    startMarathon(mode, rank)
    setPhase('playing')
  }, [startMarathon, mode, rank])

  // レベル(ランク)/物語/単語の選択 → 開始
  const selectRank = useCallback((r) => {
    setStorySelected(false)
    setWordLevel(null)
    setRank(r)
  }, [])
  const selectStory = useCallback(() => {
    setWordLevel(null)
    setStorySelected(true)
  }, [])
  const selectWord = useCallback((lv) => {
    setStorySelected(false)
    setWordLevel(lv)
  }, [])
  const start = useCallback(() => {
    if (wordLevel != null) {
      setPhase('words')
    } else if (storySelected) {
      setStoryStart(null)
      setPhase('story')
    } else {
      startGame()
    }
  }, [wordLevel, storySelected, startGame])

  // Enter=スタート/もう一度、Esc=トップへ戻る、↑↓=レベル/物語、←→=モード
  useEffect(() => {
    const onNav = (e) => {
      if (e.key === 'Escape') {
        if (phase === 'playing' || phase === 'result') {
          e.preventDefault()
          setPhase('ready')
        }
      } else if (e.key === 'Enter') {
        // Enter でスタート / もう一度（Space は英文入力の文字なので使わない）
        if (phase === 'ready') {
          e.preventDefault()
          start()
        } else if (phase === 'result') {
          e.preventDefault()
          startGame()
        }
      } else if (phase === 'ready' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        // ←/→：単語モード中はテーマ、それ以外はモード切り替え
        e.preventDefault()
        const dir = e.key === 'ArrowRight' ? 1 : -1
        if (wordLevel != null) {
          setWordMode((prev) => {
            const i = WORD_MODE_KEYS.indexOf(prev)
            return WORD_MODE_KEYS[(i + dir + WORD_MODE_KEYS.length) % WORD_MODE_KEYS.length]
          })
        } else {
          setMode((prev) => {
            const i = MODES.findIndex((m) => m.key === prev)
            return MODES[(i + dir + MODES.length) % MODES.length].key
          })
        }
      } else if (phase === 'ready' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        // ↑/↓ でレベル切り替え（R1..R6 → 物語 → 単語W1..W4）
        e.preventDefault()
        const dir = e.key === 'ArrowDown' ? 1 : -1
        const total = RANKS.length + 1 + WORD_LEVELS.length
        const curIdx =
          wordLevel != null ? RANKS.length + 1 + (wordLevel - 1) : storySelected ? RANKS.length : rank - 1
        const nextIdx = Math.min(total - 1, Math.max(0, curIdx + dir))
        if (nextIdx < RANKS.length) {
          setStorySelected(false)
          setWordLevel(null)
          setRank(nextIdx + 1)
        } else if (nextIdx === RANKS.length) {
          setWordLevel(null)
          setStorySelected(true)
        } else {
          setStorySelected(false)
          setWordLevel(nextIdx - RANKS.length) // RANKS.length+1 → 1
        }
      }
    }
    window.addEventListener('keydown', onNav)
    return () => window.removeEventListener('keydown', onNav)
  }, [phase, start, startGame, rank, storySelected, wordLevel])

  // 開発時だけ：結果画面をダミーデータで即プレビュー（本番ビルドには含まれない）
  const previewResult = useCallback(() => {
    const mock = {
      mode,
      rank,
      speed: 480,
      keys: TARGET_KEYS,
      mistakes: 7,
      accuracy: 98,
      seconds: 75.0,
      date: new Date().toLocaleString('ja-JP'),
    }
    setLastResult(mock)
    setSegStats([
      { no: 1, type: 'en', label: 'I go to school every day.', keys: 24, mistakes: 1, seconds: 4.2, speed: 340, partial: false },
      { no: 2, type: 'ja', label: '私は毎日学校へ行きます。', keys: 30, mistakes: 2, seconds: 6.1, speed: 295, partial: false },
      { no: 3, type: 'en', label: 'The weather is nice today.', keys: 26, mistakes: 0, seconds: 3.9, speed: 400, partial: true },
    ])
    setRecords((prev) => ({
      ...prev,
      [recKey(mode, rank)]: [{ ...mock, speed: 520, date: '過去の記録' }, mock],
    }))
    setPhase('result')
  }, [mode, rank])

  return (
    <div className="app">
      <h1>英文・和文タイピング</h1>

      {import.meta.env.DEV && (
        <div className="dev-panel">
          <span className="dev-tag">DEV</span>
          <button onClick={() => setPhase('ready')}>トップ</button>
          <button onClick={previewResult}>結果(ダミー)</button>
          <button onClick={() => { setStoryStart(null); setPhase('story') }}>物語</button>
          <button onClick={() => { setStoryStart({ stage: 'choice' }); setPhase('story') }}>
            物語(選択肢)
          </button>
        </div>
      )}

      {phase === 'ready' && (
        <Ready
          mode={mode}
          onModeChange={setMode}
          rank={rank}
          storySelected={storySelected}
          onRankChange={selectRank}
          onSelectStory={selectStory}
          wordLevel={wordLevel}
          wordTheme={wordTheme}
          wordMode={wordMode}
          onSelectWord={selectWord}
          onThemeChange={setWordTheme}
          onWordModeChange={setWordMode}
          onStart={start}
          records={records}
        />
      )}

      {phase === 'words' && wordLevel != null && (
        <WordsView
          key={`${wordLevel}-${wordTheme}-${wordMode}`}
          level={wordLevel}
          theme={wordTheme}
          mode={wordMode}
          levelLabel={`W${wordLevel} ${WORD_LEVELS.find((l) => l.level === wordLevel)?.label ?? ''}`}
          modeLabel={wordModeLabel(wordMode)}
          onExit={() => setPhase('ready')}
        />
      )}

      {phase === 'story' && (
        <StoryView
          key={storyStart?.stage ?? 'start'}
          mode={mode}
          modeLabel={modeLabel(mode)}
          start={storyStart}
          onExit={() => setPhase('ready')}
        />
      )}

      {phase === 'playing' && (
        <MarathonView
          mode={mode}
          rank={rank}
          segments={segments}
          segIndex={segIndex}
          segInput={segInput}
          completed={completed}
          hasError={hasError}
          typedKeys={typedKeys}
          mistakes={mistakes}
          liveSpeed={liveSpeed}
          elapsedSec={elapsedSec}
        />
      )}

      {phase === 'result' && lastResult && (
        <Result result={lastResult} records={records} segStats={segStats} onRetry={startGame} />
      )}
    </div>
  )
}
