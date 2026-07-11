// #357 各ページに共有可能な URL（パス型ルーティング）の純 codec `routing.policy.js` の契約テスト。
// 対象は本ファイルの隣に coder が作る純関数 parseRoute/buildRoute（URL 文字列 ⇄ RouteState）。
// - parseRoute(appPath): base を除いた app 相対パス（先頭 '/'）を常に valid な RouteState に変換
//   （欠落は既定補完・不正値はそのページ内の既定へ丸め・throw しない）。
// - buildRoute(state): 先頭 '/' の正準パス（root は '/'、theme は encodeURIComponent、既定 ec は省略）。
//
// 独立性の方針：codec の内部実装を写経せず、URL 文字列 ⇄ RouteState の「外形・往復不変・丸め規約」を固定する。
// enum の妥当値は content から import して期待値に使う（マジックリテラルの二重管理を避ける）。
// RouteState は gameType（内部キー）＋そのページに関係する param だけを持つ「最小形」を契約とする
//   （story が theme を持たない等）。endCondition のみ常に present（既定 {kind:'time',value:60}）。
// 本ファイルは純粋（DOM/クロック/乱数/ストレージ非依存）なので既定の node 環境で回す（jsdom 不要）。
import { describe, it, expect } from 'vitest'

// ↓ 本体は未実装。この import で「正しい理由の Red（module not found）」になる（狙い）。
import { parseRoute, buildRoute } from './routing.policy.js'

// 正準値（実 enum を単一ソースに）
import { WORD_LEVELS, WORD_THEMES, WORD_MODES } from '../content/words.js'
import { DICT_MODES, DICT_AVAILABLE_LEVELS } from '../content/dictionary.js'
import { MODES } from '../content/modes.js'
import { STORIES, DEFAULT_STORY_ID } from '../content/story.js'
import { TOUCH_LEVELS, TOUCH_MODES } from '../content/keyboard.js'
import { ROMAJI_LEVELS } from '../content/romaji.js'
import { makeEndCondition } from '../domain/session/endCondition.vo.js'

// --- helpers（期待値の単一ソース。実装の写経ではなく仕様の言語化） ---
const ec = (kind, value) => makeEndCondition(kind, value)
const EC_DEFAULT = ec('time', 60) // {kind:'time',value:60}
const enc = (s) => encodeURIComponent(s)

// enum が期待どおりの妥当値集合であることを前提化（丸め・既定の根拠が content 側と一致することを担保）
const LEVEL_KEYS = WORD_LEVELS.map((l) => l.level) // [1,2,3,4]
const THEME_KEYS = ['すべて', ...WORD_THEMES] // ['すべて','日常','旅行','ビジネス']
const WSENT_MODE_KEYS = MODES.map((m) => m.key) // both,en,ja,en-tr,ja-tr
const WORD_MODE_KEYS = WORD_MODES.map((m) => m.key) // both,en,ja,quiz-en,quiz-ja
const DICT_MODE_KEYS = DICT_MODES.map((m) => m.key) // both,en,ja,quiz,pick
const STORY_IDS = STORIES.map((s) => s.id) // travel,climbing
const TOUCH_LEVEL_KEYS = TOUCH_LEVELS.map((l) => l.key) // home,top,bottom,number,all
const TOUCH_MODE_KEYS = TOUCH_MODES.map((m) => m.key) // easy,hard
const ROMAJI_LEVEL_KEYS = ROMAJI_LEVELS.map((l) => l.key) // a,ka,...,all

// content 側の enum が本テストの前提（既定値・丸め先）を満たすことを先に固定する。
describe('routing.policy: 前提とする enum（content 単一ソース）', () => {
  it('level/theme/mode/story/touch/romaji の既定値が enum に含まれる', () => {
    expect(LEVEL_KEYS).toContain(1)
    expect(DICT_AVAILABLE_LEVELS).toContain(1)
    expect(THEME_KEYS[0]).toBe('すべて')
    expect(WSENT_MODE_KEYS).toContain('both')
    expect(WORD_MODE_KEYS).toContain('en')
    expect(DICT_MODE_KEYS).toContain('quiz')
    expect(STORY_IDS).toContain('travel')
    expect(DEFAULT_STORY_ID).toBe('travel')
    expect(TOUCH_LEVEL_KEYS[0]).toBe('home')
    expect(TOUCH_MODE_KEYS[0]).toBe('easy')
    expect(ROMAJI_LEVEL_KEYS[0]).toBe('a')
  })
})

describe('routing.policy: parseRoute（URL → RouteState）', () => {
  it('1. ルート/空文字はルート既定 RouteState（wsent・level1・すべて・both・time60）', () => {
    const expected = {
      gameType: 'wsent',
      level: 1,
      theme: 'すべて',
      mode: 'both',
      endCondition: EC_DEFAULT,
    }
    expect(parseRoute('/')).toEqual(expected)
    expect(parseRoute('')).toEqual(expected)
  })

  it('2. 各ページの基本 parse が内部キーの RouteState になる（ec は既定）', () => {
    expect(parseRoute('/sentences/2/日常/en')).toEqual({
      gameType: 'wsent',
      level: 2,
      theme: '日常',
      mode: 'en',
      endCondition: EC_DEFAULT,
    })
    expect(parseRoute('/words/1/日常/en')).toEqual({
      gameType: 'words',
      level: 1,
      theme: '日常',
      mode: 'en',
      endCondition: EC_DEFAULT,
    })
    expect(parseRoute('/dict/2/ビジネス/quiz')).toEqual({
      gameType: 'dict',
      level: 2,
      theme: 'ビジネス',
      mode: 'quiz',
      endCondition: EC_DEFAULT,
    })
    expect(parseRoute('/story/travel')).toEqual({
      gameType: 'story',
      storyId: 'travel',
      endCondition: EC_DEFAULT,
    })
    expect(parseRoute('/touch/home/easy')).toEqual({
      gameType: 'touch',
      touchLevel: 'home',
      touchMode: 'easy',
      endCondition: EC_DEFAULT,
    })
    expect(parseRoute('/romaji/ka')).toEqual({
      gameType: 'romaji',
      romajiLevel: 'ka',
      endCondition: EC_DEFAULT,
    })
  })

  it('3. percent-encoding された theme を復号する', () => {
    // %E6%97%A5%E5%B8%B8 === encodeURIComponent('日常')
    expect(parseRoute('/words/1/%E6%97%A5%E5%B8%B8/en').theme).toBe('日常')
  })

  it('4. 各セグメントの不正値はそのページ内の既定へ丸める（throw しない）', () => {
    expect(parseRoute('/words/9/日常/en').level).toBe(1) // 存在しない level → 1
    expect(parseRoute('/words/1/宇宙/en').theme).toBe('すべて') // 不明 theme → すべて
    expect(parseRoute('/words/1/日常/zzz').mode).toBe('en') // 不明 mode → words 既定 en
    expect(parseRoute('/story/unknown').storyId).toBe('travel') // 不明 storyId → travel
    const t = parseRoute('/touch/foo/bar')
    expect(t.touchLevel).toBe('home')
    expect(t.touchMode).toBe('easy')
    expect(parseRoute('/romaji/zzz').romajiLevel).toBe('a')
  })

  it('5. 末尾省略は各ページの既定で補完する', () => {
    expect(parseRoute('/words')).toEqual({
      gameType: 'words',
      level: 1,
      theme: 'すべて',
      mode: 'en',
      endCondition: EC_DEFAULT,
    })
    expect(parseRoute('/sentences')).toEqual({
      gameType: 'wsent',
      level: 1,
      theme: 'すべて',
      mode: 'both',
      endCondition: EC_DEFAULT,
    })
    expect(parseRoute('/touch')).toEqual({
      gameType: 'touch',
      touchLevel: 'home',
      touchMode: 'easy',
      endCondition: EC_DEFAULT,
    })
    expect(parseRoute('/romaji')).toEqual({
      gameType: 'romaji',
      romajiLevel: 'a',
      endCondition: EC_DEFAULT,
    })
  })

  it('6. 未知 slug はルート既定（wsent）へ丸める', () => {
    expect(parseRoute('/xyz')).toEqual({
      gameType: 'wsent',
      level: 1,
      theme: 'すべて',
      mode: 'both',
      endCondition: EC_DEFAULT,
    })
  })

  it('7. 末尾 ec セグメントを終了条件に復号し、不正な ec は既定 time60 へ丸める', () => {
    const base = '/words/1/日常/en'
    expect(parseRoute(`${base}/t30`).endCondition).toEqual(ec('time', 30))
    expect(parseRoute(`${base}/c600`).endCondition).toEqual(ec('chars', 600))
    expect(parseRoute(`${base}/i25`).endCondition).toEqual(ec('items', 25))
    expect(parseRoute(`${base}/l3`).endCondition).toEqual(ec('life', 3))
    expect(parseRoute(`${base}/e`).endCondition).toEqual(ec('endless', null))
    expect(parseRoute(`${base}/zzz`).endCondition).toEqual(EC_DEFAULT) // 不正 ec → 既定
  })

  it('7b. 末尾スラッシュ・余分な末尾セグメントは無視する', () => {
    expect(parseRoute('/words/1/日常/en/')).toEqual(parseRoute('/words/1/日常/en'))
    expect(parseRoute('/story/travel/')).toEqual(parseRoute('/story/travel'))
  })
})

describe('routing.policy: buildRoute（RouteState → URL）', () => {
  it('8. 基本の buildRoute（slug は sentences・theme は encode・既定 ec は省略）', () => {
    expect(
      buildRoute({
        gameType: 'wsent',
        level: 1,
        theme: 'すべて',
        mode: 'both',
        endCondition: { kind: 'time', value: 60 },
      }),
    ).toBe('/sentences/1/%E3%81%99%E3%81%B9%E3%81%A6/both')

    expect(
      buildRoute({
        gameType: 'words',
        level: 1,
        theme: '日常',
        mode: 'en',
        endCondition: EC_DEFAULT,
      }),
    ).toBe('/words/1/%E6%97%A5%E5%B8%B8/en')

    expect(
      buildRoute({ gameType: 'story', storyId: 'travel', endCondition: EC_DEFAULT }),
    ).toBe('/story/travel')

    expect(
      buildRoute({
        gameType: 'touch',
        touchLevel: 'home',
        touchMode: 'easy',
        endCondition: EC_DEFAULT,
      }),
    ).toBe('/touch/home/easy')

    expect(
      buildRoute({ gameType: 'romaji', romajiLevel: 'ka', endCondition: EC_DEFAULT }),
    ).toBe('/romaji/ka')
  })

  it('8b. ルート既定 RouteState は "/" になる', () => {
    expect(
      buildRoute({
        gameType: 'wsent',
        level: 1,
        theme: 'すべて',
        mode: 'both',
        endCondition: EC_DEFAULT,
      }),
    ).toBe('/')
  })

  it('9. 非既定 ec は末尾に付き、既定 time60 は付かない', () => {
    const base = {
      gameType: 'words',
      level: 1,
      theme: '日常',
      mode: 'en',
    }
    const enc日常 = enc('日常')
    expect(buildRoute({ ...base, endCondition: ec('time', 30) })).toBe(
      `/words/1/${enc日常}/en/t30`,
    )
    expect(buildRoute({ ...base, endCondition: ec('chars', 600) })).toBe(
      `/words/1/${enc日常}/en/c600`,
    )
    expect(buildRoute({ ...base, endCondition: ec('items', 25) })).toBe(
      `/words/1/${enc日常}/en/i25`,
    )
    expect(buildRoute({ ...base, endCondition: ec('life', 3) })).toBe(
      `/words/1/${enc日常}/en/l3`,
    )
    expect(buildRoute({ ...base, endCondition: ec('endless', null) })).toBe(
      `/words/1/${enc日常}/en/e`,
    )
    // 既定 time60 は末尾 ec なし
    expect(buildRoute({ ...base, endCondition: ec('time', 60) })).toBe(
      `/words/1/${enc日常}/en`,
    )
  })
})

describe('routing.policy: 往復不変（最重要）', () => {
  // 代表的な valid RouteState 群（各ページ・各 ec 種別を横断）
  const states = [
    { gameType: 'wsent', level: 2, theme: '日常', mode: 'en', endCondition: ec('time', 60) },
    { gameType: 'wsent', level: 1, theme: 'すべて', mode: 'both', endCondition: ec('chars', 600) },
    { gameType: 'words', level: 4, theme: 'ビジネス', mode: 'quiz-ja', endCondition: ec('time', 30) },
    { gameType: 'dict', level: 3, theme: '旅行', mode: 'pick', endCondition: ec('items', 25) },
    { gameType: 'story', storyId: 'climbing', endCondition: ec('life', 3) },
    { gameType: 'touch', touchLevel: 'top', touchMode: 'hard', endCondition: ec('endless', null) },
    { gameType: 'romaji', romajiLevel: 'youon', endCondition: ec('time', 120) },
  ]

  it('10. parseRoute(buildRoute(S)) === S（gameType・各 param・endCondition まで一致）', () => {
    for (const s of states) {
      expect(parseRoute(buildRoute(s))).toEqual(s)
    }
  })

  it('10b. 任意 path で parseRoute(buildRoute(parseRoute(p))) が parseRoute(p) と一致（冪等）', () => {
    const paths = [
      '/',
      '/sentences/2/日常/en',
      '/words/9/日常/zzz', // 不正値混じり → 丸め後で安定
      '/dict/2/ビジネス/quiz/c1200',
      '/story/unknown', // 不正 storyId → 丸め後で安定
      '/touch/foo/bar/t30',
      '/romaji/zzz/e',
      '/xyz', // 未知 slug
    ]
    for (const p of paths) {
      const once = parseRoute(p)
      expect(parseRoute(buildRoute(once))).toEqual(once)
    }
  })
})

describe('routing.policy: 純粋・非破壊・環境非依存', () => {
  it('11. 同一入力で同一出力（決定的）', () => {
    expect(parseRoute('/words/1/日常/en/t30')).toEqual(parseRoute('/words/1/日常/en/t30'))
    const s = { gameType: 'words', level: 1, theme: '日常', mode: 'en', endCondition: ec('time', 30) }
    expect(buildRoute(s)).toBe(buildRoute(s))
  })

  it('11b. buildRoute は入力 state を破壊しない', () => {
    const s = { gameType: 'story', storyId: 'travel', endCondition: ec('chars', 600) }
    const snapshot = structuredClone(s)
    buildRoute(s)
    expect(s).toEqual(snapshot)
  })

  it('11c. location/history/DOM を参照しない（node 環境＝window 不在でも動作）', () => {
    // 本ファイルは jsdom を指定していない＝ window/document は未定義。
    // それらを参照する実装なら ReferenceError で落ちるので、正常動作＝環境非依存の証左。
    expect(typeof window).toBe('undefined')
    expect(() => parseRoute('/words/1/日常/en')).not.toThrow()
    expect(() =>
      buildRoute({ gameType: 'words', level: 1, theme: '日常', mode: 'en', endCondition: EC_DEFAULT }),
    ).not.toThrow()
  })
})
