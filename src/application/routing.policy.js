// #357 各ページを共有可能な URL（パス型ルーティング）にする純 codec。
// parseRoute（URL 文字列 → RouteState）と buildRoute（RouteState → URL 文字列）を
// 相互変換する純関数。決定的・入力非破壊で location/history/DOM を一切参照しない。
// base 非依存＝base の付与や history 操作は配線側（infra/ui）の責務。この層は
// 「base 除去済みの app 相対パス（先頭 '/'）」だけを扱う。
// 妥当値（level/theme/mode/story/touch/romaji/ec）は content から import して単一ソース化し、
// 丸め先・既定の根拠を content 側と一致させる（マジックリテラルの二重管理を避ける）。
import { WORD_LEVELS, WORD_THEMES, WORD_MODES } from '../content/words.js'
import { DICT_MODES, DICT_AVAILABLE_LEVELS } from '../content/dictionary.js'
import { MODES } from '../content/modes.js'
import { STORIES, DEFAULT_STORY_ID } from '../content/story.js'
import { TOUCH_LEVELS, TOUCH_MODES } from '../content/keyboard.js'
import { ROMAJI_LEVELS } from '../content/romaji.js'
import {
  END_TIME_VALUES,
  END_CHARS_VALUES,
  END_ITEMS_VALUES,
  END_LIFE_VALUES,
  DEFAULT_END_CONDITION,
} from '../content/endConditions.js'
import { makeEndCondition } from '../domain/session/endCondition.vo.js'

// --- 妥当値集合（content 単一ソースから導出） ---
const LEVEL_KEYS = WORD_LEVELS.map((l) => l.level) // [1,2,3,4]
const THEME_KEYS = ['すべて', ...WORD_THEMES] // ['すべて','日常','旅行','ビジネス']
const WSENT_MODE_KEYS = MODES.map((m) => m.key)
const WORD_MODE_KEYS = WORD_MODES.map((m) => m.key)
const DICT_MODE_KEYS = DICT_MODES.map((m) => m.key)
const STORY_IDS = STORIES.map((s) => s.id)
const TOUCH_LEVEL_KEYS = TOUCH_LEVELS.map((l) => l.key)
const TOUCH_MODE_KEYS = TOUCH_MODES.map((m) => m.key)
const ROMAJI_LEVEL_KEYS = ROMAJI_LEVELS.map((l) => l.key)

// 壊れた percent-encoding でも throw せず raw を返す（純関数の全域性を保つ）。
const safeDecode = (s) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

// --- 位置パラメータの定義（seg→値=parse・値→seg=build・既定=fallback） ---
// 数値 level。候補外/欠落は候補先頭（=1）へ丸める。
const levelParam = (levels) => ({
  key: 'level',
  parse: (seg) => (levels.includes(Number(seg)) ? Number(seg) : levels[0]),
  build: (v) => String(v),
})
// theme。URL 上は percent-encode。候補外/欠落は 'すべて' へ丸める。
const themeParam = {
  key: 'theme',
  parse: (seg) => (THEME_KEYS.includes(seg) ? seg : THEME_KEYS[0]),
  build: (v) => encodeURIComponent(v),
}
// 文字列 enum（mode/story/touch/romaji）。候補外/欠落は fallback へ丸める。
const enumParam = (key, keys, fallback) => ({
  key,
  parse: (seg) => (keys.includes(seg) ? seg : fallback),
  build: (v) => v,
})

// --- ルート表：URL slug ⇄ 内部 gameType と、そのページの位置パラメータ順 ---
const PAGES = {
  sentences: {
    gameType: 'wsent',
    params: [levelParam(LEVEL_KEYS), themeParam, enumParam('mode', WSENT_MODE_KEYS, 'both')],
  },
  words: {
    gameType: 'words',
    params: [levelParam(LEVEL_KEYS), themeParam, enumParam('mode', WORD_MODE_KEYS, 'en')],
  },
  dict: {
    gameType: 'dict',
    params: [levelParam(DICT_AVAILABLE_LEVELS), themeParam, enumParam('mode', DICT_MODE_KEYS, 'quiz')],
  },
  story: {
    gameType: 'story',
    params: [enumParam('storyId', STORY_IDS, DEFAULT_STORY_ID)],
  },
  touch: {
    gameType: 'touch',
    params: [
      enumParam('touchLevel', TOUCH_LEVEL_KEYS, TOUCH_LEVEL_KEYS[0]),
      enumParam('touchMode', TOUCH_MODE_KEYS, TOUCH_MODE_KEYS[0]),
    ],
  },
  romaji: {
    gameType: 'romaji',
    params: [enumParam('romajiLevel', ROMAJI_LEVEL_KEYS, ROMAJI_LEVEL_KEYS[0])],
  },
}
const DEFAULT_SLUG = 'sentences' // 未知 slug・ルートはここ（wsent）の既定へ丸める
// #359 アプリレベルの3画面（about/すべての記録/結果）にも URL を与える。これらは
// gameType/コンテンツ param/endCondition を持たない最小形 { view } で表す（内部 phase 写像は App 側）。
const VIEW_SLUGS = new Set(['about', 'records', 'result'])
const SLUG_BY_GAMETYPE = Object.fromEntries(
  Object.entries(PAGES).map(([slug, p]) => [p.gameType, slug]),
)

// --- 終了条件（ec）セグメント ⇄ EndCondition VO ---
// t{N}=time / c{N}=chars / i{N}=items / l{N}=life / e=endless。
const EC_KIND_BY_PREFIX = { t: 'time', c: 'chars', i: 'items', l: 'life' }
const EC_PREFIX_BY_KIND = { time: 't', chars: 'c', items: 'i', life: 'l' }
const EC_VALUES_BY_KIND = {
  time: END_TIME_VALUES,
  chars: END_CHARS_VALUES,
  items: END_ITEMS_VALUES,
  life: END_LIFE_VALUES,
}

// ec セグメント → EndCondition VO。欠落・不正な種別/値は既定（time60）へ丸める。
function parseEndCondition(seg) {
  if (seg == null) return DEFAULT_END_CONDITION
  if (seg === 'e') return makeEndCondition('endless') // {kind:'endless',value:null}
  const kind = EC_KIND_BY_PREFIX[seg[0]]
  if (!kind) return DEFAULT_END_CONDITION
  const value = Number(seg.slice(1))
  if (!EC_VALUES_BY_KIND[kind].includes(value)) return DEFAULT_END_CONDITION
  return makeEndCondition(kind, value)
}

// EndCondition VO → ec セグメント。既定（time60）は null＝末尾から省略、endless は 'e'。
function buildEndCondition(endCondition) {
  const { kind, value } = endCondition
  if (kind === 'endless') return 'e'
  if (kind === 'time' && value === 60) return null // 既定は URL に出さない
  return `${EC_PREFIX_BY_KIND[kind]}${value}`
}

// base 除去済み app 相対パス（先頭 '/'）を、位置ベースで RouteState へ解析する。
// 常に valid な最小形 RouteState を返す（欠落は既定補完・不正値/未知 slug/不正 ec は throw せず既定へ丸め）。
// 余分な末尾セグメント・末尾スラッシュは無視する。
export function parseRoute(appPath) {
  const segs = String(appPath ?? '')
    .split('/')
    .filter(Boolean)
    .map(safeDecode)
  // #359 先頭が view slug のときは最小形 { view } を返す（末尾スラッシュ・余分な末尾セグメント無視）。
  if (VIEW_SLUGS.has(segs[0])) return { view: segs[0] }
  const known = PAGES[segs[0]]
  const page = known ?? PAGES[DEFAULT_SLUG] // 未知 slug → wsent 既定
  const rest = known ? segs.slice(1) : [] // 未知 slug は残りを無視し全既定へ
  const state = { gameType: page.gameType }
  page.params.forEach((p, i) => {
    state[p.key] = p.parse(rest[i]) // rest[i] が undefined＝欠落なら parse が既定へ丸める
  })
  state.endCondition = parseEndCondition(rest[page.params.length]) // 位置パラメータ直後が ec
  return state
}

// RouteState → 先頭 '/' の正準パス（root は '/'、theme は encode、既定 ec は省略）。入力非破壊。
function rawBuild(state) {
  const slug = SLUG_BY_GAMETYPE[state.gameType] ?? DEFAULT_SLUG
  const parts = PAGES[slug].params.map((p) => p.build(state[p.key]))
  const ecSeg = buildEndCondition(state.endCondition)
  if (ecSeg != null) parts.push(ecSeg)
  return `/${[slug, ...parts].join('/')}`
}

// ルート既定（wsent・level1・すべて・both・time60）の正準パス。これに一致するとき root '/' に畳む。
const ROOT_PATH = rawBuild({
  gameType: 'wsent',
  level: 1,
  theme: 'すべて',
  mode: 'both',
  endCondition: DEFAULT_END_CONDITION,
})

export function buildRoute(state) {
  // #359 view は最小形（'/about'|'/records'|'/result'）。endCondition/content param を参照しない。
  if (state.view) return `/${state.view}`
  const path = rawBuild(state)
  return path === ROOT_PATH ? '/' : path
}
