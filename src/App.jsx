import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MODES, modeLabel } from './content/modes.js'
import { LEARNING_MODES, supportsLearning } from './content/learningModes.js'
import { WORD_LEVELS, WORD_MODES, WORD_THEMES, WORD_COUNTS, loadWords, loadWordGloss, loadWordRuby } from './content/words.js'
import { rangeCount } from './domain/words/wordRange.service.js'
import { filterWsentByTheme } from './domain/words/wsentSet.service.js'
import { headwordFreqMap, sliceByHeadwordFreq } from './application/headwordFreqSlice.policy.js'
import { WSENT_COUNTS, loadWsentLevel, loadWsentThemes } from './content/wordSentences/index.js'
import { DICT_MODES, DICT_AVAILABLE_LEVELS, DICT_COUNTS, loadDict } from './content/dictionary.js'
import { DEFAULT_STORY_ID, STORIES } from './content/stories/index.js'
import { TOUCH_LEVELS, TOUCH_MODES } from './content/keyboard.js'
import { ROMAJI_LEVELS, ROMAJI_MODE } from './content/romaji.js'
import { END_KINDS, endKind, endConditionForKind, DEFAULT_END_CONDITION } from './content/endConditions.js'
import { makeEndCondition } from './domain/session/endCondition.vo.js'
import { TARGET_KEYS } from './domain/marathon/passage.service.js'
import { recKey } from './domain/records/ranking.service.js'
import { loadRecords, loadDictRecords, loadWordRecords, loadAllStoryRecords, saveRecord } from './application/records.service.js'
import { useMarathon } from './application/useMarathon.js'
import Ready from './ui/ready/Ready.container.jsx'
import MarathonView from './ui/marathon/MarathonView.container.jsx'
import Result from './ui/result/Result.container.jsx'
import RecordDetail from './ui/result/RecordDetail.container.jsx'
import StoryView from './ui/story/StoryView.container.jsx'
import WordsView from './ui/words/WordsView.container.jsx'
import DictView from './ui/dictionary/DictView.container.jsx'
import TouchView from './ui/touch/TouchView.container.jsx'
import RomajiView from './ui/romaji/RomajiView.container.jsx'
import AboutView from './ui/about/AboutView.presenter.jsx'
import AllRecordsView from './ui/records/AllRecordsView.container.jsx'
import { ReplayProvider } from './ui/result/ReplayContext.context.jsx'
import { RecordDetailProvider } from './ui/result/RecordDetailContext.context.jsx'
import UpdateToast from './ui/pwa/UpdateToast.container.jsx'
import OfflineBanner from './ui/pwa/OfflineBanner.container.jsx'
import ContentFallbackNotice from './ui/pwa/ContentFallbackNotice.container.jsx'
import PersistNotice from './ui/pwa/PersistNotice.container.jsx'
import SoundToggle from './ui/sound/SoundToggle.container.jsx'
import AppMenuBar from './ui/menu/AppMenuBar.container.jsx'
import { makeSeed } from './application/seed.policy.js'
import { parseRoute, buildRoute } from './application/routing.policy.js'
import { routeFromRawRecord, resolveColdDetail } from './application/recordDetailRoute.policy.js'

const TYPE_KEYS = ['story', 'words', 'wsent', 'dict', 'touch', 'romaji']
const MODE_KEYS = MODES.map((m) => m.key)
const LEARNING_MODE_KEYS = LEARNING_MODES
const WORD_MODE_KEYS = WORD_MODES.map((m) => m.key)
const DICT_MODE_KEYS = DICT_MODES.map((m) => m.key)
const TOUCH_LEVEL_KEYS = TOUCH_LEVELS.map((l) => l.key)
const TOUCH_MODE_KEYS = TOUCH_MODES.map((m) => m.key)
const ROMAJI_LEVEL_KEYS = ROMAJI_LEVELS.map((l) => l.key)
const wordModeLabel = (key) => WORD_MODES.find((m) => m.key === key)?.label ?? key
const dictModeLabel = (key) => DICT_MODES.find((m) => m.key === key)?.label ?? key
const touchLevelLabel = (key) => TOUCH_LEVELS.find((l) => l.key === key)?.label ?? key
const touchModeLabel = (key) => TOUCH_MODES.find((m) => m.key === key)?.label ?? key
const romajiLevelLabel = (key) => ROMAJI_LEVELS.find((l) => l.key === key)?.label ?? key
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
// 行内の選択移動（端で止まる＝ラップしない）
const step = (options, value, dir) => options[clamp(options.indexOf(value) + dir, 0, options.length - 1)]
const STORY_IDS = STORIES.map((s) => s.id)
const THEME_OPTIONS = ['すべて', ...WORD_THEMES]
const LEVEL_VALUES = WORD_LEVELS.map((l) => l.level)

// #362/#364 各種類の範囲数（レベル×テーマの収録数を100区切りにした数）。本体はロード不要（*_COUNTS）。
const wordRangeCount = (level, theme) => rangeCount(WORD_COUNTS[level]?.[theme] ?? 0)
const dictRangeCount = (level, theme) => rangeCount(DICT_COUNTS[level]?.[theme] ?? 0)
const wsentRangeCount = (level, theme) => rangeCount(WSENT_COUNTS[level]?.[theme] ?? 0)
// 範囲外・0以下の range は「未選択(null)」へ丸める（level/theme 変更で範囲数が減ったとき用＝#359 の白画面回避）。
const clampRange = (range, count) => (range != null && range >= 1 && range <= count ? range : null)

// #357 パス型ルーティング：base（末尾スラッシュ付き。本番 '/typing-language-learning/'・dev '/'）。
const BASE = import.meta.env.BASE_URL

// location.pathname から BASE prefix を除いた「app 相対パス（先頭 '/'）」を返す（codec に渡す形）。
function appPathFromLocation() {
  if (typeof location === 'undefined') return '/'
  const p = location.pathname
  const rel = p.startsWith(BASE) ? p.slice(BASE.length) : p.replace(/^\/+/, '')
  return '/' + rel
}

// 旧共有リンク（?tab=）の値（gameType）→ URL slug。wsent だけ 'sentences'（codec の PAGES と対応）。
// base 直下（app 相対 '/'）のときだけ後方互換で参照するための最小シム。
const SLUG_FOR_TAB = {
  wsent: 'sentences', story: 'story', words: 'words', dict: 'dict', touch: 'touch', romaji: 'romaji',
}

// 初期 RouteState：初回レンダー時の URL パスから復元する（location は呼び出し時に読む＝
// useState の遅延初期化から1度だけ呼ぶ）。base 直下のときだけ旧 ?tab= を後方互換で拾う
// （深いパスは常にパスを正とする＝共有/ブックマークがそのまま開く）。
function computeInitialRoute() {
  if (typeof location === 'undefined') return parseRoute('/')
  const appPath = appPathFromLocation()
  if (appPath === '/') {
    const t = new URLSearchParams(location.search).get('tab')
    if (TYPE_KEYS.includes(t)) return parseRoute('/' + SLUG_FOR_TAB[t])
  }
  return parseRoute(appPath)
}

export default function App() {
  // 初回マウント時に1度だけ URL からルートを復元する（遅延初期化＝location を読むのはこの1回）。
  const [IR] = useState(computeInitialRoute)
  // gameType が一致するページのときだけ RouteState の値を初期値に使い、そうでなければ従来の既定へ。
  const irIf = (gt, key, fallback) => (IR.gameType === gt ? IR[key] : fallback)

  // #359 cold ロード時は view URL から初期 phase を復元する（about/records は直接・result は
  // lastResult がまだ無い＝ready へ丸め）。view 以外は従来どおり ready から。
  const [phase, setPhase] = useState(() => {
    if (IR.view === 'about') return 'about'
    if (IR.view === 'records') return 'allrecords'
    // #360 record-detail の cold ロードは一覧（allrecords）を下敷きにモーダルを重ねる（#359 の view 写像に倣う）。
    if (IR.view === 'record-detail') return 'allrecords'
    return 'ready' // view:'result' の cold ロードは lastResult 不在＝TOP へ丸め
  }) // ready | playing | result | story | words | about | allrecords
  const [gameType, setGameType] = useState(IR.gameType ?? 'wsent') // wsent | story | words | dict | touch（view IR は gameType 無し＝既定 wsent）
  const [mode, setMode] = useState(irIf('wsent', 'mode', 'both')) // 文章/物語: both | en | ja | en-tr | ja-tr
  const [wsentLevel, setWsentLevel] = useState(irIf('wsent', 'level', 1)) // 単語例文のレベル(1-4)
  const [wsentTheme, setWsentTheme] = useState(irIf('wsent', 'theme', 'すべて')) // 単語例文のテーマフィルタ
  const [wsentRange, setWsentRange] = useState(() => clampRange(irIf('wsent', 'range', null), wsentRangeCount(irIf('wsent', 'level', 1), irIf('wsent', 'theme', 'すべて')))) // 単語例文の固定範囲(1始まり) or null
  const [wsentGloss, setWsentGloss] = useState(null) // 単語例文の英→和グロッサリ(プレイ中の和訳併記用)
  const [storyId, setStoryId] = useState(irIf('story', 'storyId', DEFAULT_STORY_ID)) // 選択中の物語(travel | climbing …)
  const [storyStart, setStoryStart] = useState(null) // 物語の開始状態(Devジャンプ用)
  const [storyNonce, setStoryNonce] = useState(0) // リプレイで物語を強制再マウントするための一意キー
  const [wordLevel, setWordLevel] = useState(irIf('words', 'level', 1)) // 単語のレベル(1-4)
  const [wordTheme, setWordTheme] = useState(irIf('words', 'theme', 'すべて')) // 単語のテーマフィルタ
  const [wordMode, setWordMode] = useState(irIf('words', 'mode', 'en')) // both | en | ja | quiz-en | quiz-ja
  const [wordRange, setWordRange] = useState(() => clampRange(irIf('words', 'range', null), wordRangeCount(irIf('words', 'level', 1), irIf('words', 'theme', 'すべて')))) // 単語の固定範囲(1始まり) or null=範囲指定なし
  const [wordSeed, setWordSeed] = useState(null) // 単語の問題列シード（リプレイ再現用）
  const [wordsData, setWordsData] = useState(null) // 単語データ（遅延読み込み）
  const [dictLevel, setDictLevel] = useState(irIf('dict', 'level', DICT_AVAILABLE_LEVELS[0] ?? 1)) // 英英のレベル
  const [dictTheme, setDictTheme] = useState(irIf('dict', 'theme', 'すべて')) // 英英のテーマ
  const [dictMode, setDictMode] = useState(irIf('dict', 'mode', 'quiz')) // quiz | en | ja
  const [dictRange, setDictRange] = useState(() => clampRange(irIf('dict', 'range', null), dictRangeCount(irIf('dict', 'level', DICT_AVAILABLE_LEVELS[0] ?? 1), irIf('dict', 'theme', 'すべて')))) // 英英の固定範囲(1始まり) or null
  const [dictSeed, setDictSeed] = useState(null) // 英英の問題列シード（リプレイ再現用）
  const [dictData, setDictData] = useState(null) // 英英データ（遅延読み込み）
  const [dictFreqMap, setDictFreqMap] = useState(null) // 英英の範囲出題用 Map(en→freq)（range 時のみ・単語データ由来）
  const [dictGloss, setDictGloss] = useState(null) // 英英の英→和グロッサリ(回答後の単語和訳表示用)
  const [dictWordRuby, setDictWordRuby] = useState(null) // 英英の英→{ja,kana}(単語4択の回答後にルビ表示用)
  const [touchLevel, setTouchLevel] = useState(irIf('touch', 'touchLevel', 'home')) // タッチタイピングのレベル
  const [touchMode, setTouchMode] = useState(irIf('touch', 'touchMode', 'easy')) // タッチタイピングのモード(easy|hard)
  const [romajiLevel, setRomajiLevel] = useState(irIf('romaji', 'romajiLevel', 'a')) // ローマ字入力練習のレベル(行グループ)
  const [learningMode, setLearningMode] = useState(IR.learningMode ?? 'normal') // #402 学習モード(normal|cloze)。単語/単語例文/英英の通常入力で使う
  const [focusRow, setFocusRow] = useState(0) // TOP画面でフォーカス中の行（0=種類, 以降は種類ごとのセクション）
  const [bottomTab, setBottomTab] = useState('records') // 下部トグル（記録ランキング/収録一覧）
  // 終了条件（URL の ec から復元・既定60秒）。view IR（{view}のみ）は endCondition を持たない＝
  // 既定 VO へフォールバック（未定義だと rows useMemo の endCondition.kind で落ちて白画面＝#359）。
  const [endCondition, setEndCondition] = useState(IR.endCondition ?? DEFAULT_END_CONDITION)
  const [records, setRecords] = useState(loadRecords())
  const [lastResult, setLastResult] = useState(null)
  const [segStats, setSegStats] = useState([]) // 問題ごとの記録(結果表示用)
  // #360 記録詳細（record-detail）オーバーレイの真実源＝URL 由来の RouteState（無ければ null）。
  // cold ロードで URL が record-detail のときは初期復元し、以後は openDetail/popstate で更新する。
  const [detailRoute, setDetailRoute] = useState(IR.view === 'record-detail' ? IR : null)

  // #362/#364 レベル/テーマ変更時は range を範囲内に丸める（範囲数が減って無効化されたら未選択へ）。
  // rows（←→ナビ）と Ready の選択チップの両方から使う共通ハンドラ（単語/英英/単語例文で同型）。
  const onWordLevelChange = useCallback((lv) => {
    setWordLevel(lv)
    setWordRange((r) => clampRange(r, wordRangeCount(lv, wordTheme)))
  }, [wordTheme])
  const onWordThemeChange = useCallback((th) => {
    setWordTheme(th)
    setWordRange((r) => clampRange(r, wordRangeCount(wordLevel, th)))
  }, [wordLevel])
  const onDictLevelChange = useCallback((lv) => {
    setDictLevel(lv)
    setDictRange((r) => clampRange(r, dictRangeCount(lv, dictTheme)))
  }, [dictTheme])
  const onDictThemeChange = useCallback((th) => {
    setDictTheme(th)
    setDictRange((r) => clampRange(r, dictRangeCount(dictLevel, th)))
  }, [dictLevel])
  const onWsentLevelChange = useCallback((lv) => {
    setWsentLevel(lv)
    setWsentRange((r) => clampRange(r, wsentRangeCount(lv, wsentTheme)))
  }, [wsentTheme])
  const onWsentThemeChange = useCallback((th) => {
    setWsentTheme(th)
    setWsentRange((r) => clampRange(r, wsentRangeCount(wsentLevel, th)))
  }, [wsentLevel])

  // TOP画面の行（セクション）構成。↑↓で行移動、←→で行内の選択移動。種類によって行が変わる。
  const rows = useMemo(() => {
    const type = { id: 'type', options: TYPE_KEYS, value: gameType, set: setGameType }
    // 下部トグル（記録ランキング/収録一覧）。タッチ以外の種類に付く。
    const bottom = { id: 'bottom', options: ['records', 'list'], value: bottomTab, set: setBottomTab }
    // 終了条件の種別（時間/文字数）。←→で種別を切替え＝その種別の既定値に落ちる。wsent/words/dict に付く。
    const endKindRow = {
      id: 'endKind',
      options: END_KINDS.map((k) => k.kind),
      value: endCondition.kind,
      set: (k) => setEndCondition(endConditionForKind(k)),
    }
    // 終了条件の値（時間=秒 / 文字数=文字）。←→で選択中種別の値を移動。
    // endless は値を持たない＝値行を出さない（endRows でスキップ。←→は種別行のみで操作）。
    const endValues = endKind(endCondition.kind).values ?? []
    const end = {
      id: 'end',
      options: endValues,
      value: endCondition.value,
      set: (v) => setEndCondition(makeEndCondition(endCondition.kind, v)),
    }
    const endRows = endValues.length > 0 ? [endKindRow, end] : [endKindRow]
    // #402 学習モード（通常/穴埋め）行。単語/単語例文/英英で、かつ通常入力（both/en/ja）のときだけ出す
    // （翻訳 en-tr/ja-tr・4択 quiz/pick では出さない）。行内で入力モードが翻訳/4択に変わると次回描画で消える。
    const learningRow = { id: 'learning', options: LEARNING_MODE_KEYS, value: learningMode, set: setLearningMode }
    const learnRows = (inputMode) => (supportsLearning(inputMode) ? [learningRow] : [])
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
          { id: 'level', options: LEVEL_VALUES, value: wordLevel, set: onWordLevelChange },
          { id: 'theme', options: THEME_OPTIONS, value: wordTheme, set: onWordThemeChange },
          { id: 'mode', options: WORD_MODE_KEYS, value: wordMode, set: setWordMode },
          ...learnRows(wordMode),
          ...endRows,
          bottom,
        ]
      case 'dict':
        return [
          type,
          { id: 'level', options: DICT_AVAILABLE_LEVELS, value: dictLevel, set: onDictLevelChange },
          { id: 'theme', options: THEME_OPTIONS, value: dictTheme, set: onDictThemeChange },
          { id: 'mode', options: DICT_MODE_KEYS, value: dictMode, set: setDictMode },
          ...learnRows(dictMode),
          ...endRows,
          bottom,
        ]
      case 'touch':
        return [
          type,
          { id: 'mode', options: TOUCH_MODE_KEYS, value: touchMode, set: setTouchMode },
          { id: 'level', options: TOUCH_LEVEL_KEYS, value: touchLevel, set: setTouchLevel },
        ]
      case 'romaji':
        return [
          type,
          { id: 'level', options: ROMAJI_LEVEL_KEYS, value: romajiLevel, set: setRomajiLevel },
        ]
      default: // wsent
        return [
          type,
          { id: 'level', options: LEVEL_VALUES, value: wsentLevel, set: onWsentLevelChange },
          { id: 'theme', options: THEME_OPTIONS, value: wsentTheme, set: onWsentThemeChange },
          { id: 'mode', options: MODE_KEYS, value: mode, set: setMode },
          ...learnRows(mode),
          ...endRows,
          bottom,
        ]
    }
  }, [gameType, storyId, mode, wordLevel, wordTheme, wordMode, onWordLevelChange, onWordThemeChange, dictLevel, dictTheme, dictMode, onDictLevelChange, onDictThemeChange, touchLevel, touchMode, romajiLevel, wsentLevel, wsentTheme, onWsentLevelChange, onWsentThemeChange, bottomTab, endCondition, learningMode])

  // フォーカス行は範囲内に丸めて使う（種類変更で行数が減っても安全）
  const safeFocus = Math.min(focusRow, rows.length - 1)
  const focusSection = rows[safeFocus].id

  // セクションをクリックしたらその行へフォーカス（マウス操作でも青枠が追従）
  const focusSectionById = useCallback(
    (id) => setFocusRow(Math.max(0, rows.findIndex((r) => r.id === id))),
    [rows],
  )

  // #357 現在の選択（gameType＋そのページの param＋endCondition）から最小 RouteState を組む。
  // codec（buildRoute）が期待する「当該ページの param のみ」の形にする。
  const currentRouteState = useCallback(() => {
    // #402 通常入力（both/en/ja）の種類だけ learningMode を URL に往復させる（既定 normal は省略）。
    const lm = (inputMode) => (supportsLearning(inputMode) ? { learningMode } : {})
    switch (gameType) {
      case 'words': return { gameType, level: wordLevel, theme: wordTheme, mode: wordMode, endCondition, range: wordRange, ...lm(wordMode) }
      case 'dict': return { gameType, level: dictLevel, theme: dictTheme, mode: dictMode, endCondition, range: dictRange, ...lm(dictMode) }
      case 'story': return { gameType, storyId, endCondition }
      case 'touch': return { gameType, touchLevel, touchMode, endCondition }
      case 'romaji': return { gameType, romajiLevel, endCondition }
      default: return { gameType: 'wsent', level: wsentLevel, theme: wsentTheme, mode, endCondition, range: wsentRange, ...lm(mode) }
    }
  }, [gameType, wordLevel, wordTheme, wordMode, wordRange, dictLevel, dictTheme, dictMode, dictRange, storyId, touchLevel, touchMode, romajiLevel, wsentLevel, wsentTheme, wsentRange, mode, endCondition, learningMode])

  // #357/#359 RouteState を phase＋各ページの state セッターへ写像する（popstate 復元で使う）。
  // 初回はこの写像を使わず useState 初期値で直接復元している（IR/irIf/初期 phase）。
  const applyRouteToState = useCallback((state) => {
    // #360 record-detail ルート：一覧（allrecords）を下敷きに detailRoute を立てオーバーレイを開く。
    // 戻る/進むで detail URL を跨ぐたびここを通り、URL を真実源にモーダルの開閉が同期する。
    if (state.view === 'record-detail') {
      setDetailRoute(state)
      setPhase('allrecords')
      return
    }
    // record-detail 以外のルートへ移ったら（戻る/進むで detail を抜けたら）オーバーレイを閉じる。
    setDetailRoute(null)
    // #359 view ルート（about/records/result）：コンテンツ選択は保持し phase だけ切替える。
    // result は lastResult があれば結果画面・無ければ TOP へ丸める（直リンク/戻るでの白画面回避）。
    if (state.view) {
      if (state.view === 'about') setPhase('about')
      else if (state.view === 'records') setPhase('allrecords')
      else setPhase(lastResult ? 'result' : 'ready') // view:'result'
      return
    }
    setGameType(state.gameType)
    // #402 words/dict/wsent は learningMode を復元（無ければ normal）。他ページは触らない。
    if (state.gameType === 'words' || state.gameType === 'dict' || state.gameType === 'wsent') {
      setLearningMode(state.learningMode ?? 'normal')
    }
    switch (state.gameType) {
      case 'words': setWordLevel(state.level); setWordTheme(state.theme); setWordMode(state.mode); setWordRange(clampRange(state.range ?? null, wordRangeCount(state.level, state.theme))); break
      case 'dict': setDictLevel(state.level); setDictTheme(state.theme); setDictMode(state.mode); setDictRange(clampRange(state.range ?? null, dictRangeCount(state.level, state.theme))); break
      case 'story': setStoryId(state.storyId); break
      case 'touch': setTouchLevel(state.touchLevel); setTouchMode(state.touchMode); break
      case 'romaji': setRomajiLevel(state.romajiLevel); break
      default: setWsentLevel(state.level); setWsentTheme(state.theme); setMode(state.mode); setWsentRange(clampRange(state.range ?? null, wsentRangeCount(state.level, state.theme)))
    }
    setEndCondition(state.endCondition)
    setPhase('ready') // content ルートは常に ready（プレイ中に戻る→ready 復帰）
  }, [lastResult])

  // #357/#359 URL 反映：ready は現在選択、about/allrecords/result(結果有り) は view 最小形を URL へ
  // 書き戻す。playing/story/words/dict/touch/romaji 実行中や seed/records 等の一過性・ユーザー情報は
  // URL に載せない（それ以外の phase は不更新）。gameType/storyId 切替と view への遷移は pushState
  // （戻る/進むが効く／view の上に content 履歴を重ね、戻るで直前の content URL に復帰）、同一ページ内の
  // param 変更は replaceState（履歴を汚さずアドレスバーは追従）。?preview/?persist/?tab 等の search は温存。
  const routeRef = useRef({ gameType, storyId, view: null })
  useEffect(() => {
    if (typeof location === 'undefined') return
    // #360 detail オーバーレイが開いている間は URL の真実源は detail 側（openDetail の pushState/
    // 戻るの popstate）＝ここでは書き戻さない（phase の allrecords 反映で detail URL を潰さない）。
    if (detailRoute) return
    // phase に応じて URL へ反映する RouteState を決める（該当しない一過性 phase は更新しない）。
    let routeState
    if (phase === 'about') routeState = { view: 'about' }
    else if (phase === 'allrecords') routeState = { view: 'records' }
    else if (phase === 'result' && lastResult) routeState = { view: 'result' }
    else if (phase === 'ready') routeState = currentRouteState()
    else return
    const view = routeState.view ?? null
    const target = BASE + buildRoute(routeState).slice(1) + location.search
    // ページ識別（view／content の gameType・storyId）が変われば pushState、同一ページ内の変更は replace。
    const changed =
      view !== routeRef.current.view ||
      gameType !== routeRef.current.gameType ||
      storyId !== routeRef.current.storyId
    routeRef.current = { gameType, storyId, view }
    // 既に一致（初期の canonical URL・popstate 復元後）なら何もしない＝二重 push を避ける。
    if (target === location.pathname + location.search) return
    if (changed) history.pushState(null, '', target)
    else history.replaceState(null, '', target)
  }, [phase, currentRouteState, gameType, storyId, lastResult, detailRoute])

  // #357/#359 戻る/進む（popstate）：URL からルートを復元し phase を写像する（content→ready・
  // view→対応 phase／cold result は TOP へ丸め）。復元後の URL は canonical なので、上の URL 反映
  // 効果は target===現URL で no-op になる（書き戻しなし）。
  useEffect(() => {
    const onPop = () => {
      applyRouteToState(parseRoute(appPathFromLocation()))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [applyRouteToState])

  // #360 記録行クリックの共通ハンドラ（3サイト＝AllRecordsView / Result / RecordsTable が Context 経由で呼ぶ）。
  // 生記録＋順位から record-detail の URL を組んで pushState し、detailRoute を立ててオーバーレイを開く。
  // touch/romaji 等 URL 非対象（routeFromRawRecord=null）は何もしない。
  const openDetail = useCallback((record, position) => {
    const route = routeFromRawRecord(record, position)
    if (route == null) return
    if (typeof location !== 'undefined' && typeof history !== 'undefined') {
      const target = BASE + buildRoute(route).slice(1) + location.search
      history.pushState(null, '', target) // open で1エントリ積む＝閉じる＝戻る
    }
    setDetailRoute(route)
  }, [])

  // 閉じる（× / Esc / 閉じるボタン）＝open で積んだ1エントリを戻す。→ popstate で detailRoute を再計算し unmount。
  const closeDetail = useCallback(() => {
    if (typeof history !== 'undefined') history.back()
  }, [])

  // detailRoute（URL 由来）から実記録を解決する。cold 直開き・range 外・未知 kind・legacy 不一致は
  // null＝オーバーレイを描かない（一覧のみ・白画面/例外にしない＝#359 の教訓）。detailRoute が立つ
  // 瞬間（open/popstate/cold）に記録ストア（メモリ像）を読み直して解決する。
  const detailResolved = useMemo(() => {
    if (detailRoute == null) return null
    return resolveColdDetail(detailRoute, {
      records: loadRecords(),
      dictRecords: loadDictRecords(),
      wordRecords: loadWordRecords(),
      storyRecords: loadAllStoryRecords(),
    })
  }, [detailRoute])

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
  // ローマ字入力練習の記録を保存（結果画面には遷移せず記録だけ追加）
  const onRomajiRecord = useCallback((rec) => setRecords(saveRecord(rec)), [])

  const {
    start: startMarathon,
    escFinish: marathonEscFinish,
    segments,
    segIndex,
    segInput,
    completed,
    hasError,
    clozeRevealed,
    typedKeys,
    mistakes,
    missedItems,
    liveSpeed,
    elapsedSec,
  } = useMarathon({
    active: phase === 'playing',
    onFinish,
    endCondition,
    // #402 単語例文の穴埋めは通常入力（both/en/ja）で有効。翻訳(en-tr/ja-tr)は normal に落とす。
    // ja は和文の内容語を jaWords 境界でマスク（読みを記憶から打つ）。
    learningMode: supportsLearning(mode) ? learningMode : 'normal',
  })

  // 明示引数で単語例文を開始する（state を読まないので stale state を避けられる）。
  // リプレイは記録の値＋seed を直接渡すために必須。
  const startWsent = useCallback(
    async (level, theme, modeKey, seed, range) => {
      // 対象レベルの例文だけ遅延読み込みしてから開始（初回バンドルに全例文を含めない）
      // グロッサリ（英→和）とテーママップも並行ロード（テーマで収録を絞る／プレイ中の和訳併記）
      // #364 range 選択時のみ単語(level 分)も並行ロードして freq 結合に使う（範囲外への丸めは clampRange）。
      const clamped = clampRange(range ?? null, wsentRangeCount(level, theme))
      const loads = [loadWsentLevel(level), loadWordGloss(), loadWsentThemes()]
      if (clamped != null) loads.push(loadWords(level))
      const [pool, gloss, themes, words] = await Promise.all(loads)
      setWsentGloss(gloss)
      setWsentRange(clamped)
      // テーマ指定時は見出し語の theme が一致する例文だけに絞る（'すべて'は全件）
      const themeMap = themes[level] ?? {}
      const filtered = filterWsentByTheme(pool, theme, themeMap)
      // range 時は見出し語 freq 順に 100 文区切りへスライス（決定的）。freq は単語データ由来。
      // clamped==null は素通り＝ヘルパ内でガードするため freqMap は range 時のみ構築する。
      const freqMap = clamped != null ? headwordFreqMap(words) : null
      const sliced = sliceByHeadwordFreq(filtered, clamped, freqMap)
      startMarathon(modeKey, level, 'wsent', sliced, seed, theme, clamped)
      setPhase('playing')
    },
    [startMarathon],
  )

  // 通常プレイ／結果からの「もう一度」：現在の選択で新しい seed を切って開始
  const startGame = useCallback(() => {
    return startWsent(wsentLevel, wsentTheme, mode, makeSeed(), wsentRange)
  }, [startWsent, wsentLevel, wsentTheme, mode, wsentRange])

  // 明示引数で単語モードを開始する（seed を指定して同じ問題列を再現できる）。
  // WordsView 側のフックが seed を受け取り出題を決定する（key に seed を含めて再マウント）。
  const startWords = useCallback(async (level, theme, modeKey, seed, range) => {
    setWordLevel(level)
    setWordTheme(theme)
    setWordMode(modeKey)
    setWordSeed(seed)
    setWordRange(clampRange(range ?? null, wordRangeCount(level, theme))) // #362 範囲外なら未選択（従来の全体出題）へ
    // 対象レベルの単語だけ遅延読み込み（テーマ絞りは domain 側／4択の誤答は同レベル全テーマから）
    const w = await loadWords(level)
    setWordsData(w)
    setPhase('words')
  }, [])

  // 明示引数で英英モードを開始する（seed を指定して同じ問題列を再現できる）。
  // #364 range 時は単語(level 分)も並行ロードして freqMap（Map(en→freq)）を作り、範囲出題の freq 結合に使う。
  const startDict = useCallback(async (level, theme, modeKey, seed, range) => {
    const clamped = clampRange(range ?? null, dictRangeCount(level, theme))
    setDictLevel(level)
    setDictTheme(theme)
    setDictMode(modeKey)
    setDictSeed(seed)
    setDictRange(clamped)
    // 対象レベルの英英だけ＋英→和グロッサリを並行ロード（クイズ回答後に選んだ語の和訳を見出し下に出す）
    const loads = [loadDict(level), loadWordGloss(), loadWordRuby()]
    if (clamped != null) loads.push(loadWords(level))
    const [d, gloss, wordRuby, words] = await Promise.all(loads)
    setDictData(d)
    setDictGloss(gloss)
    setDictWordRuby(wordRuby)
    setDictFreqMap(clamped != null ? headwordFreqMap(words) : null)
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
          startWsent(record.rank, theme, record.mode, record.seed, record.range ?? null)
          return
        }
        case 'word':
          if (record.seed == null) return
          setGameType('words')
          setLearningMode(record.learning ?? 'normal') // #402 記録の学習モードで再現
          startWords(record.level, record.theme, record.mode, record.seed, record.range ?? null)
          return
        case 'dict':
          if (record.seed == null) return
          setGameType('dict')
          startDict(record.level, record.theme, record.mode, record.seed, record.range ?? null)
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
      startWords(wordLevel, wordTheme, wordMode, null, wordRange)
    } else if (gameType === 'dict') {
      // 英英データを遅延読み込みしてから英英モードへ（通常プレイは seed を渡さず、フックが内部生成）。
      startDict(dictLevel, dictTheme, dictMode, null, dictRange)
    } else if (gameType === 'touch') {
      setPhase('touch')
    } else if (gameType === 'romaji') {
      setPhase('romaji')
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
    wordRange,
    dictLevel,
    dictTheme,
    dictMode,
    dictRange,
  ])

  // Tab=種類、↑↓=レベル、←→=モード、Enter=スタート/もう一度、Esc=トップへ戻る
  useEffect(() => {
    const onNav = (e) => {
      if (e.key === 'Escape') {
        if (phase === 'about' || phase === 'allrecords') {
          e.preventDefault()
          setDetailRoute(null) // detail が cold not-found でオーバーレイ非表示のときも URL 反映を戻す
          setPhase('ready')
          return
        }
        if (phase === 'playing' || phase === 'result') {
          e.preventDefault()
          // エンドレスをプレイ中に ESC：30秒以上なら記録して結果へ（escFinish が onFinish 経由で
          // phase を result にする）。30秒未満/未打鍵や result 中は従来どおり TOP へ戻る。#208 段6
          if (phase === 'playing' && endCondition.kind === 'endless' && marathonEscFinish()) return
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
  }, [phase, start, startGame, rows, safeFocus, endCondition, marathonEscFinish])

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
      else if (p === 'romaji') {
        // ローマ字入力即プレイ（かな表確認用）。?level=... でレベル指定可。
        setGameType('romaji')
        const lv = new URLSearchParams(location.search).get('level')
        if (lv && ROMAJI_LEVEL_KEYS.includes(lv)) setRomajiLevel(lv)
        setPhase('romaji')
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
    <RecordDetailProvider openDetail={openDetail}>
    <AppMenuBar
      appName="英文・和文タイピング"
      onNavigateAbout={() => { setDetailRoute(null); setPhase('about') }}
      onNavigateAllRecords={() => { setDetailRoute(null); setPhase('allrecords') }}
    />
    <div className="app">
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
          onWsentLevelChange={onWsentLevelChange}
          wsentTheme={wsentTheme}
          onWsentThemeChange={onWsentThemeChange}
          wsentRange={wsentRange}
          onWsentRangeChange={setWsentRange}
          wordLevel={wordLevel}
          wordTheme={wordTheme}
          wordMode={wordMode}
          wordRange={wordRange}
          onWordLevelChange={onWordLevelChange}
          onThemeChange={onWordThemeChange}
          onWordModeChange={setWordMode}
          onWordRangeChange={setWordRange}
          dictLevel={dictLevel}
          dictTheme={dictTheme}
          dictMode={dictMode}
          dictRange={dictRange}
          onDictLevelChange={onDictLevelChange}
          onDictThemeChange={onDictThemeChange}
          onDictModeChange={setDictMode}
          onDictRangeChange={setDictRange}
          touchLevel={touchLevel}
          onTouchLevelChange={setTouchLevel}
          touchMode={touchMode}
          onTouchModeChange={setTouchMode}
          romajiLevel={romajiLevel}
          onRomajiLevelChange={setRomajiLevel}
          learningMode={learningMode}
          onLearningModeChange={setLearningMode}
          focusSection={focusSection}
          onFocusSection={focusSectionById}
          bottomTab={bottomTab}
          onBottomTabChange={setBottomTab}
          onStart={start}
          records={records}
          endCondition={endCondition}
          onEndConditionChange={setEndCondition}
        />
      )}

      {phase === 'about' && <AboutView onStart={() => setPhase('ready')} />}

      {phase === 'allrecords' && <AllRecordsView onExit={() => setPhase('ready')} />}

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

      {phase === 'romaji' && (
        <RomajiView
          key={romajiLevel}
          level={romajiLevel}
          levelLabel={romajiLevelLabel(romajiLevel)}
          mode={ROMAJI_MODE}
          onRecord={onRomajiRecord}
          onExit={() => setPhase('ready')}
        />
      )}

      {phase === 'words' && (
        <WordsView
          key={`${wordLevel}-${wordTheme}-${wordMode}-${wordRange}-${learningMode}-${wordSeed}`}
          words={wordsData}
          level={wordLevel}
          theme={wordTheme}
          mode={wordMode}
          seed={wordSeed}
          range={wordRange}
          learningMode={learningMode}
          levelLabel={`W${wordLevel} ${WORD_LEVELS.find((l) => l.level === wordLevel)?.label ?? ''}`}
          modeLabel={wordModeLabel(wordMode)}
          endCondition={endCondition}
          onExit={() => setPhase('ready')}
        />
      )}

      {phase === 'dict' && (
        <DictView
          key={`${dictLevel}-${dictTheme}-${dictMode}-${dictRange}-${dictSeed}`}
          dict={dictData}
          gloss={dictGloss}
          wordRuby={dictWordRuby}
          level={dictLevel}
          theme={dictTheme}
          mode={dictMode}
          seed={dictSeed}
          range={dictRange}
          freqMap={dictFreqMap}
          // #402 英英の穴埋めは通常入力（both/en/ja）で有効。翻訳・4択は normal に落とす。
          // 英英に jaWords は無いので ja モードは ranges 空＝通常表示（実害なし）。
          learningMode={supportsLearning(dictMode) ? learningMode : 'normal'}
          levelLabel={`L${dictLevel} ${WORD_LEVELS.find((l) => l.level === dictLevel)?.label ?? ''}`}
          modeLabel={dictModeLabel(dictMode)}
          endCondition={endCondition}
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
          endCondition={endCondition}
          // #406 HUD 分母の2倍補正に必要（useMarathon に渡すのと同じ値）。
          learningMode={supportsLearning(mode) ? learningMode : 'normal'}
          rankText={`単語例文 L${wsentLevel}`}
          gloss={wsentGloss}
          segments={segments}
          segIndex={segIndex}
          segInput={segInput}
          completed={completed}
          hasError={hasError}
          clozeRevealed={clozeRevealed}
          typedKeys={typedKeys}
          mistakes={mistakes}
          missedItems={missedItems}
          liveSpeed={liveSpeed}
          elapsedSec={elapsedSec}
        />
      )}

      {phase === 'result' && lastResult && (
        <Result result={lastResult} records={records} segStats={segStats} onRetry={startGame} />
      )}

      {/* #360 URL 由来の記録詳細オーバーレイ（単一・真実源は detailRoute＝URL）。resolveColdDetail が
          非 null のときだけ現画面の上に重ねる（null＝cold not-found/range 外/未知 kind は描かない）。 */}
      {detailResolved && (
        <RecordDetail
          list={detailResolved.ctx.list?.length ? detailResolved.ctx.list : [detailResolved.record]}
          initial={{ record: detailResolved.record, position: detailResolved.position }}
          rankText={detailResolved.ctx.rankText}
          modeKey={detailResolved.ctx.modeKey}
          isQuiz={detailResolved.ctx.isQuiz}
          hasEnding={detailResolved.ctx.hasEnding}
          onClose={closeDetail}
        />
      )}

      {phase === 'ready' && <p className="version">v{__APP_VERSION__}</p>}

      <SoundToggle />
      <OfflineBanner />
      <UpdateToast />
      <ContentFallbackNotice />
      <PersistNotice />
    </div>
    </RecordDetailProvider>
    </ReplayProvider>
  )
}
