import { useCallback, useEffect, useState } from 'react'
import { MODES, modeLabel } from './content/modes.js'
import { WORD_LEVELS, WORD_MODES, loadWords } from './content/words.js'
import { loadWsentLevel } from './content/wordSentences/index.js'
import { DICT_MODES, DICT_AVAILABLE_LEVELS, loadDict } from './content/dictionary.js'
import { TOUCH_LEVELS } from './content/keyboard.js'
import { TARGET_KEYS } from './domain/marathon/passage.js'
import { recKey } from './domain/records/ranking.js'
import { loadRecords, saveRecord } from './application/records.js'
import { useMarathon } from './application/useMarathon.js'
import Ready from './ui/ready/Ready.jsx'
import MarathonView from './ui/marathon/MarathonView.jsx'
import Result from './ui/result/Result.jsx'
import StoryView from './ui/story/StoryView.jsx'
import WordsView from './ui/words/WordsView.jsx'
import DictView from './ui/dictionary/DictView.jsx'
import TouchView from './ui/touch/TouchView.jsx'
import { ReplayProvider } from './ui/result/ReplayContext.jsx'

// 問題列再現用のシードを1つ生成（0..2^32-1）。生成は UI 側で行い domain を純粋に保つ。
const makeSeed = () => Math.floor(Math.random() * 0x100000000)

const TYPE_KEYS = ['story', 'words', 'wsent', 'dict', 'touch']
const MODE_KEYS = MODES.map((m) => m.key)
const WORD_MODE_KEYS = WORD_MODES.map((m) => m.key)
const DICT_MODE_KEYS = DICT_MODES.map((m) => m.key)
const TOUCH_LEVEL_KEYS = TOUCH_LEVELS.map((l) => l.key)
const wordModeLabel = (key) => WORD_MODES.find((m) => m.key === key)?.label ?? key
const dictModeLabel = (key) => DICT_MODES.find((m) => m.key === key)?.label ?? key
const touchLevelLabel = (key) => TOUCH_LEVELS.find((l) => l.key === key)?.label ?? key
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const cycle = (arr, cur, dir) => arr[(arr.indexOf(cur) + dir + arr.length) % arr.length]

// 初期タブ（?tab=wsent 等のディープリンク。スクショ撮影や共有リンクに使える）
const initialTab = (() => {
  if (typeof location === 'undefined') return 'wsent'
  const t = new URLSearchParams(location.search).get('tab')
  return TYPE_KEYS.includes(t) ? t : 'wsent'
})()

export default function App() {
  const [phase, setPhase] = useState('ready') // ready | playing | result | story | words
  const [gameType, setGameType] = useState(initialTab) // wsent | story | words | dict | touch
  const [mode, setMode] = useState('both') // 文章/物語: both | en | ja | en-tr | ja-tr
  const [wsentLevel, setWsentLevel] = useState(1) // 単語例文のレベル(1-4)
  const [storyStart, setStoryStart] = useState(null) // 物語の開始状態(Devジャンプ用)
  const [wordLevel, setWordLevel] = useState(1) // 単語のレベル(1-4)
  const [wordTheme, setWordTheme] = useState('すべて') // 単語のテーマフィルタ
  const [wordMode, setWordMode] = useState('en') // both | en | ja | quiz-en | quiz-ja
  const [wordSeed, setWordSeed] = useState(null) // 単語の問題列シード（リプレイ再現用）
  const [wordsData, setWordsData] = useState(null) // 単語データ（遅延読み込み）
  const [dictLevel, setDictLevel] = useState(DICT_AVAILABLE_LEVELS[0] ?? 1) // 英英のレベル
  const [dictTheme, setDictTheme] = useState('すべて') // 英英のテーマ
  const [dictMode, setDictMode] = useState('quiz') // quiz | en | ja
  const [dictSeed, setDictSeed] = useState(null) // 英英の問題列シード（リプレイ再現用）
  const [dictData, setDictData] = useState(null) // 英英データ（遅延読み込み）
  const [touchLevel, setTouchLevel] = useState('home') // タッチタイピングのレベル
  const [records, setRecords] = useState(loadRecords())
  const [lastResult, setLastResult] = useState(null)
  const [segStats, setSegStats] = useState([]) // 問題ごとの記録(結果表示用)

  // マラソンのゲームセッション
  const onFinish = useCallback((record, stats) => {
    // 問題ごとの記録(segStats)も記録に保存し、後でランキングから見返せるようにする
    const full = { ...record, segStats: stats }
    setRecords(saveRecord(full))
    setLastResult(full)
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

  // 明示引数で単語例文を開始する（state を読まないので stale state を避けられる）。
  // リプレイは記録の値＋seed を直接渡すために必須。
  const startWsent = useCallback(
    async (level, modeKey, seed) => {
      // 対象レベルの例文だけ遅延読み込みしてから開始（初回バンドルに全例文を含めない）
      const pool = await loadWsentLevel(level)
      startMarathon(modeKey, level, 'wsent', pool, seed)
      setPhase('playing')
    },
    [startMarathon],
  )

  // 通常プレイ／結果からの「もう一度」：現在の選択で新しい seed を切って開始
  const startGame = useCallback(() => {
    return startWsent(wsentLevel, mode, makeSeed())
  }, [startWsent, wsentLevel, mode])

  // 明示引数で単語モードを開始する（seed を指定して同じ問題列を再現できる）。
  // WordsView 側のフックが seed を受け取り出題を決定する（key に seed を含めて再マウント）。
  const startWords = useCallback(async (level, theme, modeKey, seed) => {
    setWordLevel(level)
    setWordTheme(theme)
    setWordMode(modeKey)
    setWordSeed(seed)
    const w = await loadWords()
    setWordsData(w)
    setPhase('words')
  }, [])

  // 明示引数で英英モードを開始する（seed を指定して同じ問題列を再現できる）。
  const startDict = useCallback(async (level, theme, modeKey, seed) => {
    setDictLevel(level)
    setDictTheme(theme)
    setDictMode(modeKey)
    setDictSeed(seed)
    const d = await loadDict()
    setDictData(d)
    setPhase('dict')
  }, [])

  // 物語を開始する（最初の場面から）。物語は決定的なので seed 不要。
  const startStory = useCallback((modeKey) => {
    if (modeKey != null) setMode(modeKey)
    setStoryStart(null)
    setPhase('story')
  }, [])

  // リプレイ：記録と全く同じ問題列で再挑戦（seed も記録のものを使う）。
  // 戻った時の整合のため UI state も記録に合わせて set しつつ、開始は明示引数で行う（stale 回避）。
  const replay = useCallback(
    (record) => {
      switch (record.source) {
        case 'wsent':
          if (record.seed == null) return
          setGameType('wsent')
          setMode(record.mode)
          setWsentLevel(record.rank)
          startWsent(record.rank, record.mode, record.seed)
          return
        case 'word':
          if (record.seed == null) return
          setGameType('words')
          startWords(record.level, record.theme, record.mode, record.seed)
          return
        case 'dict':
          if (record.seed == null) return
          setGameType('dict')
          startDict(record.level, record.theme, record.mode, record.seed)
          return
        case 'story':
          setGameType('story')
          startStory(record.mode) // 物語は固定ナラティブ＝同じ開始から再スタート
          return
        default:
          return
      }
    },
    [startWsent, startWords, startDict, startStory],
  )

  const start = useCallback(() => {
    if (gameType === 'words') {
      // 単語データ（約1.6MB）を遅延読み込みしてから単語モードへ。
      // 通常プレイは seed なし（=View 内 restart も毎回ランダム＝従来挙動）。リプレイ時だけ seed を渡す。
      startWords(wordLevel, wordTheme, wordMode, null)
    } else if (gameType === 'dict') {
      // 英英データを遅延読み込みしてから英英モードへ（通常プレイは seed なし＝従来挙動）。
      startDict(dictLevel, dictTheme, dictMode, null)
    } else if (gameType === 'touch') {
      setPhase('touch')
    } else if (gameType === 'story') {
      startStory()
    } else {
      startGame()
    }
  }, [
    gameType,
    startGame,
    startWords,
    startDict,
    startStory,
    wordLevel,
    wordTheme,
    wordMode,
    dictLevel,
    dictTheme,
    dictMode,
  ])

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
        else if (gameType === 'dict') setDictMode((p) => cycle(DICT_MODE_KEYS, p, dir))
        else if (gameType === 'touch') {
          /* タッチタイピングはモードなし */
        } else setMode((p) => cycle(MODE_KEYS, p, dir))
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // レベル切り替え（文章=R1..6、単語=W1..4、英英=利用可能レベル、タッチ、物語=なし）
        e.preventDefault()
        const dir = e.key === 'ArrowDown' ? 1 : -1
        if (gameType === 'wsent') setWsentLevel((l) => clamp(l + dir, 1, WORD_LEVELS.length))
        else if (gameType === 'words') setWordLevel((l) => clamp(l + dir, 1, WORD_LEVELS.length))
        else if (gameType === 'dict') setDictLevel((l) => cycle(DICT_AVAILABLE_LEVELS, l, dir))
        else if (gameType === 'touch') setTouchLevel((l) => cycle(TOUCH_LEVEL_KEYS, l, dir))
      }
    }
    window.addEventListener('keydown', onNav)
    return () => window.removeEventListener('keydown', onNav)
  }, [phase, start, startGame, gameType])

  // 開発時だけ：結果画面をダミーデータで即プレビュー（本番ビルドには含まれない）
  const previewResult = useCallback(() => {
    const mock = {
      mode,
      rank: wsentLevel,
      source: 'wsent',
      seed: 12345, // リプレイボタン確認用の固定シード
      speed: 480,
      keys: TARGET_KEYS,
      mistakes: 7,
      accuracy: 98,
      seconds: 75.0,
      date: new Date().toLocaleString('ja-JP'),
    }
    setLastResult(mock)
    setSegStats([
      { no: 1, type: 'en', label: 'I drink water every morning.', keys: 24, mistakes: 1, seconds: 4.2, speed: 340, partial: false },
      { no: 2, type: 'ja', label: '私は毎朝水を飲みます。', keys: 30, mistakes: 2, seconds: 6.1, speed: 295, partial: false },
      { no: 3, type: 'en', label: 'This food is very good.', keys: 26, mistakes: 0, seconds: 3.9, speed: 400, partial: true },
    ])
    setRecords((prev) => ({
      ...prev,
      [recKey(mode, wsentLevel, 'wsent')]: [{ ...mock, speed: 520, date: '過去の記録' }, mock],
    }))
    setPhase('result')
  }, [mode, wsentLevel])

  // 開発時だけ：?preview=result|play|story でその画面を即表示（スクショ自動化用。本番ビルドには無効）
  // マウント時1回だけ実行する（依存配列を空にして再実行で取り消されないようにする）。
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const p = new URLSearchParams(location.search).get('preview')
    if (!p) return
    const id = setTimeout(() => {
      if (p === 'result') previewResult()
      else if (p === 'play') startGame() // 単語例文プレイ（フロー表示）
      else if (p === 'story') setPhase('story')
    }, 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ReplayProvider onReplay={replay}>
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
          wsentLevel={wsentLevel}
          onWsentLevelChange={setWsentLevel}
          wordLevel={wordLevel}
          wordTheme={wordTheme}
          wordMode={wordMode}
          onWordLevelChange={setWordLevel}
          onThemeChange={setWordTheme}
          onWordModeChange={setWordMode}
          dictLevel={dictLevel}
          dictTheme={dictTheme}
          dictMode={dictMode}
          onDictLevelChange={setDictLevel}
          onDictThemeChange={setDictTheme}
          onDictModeChange={setDictMode}
          touchLevel={touchLevel}
          onTouchLevelChange={setTouchLevel}
          onStart={start}
          records={records}
        />
      )}

      {phase === 'touch' && (
        <TouchView
          key={touchLevel}
          level={touchLevel}
          levelLabel={touchLevelLabel(touchLevel)}
          onExit={() => setPhase('ready')}
        />
      )}

      {phase === 'words' && (
        <WordsView
          key={`${wordLevel}-${wordTheme}-${wordMode}-${wordSeed}`}
          words={wordsData}
          level={wordLevel}
          theme={wordTheme}
          mode={wordMode}
          seed={wordSeed}
          levelLabel={`W${wordLevel} ${WORD_LEVELS.find((l) => l.level === wordLevel)?.label ?? ''}`}
          modeLabel={wordModeLabel(wordMode)}
          onExit={() => setPhase('ready')}
        />
      )}

      {phase === 'dict' && (
        <DictView
          key={`${dictLevel}-${dictTheme}-${dictMode}-${dictSeed}`}
          dict={dictData}
          level={dictLevel}
          theme={dictTheme}
          mode={dictMode}
          seed={dictSeed}
          levelLabel={`L${dictLevel} ${WORD_LEVELS.find((l) => l.level === dictLevel)?.label ?? ''}`}
          modeLabel={dictModeLabel(dictMode)}
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
          rankText={`単語例文 L${wsentLevel}`}
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

      {phase === 'ready' && <p className="version">v{__APP_VERSION__}</p>}
    </div>
    </ReplayProvider>
  )
}
