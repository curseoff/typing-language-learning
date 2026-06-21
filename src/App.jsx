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

const TYPE_KEYS = ['marathon', 'story', 'words']
const MODE_KEYS = MODES.map((m) => m.key)
const WORD_MODE_KEYS = WORD_MODES.map((m) => m.key)
const wordModeLabel = (key) => WORD_MODES.find((m) => m.key === key)?.label ?? key
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const cycle = (arr, cur, dir) => arr[(arr.indexOf(cur) + dir + arr.length) % arr.length]

export default function App() {
  const [phase, setPhase] = useState('ready') // ready | playing | result | story | words
  const [gameType, setGameType] = useState('marathon') // marathon | story | words
  const [mode, setMode] = useState('both') // 文章/物語: both | en | ja | en-tr | ja-tr
  const [rank, setRank] = useState(1) // 1-6
  const [storyStart, setStoryStart] = useState(null) // 物語の開始状態(Devジャンプ用)
  const [wordLevel, setWordLevel] = useState(1) // 単語のレベル(1-4)
  const [wordTheme, setWordTheme] = useState('すべて') // 単語のテーマフィルタ
  const [wordMode, setWordMode] = useState('en') // both | en | ja | quiz-en | quiz-ja
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

  const start = useCallback(() => {
    if (gameType === 'words') {
      setPhase('words')
    } else if (gameType === 'story') {
      setStoryStart(null)
      setPhase('story')
    } else {
      startGame()
    }
  }, [gameType, startGame])

  // Tab=種類、↑↓=レベル、←→=モード、Enter=スタート/もう一度、Esc=トップへ戻る
  useEffect(() => {
    const onNav = (e) => {
      if (e.key === 'Escape') {
        if (phase === 'playing' || phase === 'result') {
          e.preventDefault()
          setPhase('ready')
        }
        return
      }
      if (e.key === 'Enter') {
        if (phase === 'ready') {
          e.preventDefault()
          start()
        } else if (phase === 'result') {
          e.preventDefault()
          startGame()
        }
        return
      }
      if (phase !== 'ready') return

      if (e.key === 'Tab') {
        // 種類タブの切り替え（文章 → 物語 → 単語）
        e.preventDefault()
        setGameType((prev) => cycle(TYPE_KEYS, prev, e.shiftKey ? -1 : 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // モード切り替え（単語は wordMode、それ以外は mode）
        e.preventDefault()
        const dir = e.key === 'ArrowRight' ? 1 : -1
        if (gameType === 'words') setWordMode((p) => cycle(WORD_MODE_KEYS, p, dir))
        else setMode((p) => cycle(MODE_KEYS, p, dir))
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // レベル切り替え（文章=R1..6、単語=W1..4、物語=なし）
        e.preventDefault()
        const dir = e.key === 'ArrowDown' ? 1 : -1
        if (gameType === 'marathon') setRank((r) => clamp(r + dir, 1, RANKS.length))
        else if (gameType === 'words') setWordLevel((l) => clamp(l + dir, 1, WORD_LEVELS.length))
      }
    }
    window.addEventListener('keydown', onNav)
    return () => window.removeEventListener('keydown', onNav)
  }, [phase, start, startGame, gameType])

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
          gameType={gameType}
          onTypeChange={setGameType}
          mode={mode}
          onModeChange={setMode}
          rank={rank}
          onRankChange={setRank}
          wordLevel={wordLevel}
          wordTheme={wordTheme}
          wordMode={wordMode}
          onWordLevelChange={setWordLevel}
          onThemeChange={setWordTheme}
          onWordModeChange={setWordMode}
          onStart={start}
          records={records}
        />
      )}

      {phase === 'words' && (
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
