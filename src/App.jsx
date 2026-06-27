import { useCallback, useEffect, useMemo, useState } from 'react'
import { MODES, modeLabel } from './content/modes.js'
import { WORD_LEVELS, WORD_MODES, WORD_THEMES, loadWords, loadWordGloss } from './content/words.js'
import { loadWsentLevel, loadWsentThemes } from './content/wordSentences/index.js'
import { DICT_MODES, DICT_AVAILABLE_LEVELS, loadDict } from './content/dictionary.js'
import { DEFAULT_STORY_ID, STORIES } from './content/stories/index.js'
import { TOUCH_LEVELS, TOUCH_MODES } from './content/keyboard.js'
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
import { makeSeed } from './application/seed.js'

const TYPE_KEYS = ['story', 'words', 'wsent', 'dict', 'touch']
const MODE_KEYS = MODES.map((m) => m.key)
const WORD_MODE_KEYS = WORD_MODES.map((m) => m.key)
const DICT_MODE_KEYS = DICT_MODES.map((m) => m.key)
const TOUCH_LEVEL_KEYS = TOUCH_LEVELS.map((l) => l.key)
const TOUCH_MODE_KEYS = TOUCH_MODES.map((m) => m.key)
const wordModeLabel = (key) => WORD_MODES.find((m) => m.key === key)?.label ?? key
const dictModeLabel = (key) => DICT_MODES.find((m) => m.key === key)?.label ?? key
const touchLevelLabel = (key) => TOUCH_LEVELS.find((l) => l.key === key)?.label ?? key
const touchModeLabel = (key) => TOUCH_MODES.find((m) => m.key === key)?.label ?? key
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
// 行内の選択移動（端で止まる＝ラップしない）
const step = (options, value, dir) => options[clamp(options.indexOf(value) + dir, 0, options.length - 1)]
const STORY_IDS = STORIES.map((s) => s.id)
const THEME_OPTIONS = ['すべて', ...WORD_THEMES]
const LEVEL_VALUES = WORD_LEVELS.map((l) => l.level)

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
  const [wsentTheme, setWsentTheme] = useState('すべて') // 単語例文のテーマフィルタ
  const [wsentGloss, setWsentGloss] = useState(null) // 単語例文の英→和グロッサリ(プレイ中の和訳併記用)
  const [storyId, setStoryId] = useState(DEFAULT_STORY_ID) // 選択中の物語(travel | climbing …)
  const [storyStart, setStoryStart] = useState(null) // 物語の開始状態(Devジャンプ用)
  const [storyNonce, setStoryNonce] = useState(0) // リプレイで物語を強制再マウントするための一意キー
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
  const [dictGloss, setDictGloss] = useState(null) // 英英の英→和グロッサリ(回答後の単語和訳表示用)
  const [touchLevel, setTouchLevel] = useState('home') // タッチタイピングのレベル
  const [touchMode, setTouchMode] = useState('easy') // タッチタイピングのモード(easy|hard)
  const [focusRow, setFocusRow] = useState(0) // TOP画面でフォーカス中の行（0=種類, 以降は種類ごとのセクション）
  const [bottomTab, setBottomTab] = useState('records') // 下部トグル（記録ランキング/収録一覧）
  const [records, setRecords] = useState(loadRecords())
  const [lastResult, setLastResult] = useState(null)
  const [segStats, setSegStats] = useState([]) // 問題ごとの記録(結果表示用)

  // TOP画面の行（セクション）構成。↑↓で行移動、←→で行内の選択移動。種類によって行が変わる。
  const rows = useMemo(() => {
    const type = { id: 'type', options: TYPE_KEYS, value: gameType, set: setGameType }
    // 下部トグル（記録ランキング/収録一覧）。タッチ以外の種類に付く。
    const bottom = { id: 'bottom', options: ['records', 'list'], value: bottomTab, set: setBottomTab }
    switch (gameType) {
      case 'story':
        return [
          type,
          { id: 'story', options: STORY_IDS, value: storyId, set: setStoryId },
          { id: 'mode', options: MODE_KEYS, value: mode, set: setMode },
          bottom,
        ]
      case 'words':
        return [
          type,
          { id: 'level', options: LEVEL_VALUES, value: wordLevel, set: setWordLevel },
          { id: 'theme', options: THEME_OPTIONS, value: wordTheme, set: setWordTheme },
          { id: 'mode', options: WORD_MODE_KEYS, value: wordMode, set: setWordMode },
          bottom,
        ]
      case 'dict':
        return [
          type,
          { id: 'level', options: DICT_AVAILABLE_LEVELS, value: dictLevel, set: setDictLevel },
          { id: 'theme', options: THEME_OPTIONS, value: dictTheme, set: setDictTheme },
          { id: 'mode', options: DICT_MODE_KEYS, value: dictMode, set: setDictMode },
          bottom,
        ]
      case 'touch':
        return [
          type,
          { id: 'level', options: TOUCH_LEVEL_KEYS, value: touchLevel, set: setTouchLevel },
          { id: 'mode', options: TOUCH_MODE_KEYS, value: touchMode, set: setTouchMode },
        ]
      default: // wsent
        return [
          type,
          { id: 'level', options: LEVEL_VALUES, value: wsentLevel, set: setWsentLevel },
          { id: 'theme', options: THEME_OPTIONS, value: wsentTheme, set: setWsentTheme },
          { id: 'mode', options: MODE_KEYS, value: mode, set: setMode },
          bottom,
        ]
    }
  }, [gameType, storyId, mode, wordLevel, wordTheme, wordMode, dictLevel, dictTheme, dictMode, touchLevel, touchMode, wsentLevel, wsentTheme, bottomTab])

  // フォーカス行は範囲内に丸めて使う（種類変更で行数が減っても安全）
  const safeFocus = Math.min(focusRow, rows.length - 1)
  const focusSection = rows[safeFocus].id

  // セクションをクリックしたらその行へフォーカス（マウス操作でも青枠が追従）
  const focusSectionById = useCallback(
    (id) => setFocusRow(Math.max(0, rows.findIndex((r) => r.id === id))),
    [rows],
  )

  // マラソンのゲームセッション
  const onFinish = useCallback((record, stats) => {
    // 問題ごとの記録(segStats)も記録に保存し、後でランキングから見返せるようにする
    const full = { ...record, segStats: stats }
    setRecords(saveRecord(full))
    setLastResult(full)
    setSegStats(stats)
    setPhase('result')
  }, [])
  // タッチタイピングの記録を保存（結果画面には遷移せず記録だけ追加）
  const onTouchRecord = useCallback((rec) => setRecords(saveRecord(rec)), [])

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
    async (level, theme, modeKey, seed) => {
      // 対象レベルの例文だけ遅延読み込みしてから開始（初回バンドルに全例文を含めない）
      // グロッサリ（英→和）とテーママップも並行ロード（テーマで収録を絞る／プレイ中の和訳併記）
      const [pool, gloss, themes] = await Promise.all([
        loadWsentLevel(level),
        loadWordGloss(),
        loadWsentThemes(),
      ])
      setWsentGloss(gloss)
      // テーマ指定時は見出し語の theme が一致する例文だけに絞る（'すべて'は全件）
      const themeMap = themes[level] ?? {}
      const filtered = theme === 'すべて' ? pool : pool.filter((s) => themeMap[s.word] === theme)
      startMarathon(modeKey, level, 'wsent', filtered, seed, theme)
      setPhase('playing')
    },
    [startMarathon],
  )

  // 通常プレイ／結果からの「もう一度」：現在の選択で新しい seed を切って開始
  const startGame = useCallback(() => {
    return startWsent(wsentLevel, wsentTheme, mode, makeSeed())
  }, [startWsent, wsentLevel, wsentTheme, mode])

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
    // 英英データと英→和グロッサリを並行ロード（クイズ回答後に選んだ語の和訳を見出し下に出す）
    const [d, gloss] = await Promise.all([loadDict(), loadWordGloss()])
    setDictData(d)
    setDictGloss(gloss)
    setPhase('dict')
  }, [])

  // 物語を開始する（最初の場面から）。物語は決定的なので seed 不要。
  const startStory = useCallback((modeKey, sid) => {
    if (modeKey != null) setMode(modeKey)
    if (sid != null) setStoryId(sid)
    setStoryStart(null)
    setStoryNonce((n) => n + 1) // phase が既に story でも StoryView を再マウントして再スタートさせる
    setPhase('story')
  }, [])

  // リプレイ：記録と全く同じ問題列で再挑戦（seed も記録のものを使う）。
  // 戻った時の整合のため UI state も記録に合わせて set しつつ、開始は明示引数で行う（stale 回避）。
  const replay = useCallback(
    (record) => {
      switch (record.source) {
        case 'wsent': {
          if (record.seed == null) return
          const theme = record.theme ?? 'すべて' // 旧記録（theme無し）は全件で再現
          setGameType('wsent')
          setMode(record.mode)
          setWsentLevel(record.rank)
          setWsentTheme(theme)
          startWsent(record.rank, theme, record.mode, record.seed)
          return
        }
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
          startStory(record.mode, record.storyId) // 物語は固定ナラティブ＝同じ物語・開始から再スタート
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
      // 通常プレイは seed を渡さない（=フックが新規 seed を内部生成して record に保存＝記録から再挑戦可能）。
      // View 内 restart も毎回新しい seed＝別の問題列になる。リプレイ時だけ記録の seed を渡す。
      startWords(wordLevel, wordTheme, wordMode, null)
    } else if (gameType === 'dict') {
      // 英英データを遅延読み込みしてから英英モードへ（通常プレイは seed を渡さず、フックが内部生成）。
      startDict(dictLevel, dictTheme, dictMode, null)
    } else if (gameType === 'touch') {
      setPhase('touch')
    } else if (gameType === 'story') {
      startStory(mode, storyId)
    } else {
      startGame()
    }
  }, [
    gameType,
    startGame,
    startWords,
    startDict,
    startStory,
    mode,
    storyId,
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

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // 行（セクション）の移動。一番下まで行ったら先頭へ（上下でループ）。
        e.preventDefault()
        const dir = e.key === 'ArrowDown' ? 1 : -1
        setFocusRow((safeFocus + dir + rows.length) % rows.length)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // フォーカス中の行内で選択を移動
        e.preventDefault()
        const dir = e.key === 'ArrowRight' ? 1 : -1
        const row = rows[safeFocus]
        row.set(step(row.options, row.value, dir))
      }
    }
    window.addEventListener('keydown', onNav)
    return () => window.removeEventListener('keydown', onNav)
  }, [phase, start, startGame, rows, safeFocus])

  // 開発時だけ：結果画面をダミーデータで即プレビュー（本番ビルドには含まれない）
  const previewResult = useCallback(() => {
    const mock = {
      mode,
      rank: wsentLevel,
      theme: wsentTheme,
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
      [recKey(mode, wsentLevel, 'wsent', wsentTheme)]: [{ ...mock, speed: 520, date: '過去の記録' }, mock],
    }))
    setPhase('result')
  }, [mode, wsentLevel, wsentTheme])

  // 開発時だけ：?preview=result|play|story でその画面を即表示（スクショ自動化用。本番ビルドには無効）
  // マウント時1回だけ実行する（依存配列を空にして再実行で取り消されないようにする）。
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const p = new URLSearchParams(location.search).get('preview')
    if (!p) return
    const id = setTimeout(() => {
      if (p === 'result') previewResult()
      else if (p === 'play') startGame() // 単語例文プレイ（フロー表示）
      else if (p === 'touch') {
        // タッチ即プレイ（キーボード確認用）。?mode=hard でむずかしいを確認できる。
        setGameType('touch')
        setTouchMode(new URLSearchParams(location.search).get('mode') === 'hard' ? 'hard' : 'easy')
        setPhase('touch')
      }
      else if (p === 'story') setPhase('story')
      else if (p === 'story-choice') {
        setStoryStart({ stage: 'choice' }) // 物語の選択肢場面（段組みフロー確認用）
        setPhase('story')
      }
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
          storyId={storyId}
          onStoryIdChange={setStoryId}
          wsentLevel={wsentLevel}
          onWsentLevelChange={setWsentLevel}
          wsentTheme={wsentTheme}
          onWsentThemeChange={setWsentTheme}
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
          touchMode={touchMode}
          onTouchModeChange={setTouchMode}
          focusSection={focusSection}
          onFocusSection={focusSectionById}
          bottomTab={bottomTab}
          onBottomTabChange={setBottomTab}
          onStart={start}
          records={records}
        />
      )}

      {phase === 'touch' && (
        <TouchView
          key={`${touchLevel}-${touchMode}`}
          level={touchLevel}
          levelLabel={touchLevelLabel(touchLevel)}
          mode={touchMode}
          modeLabel={touchModeLabel(touchMode)}
          onRecord={onTouchRecord}
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
          gloss={dictGloss}
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
          key={`${storyId}-${storyStart?.stage ?? 'start'}-${storyNonce}`}
          mode={mode}
          modeLabel={modeLabel(mode)}
          storyId={storyId}
          start={storyStart}
          onExit={() => setPhase('ready')}
        />
      )}

      {phase === 'playing' && (
        <MarathonView
          mode={mode}
          rankText={`単語例文 L${wsentLevel}`}
          gloss={wsentGloss}
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
