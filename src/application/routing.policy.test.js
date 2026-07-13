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
    // 完全な既定状態は正準 root '/' に畳む（test 8b が担保）ため、
    // wsent の full-path 形は「非既定状態」で示す（level:2）。
    expect(
      buildRoute({
        gameType: 'wsent',
        level: 2,
        theme: 'すべて',
        mode: 'both',
        endCondition: { kind: 'time', value: 60 },
      }),
    ).toBe('/sentences/2/%E3%81%99%E3%81%B9%E3%81%A6/both')

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

describe('routing.policy: view ルート（about/records/result）#359', () => {
  // アプリレベルの3画面にも URL を与える。view のときは gameType/コンテンツ param/endCondition を
  // 持たない「最小形」 { view: '...' } を契約とする（内部 phase への写像は App 側の責務）。
  const VIEWS = ['about', 'records', 'result']

  it('12. parseRoute の /about・/records・/result が最小形 {view:...} になる', () => {
    expect(parseRoute('/about')).toEqual({ view: 'about' })
    expect(parseRoute('/records')).toEqual({ view: 'records' })
    expect(parseRoute('/result')).toEqual({ view: 'result' })
  })

  it('13. buildRoute({view:...}) が /about|/records|/result になる', () => {
    expect(buildRoute({ view: 'about' })).toBe('/about')
    expect(buildRoute({ view: 'records' })).toBe('/records')
    expect(buildRoute({ view: 'result' })).toBe('/result')
  })

  it('14. view の往復不変（parse∘build と build∘parse の冪等）', () => {
    for (const v of VIEWS) {
      expect(parseRoute(buildRoute({ view: v }))).toEqual({ view: v })
      expect(parseRoute(buildRoute(parseRoute(`/${v}`)))).toEqual(parseRoute(`/${v}`))
    }
  })

  it('15. 末尾スラッシュ・余分な末尾セグメントは view として無視される', () => {
    expect(parseRoute('/about/')).toEqual({ view: 'about' })
    expect(parseRoute('/records/x')).toEqual({ view: 'records' })
    expect(parseRoute('/result/foo/bar')).toEqual({ view: 'result' })
  })

  it('16. content ルート・未知 slug は view キーを持たない（回帰防止）', () => {
    // content ルートは従来どおり内部キーの RouteState（view 無し）
    expect(parseRoute('/words/1/日常/en')).not.toHaveProperty('view')
    expect(parseRoute('/words/1/日常/en').gameType).toBe('words')
    // ルート既定 wsent も view 無し
    expect(parseRoute('/')).not.toHaveProperty('view')
    // about/records/result 以外の未知 slug は従来どおり wsent 既定（view にならない）
    expect(parseRoute('/xyz')).not.toHaveProperty('view')
    expect(parseRoute('/xyz').gameType).toBe('wsent')
  })
})

describe('routing.policy: record-detail ルート（/records 下ネスト）#360', () => {
  // 記録詳細に共有可能な URL を与える。URL 文法は
  //   /records/<slug>/<coords...>/[ec]/<position>
  // - slug: words/dict/sentences/story（#357 と一貫。sentences ⇄ 内部 kind 'wsent'）。
  // - coords 個数固定: words/dict/sentences=3（level/theme/mode）、story=1（storyId）。
  // - ec: #357 の ec セグメント（t30/c600/i25/l3/e・既定 time60 は省略）。省略可。
  // - position: 末尾の裸の正整数（1 始まり）。
  // 解析規則: slug で coords 個数が決まる → coords を除いた残りで判定
  //   残り1=position（ec 既定）／残り2=[ec,position]／残り0=不正。
  // RouteState（最小形）: { view:'record-detail', kind, level?/theme?/mode?/storyId?, endCondition, position }。
  // 不正・欠落は記録一覧ビュー { view:'records' } へ丸める（throw しない）。

  it('R1. /records は従来どおり {view:"records"}（record-detail と非衝突・回帰防止）', () => {
    expect(parseRoute('/records')).toEqual({ view: 'records' })
  })

  it('R2. words の基本 parse（ec 既定 time60・position は末尾正整数）', () => {
    expect(parseRoute('/records/words/1/日常/en/2')).toEqual({
      view: 'record-detail',
      kind: 'words',
      level: 1,
      theme: '日常',
      mode: 'en',
      endCondition: EC_DEFAULT,
      position: 2,
    })
  })

  it('R3. 非既定 ec は position の直前セグメント（t30 → time30）', () => {
    expect(parseRoute('/records/words/1/日常/en/t30/2')).toEqual({
      view: 'record-detail',
      kind: 'words',
      level: 1,
      theme: '日常',
      mode: 'en',
      endCondition: ec('time', 30),
      position: 2,
    })
  })

  it('R4. dict / sentences(wsent) の基本 parse（sentences ⇄ kind wsent）', () => {
    expect(parseRoute('/records/dict/2/ビジネス/quiz/3')).toEqual({
      view: 'record-detail',
      kind: 'dict',
      level: 2,
      theme: 'ビジネス',
      mode: 'quiz',
      endCondition: EC_DEFAULT,
      position: 3,
    })
    expect(parseRoute('/records/sentences/1/すべて/both/2')).toEqual({
      view: 'record-detail',
      kind: 'wsent', // slug 'sentences' ⇄ RouteState.kind 'wsent'
      level: 1,
      theme: 'すべて',
      mode: 'both',
      endCondition: EC_DEFAULT,
      position: 2,
    })
  })

  it('R5. story の基本 parse（coords は storyId 1個・level/theme/mode を持たない）', () => {
    expect(parseRoute('/records/story/travel/1')).toEqual({
      view: 'record-detail',
      kind: 'story',
      storyId: 'travel',
      endCondition: EC_DEFAULT,
      position: 1,
    })
    expect(parseRoute('/records/story/travel/e/3')).toEqual({
      view: 'record-detail',
      kind: 'story',
      storyId: 'travel',
      endCondition: ec('endless', null),
      position: 3,
    })
  })

  it('R6. percent-encoding された theme を復号する', () => {
    // %E6%97%A5%E5%B8%B8 === encodeURIComponent('日常')
    expect(parseRoute('/records/words/1/%E6%97%A5%E5%B8%B8/en/2').theme).toBe('日常')
  })

  it('R7. 不正・欠落は記録一覧 {view:"records"} へ丸める（throw しない）', () => {
    // position 無し（coords 消化後の残り0）
    expect(parseRoute('/records/words/1/日常/en')).toEqual({ view: 'records' })
    // position が正整数でない（0 / 非数字）
    expect(parseRoute('/records/words/1/日常/en/0')).toEqual({ view: 'records' })
    expect(parseRoute('/records/words/1/日常/en/abc')).toEqual({ view: 'records' })
    // 未知 slug（record-detail の kind ではない）
    expect(parseRoute('/records/unknownkind/1/2')).toEqual({ view: 'records' })
    // coords 不足（story は storyId が要る）
    expect(parseRoute('/records/story')).toEqual({ view: 'records' })
  })

  it('R8. 座標の不正値はそのページ内の既定へ丸める（kind と position は保持）', () => {
    expect(parseRoute('/records/words/99/xxx/zzz/2')).toEqual({
      view: 'record-detail',
      kind: 'words',
      level: 1, // 存在しない level → 1
      theme: 'すべて', // 不明 theme → すべて
      mode: 'en', // 不明 mode → words 既定 en
      endCondition: EC_DEFAULT,
      position: 2,
    })
  })

  it('R9. buildRoute（words・theme encode・既定 ec は省略・末尾 position）', () => {
    expect(
      buildRoute({
        view: 'record-detail',
        kind: 'words',
        level: 1,
        theme: '日常',
        mode: 'en',
        endCondition: EC_DEFAULT,
        position: 2,
      }),
    ).toBe('/records/words/1/%E6%97%A5%E5%B8%B8/en/2')
  })

  it('R10. buildRoute（kind wsent → slug sentences・非既定 ec は position の前）', () => {
    expect(
      buildRoute({
        view: 'record-detail',
        kind: 'wsent',
        level: 2,
        theme: 'すべて',
        mode: 'both',
        endCondition: ec('time', 30),
        position: 2,
      }),
    ).toBe('/records/sentences/2/%E3%81%99%E3%81%B9%E3%81%A6/both/t30/2')
  })

  it('R11. buildRoute（story → /records/story/<storyId>/<position>・endless は e）', () => {
    expect(
      buildRoute({
        view: 'record-detail',
        kind: 'story',
        storyId: 'travel',
        endCondition: EC_DEFAULT,
        position: 1,
      }),
    ).toBe('/records/story/travel/1')
    expect(
      buildRoute({
        view: 'record-detail',
        kind: 'story',
        storyId: 'climbing',
        endCondition: ec('endless', null),
        position: 2,
      }),
    ).toBe('/records/story/climbing/e/2')
  })

  it('R12. buildRoute({view:"records"}) は /records（従来・非衝突）', () => {
    expect(buildRoute({ view: 'records' })).toBe('/records')
  })

  it('R13. record-detail の往復不変（全 kind × ec 有無で parse∘build が正規化 s と一致）', () => {
    const states = [
      { view: 'record-detail', kind: 'words', level: 1, theme: '日常', mode: 'en', endCondition: ec('time', 60), position: 2 },
      { view: 'record-detail', kind: 'words', level: 4, theme: 'ビジネス', mode: 'quiz-ja', endCondition: ec('time', 30), position: 1 },
      { view: 'record-detail', kind: 'wsent', level: 2, theme: 'すべて', mode: 'both', endCondition: ec('chars', 600), position: 3 },
      { view: 'record-detail', kind: 'dict', level: 3, theme: '旅行', mode: 'pick', endCondition: ec('items', 25), position: 5 },
      { view: 'record-detail', kind: 'story', storyId: 'travel', endCondition: ec('time', 60), position: 1 },
      { view: 'record-detail', kind: 'story', storyId: 'climbing', endCondition: ec('endless', null), position: 2 },
    ]
    for (const s of states) {
      expect(parseRoute(buildRoute(s))).toEqual(s)
    }
  })

  it('R14. record-detail path の冪等（parse∘build∘parse が parse と一致）', () => {
    const paths = [
      '/records/words/1/日常/en/2',
      '/records/words/1/日常/en/t30/2',
      '/records/sentences/1/すべて/both/2',
      '/records/dict/2/ビジネス/quiz/3',
      '/records/story/travel/1',
      '/records/story/travel/e/3',
      '/records/words/99/xxx/zzz/2', // 不正座標混じり → 丸め後で安定
      '/records/words/1/日常/en', // 不正（position 無し）→ {view:'records'} で安定
    ]
    for (const p of paths) {
      const once = parseRoute(p)
      expect(parseRoute(buildRoute(once))).toEqual(once)
    }
  })

  it('R15. 既存 content ルート・view ルート・未知 slug フォールバックは壊れない（回帰）', () => {
    // content ルートは従来どおり内部キー（view 無し）
    expect(parseRoute('/words/1/日常/en').gameType).toBe('words')
    expect(parseRoute('/words/1/日常/en')).not.toHaveProperty('view')
    // 他 view はそのまま
    expect(parseRoute('/about')).toEqual({ view: 'about' })
    expect(parseRoute('/result')).toEqual({ view: 'result' })
    // /records 直下の未知 slug は記録一覧へ（従来 {view:'records'} を維持）
    expect(parseRoute('/records/x')).toEqual({ view: 'records' })
    // 未知トップ slug は従来どおり wsent 既定
    expect(parseRoute('/xyz').gameType).toBe('wsent')
  })
})

describe('routing.policy: words の固定範囲 range セグメント（r{n}）#362', () => {
  // 単語ルートの末尾に range セグメント `r{n}`（1 始まりの正整数）を付ける。
  // 既存の ec セグメント（t/c/i/l/e）と接頭辞で区別し、末尾の残りセグメントを分類する
  //   （`r`→range・`t/c/i/l/e`→ec＝record-detail parser の「残り分類」流儀）。
  // RouteState(words) には range?（正整数・省略時 undefined）を足す。
  // build 順は「ec 非既定セグメント → range セグメント」（range 無しは出さない）。
  // range は words 専用（story/dict/sentences/touch/romaji には付けない・付いても従来どおり無視）。
  const enc日常 = enc('日常')
  const wordsBase = { gameType: 'words', level: 1, theme: '日常', mode: 'en' }

  it('r1. /words/1/日常/en/r2 が range:2 を持つ（ec は既定 time60）', () => {
    expect(parseRoute('/words/1/日常/en/r2')).toEqual({
      ...wordsBase,
      endCondition: EC_DEFAULT,
      range: 2,
    })
  })

  it('r2. ec セグメントと range セグメントが併存できる（/words/1/日常/en/i25/r2）', () => {
    expect(parseRoute('/words/1/日常/en/i25/r2')).toEqual({
      ...wordsBase,
      endCondition: ec('items', 25),
      range: 2,
    })
  })

  it('r3. range 無しの words ルートは range を持たない（undefined）', () => {
    expect(parseRoute('/words/1/日常/en')).not.toHaveProperty('range')
  })

  it('r4. 不正な range（r0・rx・r1.5）は range 無しへ丸める（他は従来通り）', () => {
    expect(parseRoute('/words/1/日常/en/r0')).not.toHaveProperty('range')
    expect(parseRoute('/words/1/日常/en/rx')).not.toHaveProperty('range')
    expect(parseRoute('/words/1/日常/en/r1.5')).not.toHaveProperty('range')
    // 不正 range でも他フィールドは従来どおり
    expect(parseRoute('/words/1/日常/en/r0')).toEqual({ ...wordsBase, endCondition: EC_DEFAULT })
  })

  it('r5. buildRoute（range → 末尾 r セグメント・theme encode）', () => {
    expect(buildRoute({ ...wordsBase, endCondition: EC_DEFAULT, range: 2 })).toBe(
      `/words/1/${enc日常}/en/r2`,
    )
  })

  it('r6. ec 非既定＋range は ec セグメント→range セグメントの順', () => {
    expect(buildRoute({ ...wordsBase, endCondition: ec('items', 25), range: 2 })).toBe(
      `/words/1/${enc日常}/en/i25/r2`,
    )
  })

  it('r7. range 無しは r セグメントを出さない', () => {
    expect(buildRoute({ ...wordsBase, endCondition: EC_DEFAULT })).toBe(
      `/words/1/${enc日常}/en`,
    )
  })

  it('r8. range 有無×ec 有無で往復不変（parseRoute(buildRoute(s)) === s）', () => {
    const states = [
      { ...wordsBase, endCondition: EC_DEFAULT, range: 2 },
      { gameType: 'words', level: 4, theme: 'ビジネス', mode: 'quiz-ja', endCondition: ec('items', 25), range: 3 },
      { gameType: 'words', level: 1, theme: 'すべて', mode: 'en', endCondition: ec('time', 30), range: 1 },
      // range 無し（従来形）も壊れない
      { ...wordsBase, endCondition: EC_DEFAULT },
      { gameType: 'words', level: 4, theme: 'ビジネス', mode: 'quiz-ja', endCondition: ec('items', 25) },
    ]
    for (const s of states) {
      expect(parseRoute(buildRoute(s))).toEqual(s)
    }
  })

  it('r9. range を含む path の冪等（parse∘build∘parse が parse と一致）', () => {
    const paths = [
      '/words/1/日常/en/r2',
      '/words/1/日常/en/i25/r2',
      '/words/1/日常/en/r0', // 不正 range → 丸め後で安定
      '/words/1/日常/en', // range 無し
    ]
    for (const p of paths) {
      const once = parseRoute(p)
      expect(parseRoute(buildRoute(once))).toEqual(once)
    }
  })

  it('r10. range は words 専用（story/dict は range を持たない・付いても無視）', () => {
    // 末尾 r セグメントを付けても range は付与されない（従来どおり無視）
    expect(parseRoute('/story/travel/r2')).not.toHaveProperty('range')
    expect(parseRoute('/dict/2/ビジネス/quiz/r2')).not.toHaveProperty('range')
    // range プロパティを与えても words 以外は URL に出さない
    expect(buildRoute({ gameType: 'dict', level: 2, theme: 'ビジネス', mode: 'quiz', endCondition: EC_DEFAULT, range: 2 })).not.toContain('r2')
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

describe('routing.policy: dict / sentences の固定範囲 range セグメント（r{n}）#364', () => {
  // #362 で words 専用だった range を dict/sentences(wsent) ルートにも一般化する。
  // - 末尾 r{n}（1 始まりの正整数）を range として解し、ec セグメント（t/c/i/l/e）と接頭辞で区別する。
  // - build は「ec 非既定セグメント → range セグメント」の順（range 無しは出さない）。
  // - story/touch/romaji は range 非対応（付いても従来どおり無視・range を持たない）。
  // - RouteState.gameType は wsent（URL slug は sentences）。既存 words range/content/view/record-detail は非回帰。
  const enc日常 = enc('日常')
  const encビジネス = enc('ビジネス')

  it('g1. /dict/2/ビジネス/quiz/r3 が dict RouteState に range:3 を持つ（ec は既定）', () => {
    expect(parseRoute('/dict/2/ビジネス/quiz/r3')).toEqual({
      gameType: 'dict',
      level: 2,
      theme: 'ビジネス',
      mode: 'quiz',
      endCondition: EC_DEFAULT,
      range: 3,
    })
  })

  it('g2. /sentences/1/日常/both/r2 が wsent RouteState に range:2 を持つ', () => {
    expect(parseRoute('/sentences/1/日常/both/r2')).toEqual({
      gameType: 'wsent',
      level: 1,
      theme: '日常',
      mode: 'both',
      endCondition: EC_DEFAULT,
      range: 2,
    })
  })

  it('g3. ec と range の併存（/dict/2/ビジネス/quiz/i25/r3 → items25 + range3）', () => {
    expect(parseRoute('/dict/2/ビジネス/quiz/i25/r3')).toEqual({
      gameType: 'dict',
      level: 2,
      theme: 'ビジネス',
      mode: 'quiz',
      endCondition: ec('items', 25),
      range: 3,
    })
  })

  it('g4. 不正な range（r0・rx・r1.5）は range 無しへ丸める（他フィールドは従来どおり）', () => {
    expect(parseRoute('/dict/2/ビジネス/quiz/r0')).not.toHaveProperty('range')
    expect(parseRoute('/dict/2/ビジネス/quiz/rx')).not.toHaveProperty('range')
    expect(parseRoute('/sentences/1/日常/both/r1.5')).not.toHaveProperty('range')
    expect(parseRoute('/dict/2/ビジネス/quiz/r0')).toEqual({
      gameType: 'dict',
      level: 2,
      theme: 'ビジネス',
      mode: 'quiz',
      endCondition: EC_DEFAULT,
    })
  })

  it('g5. range 無しの dict/sentences ルートは range を持たない（非回帰）', () => {
    expect(parseRoute('/dict/2/ビジネス/quiz')).not.toHaveProperty('range')
    expect(parseRoute('/sentences/1/日常/both')).not.toHaveProperty('range')
  })

  it('g6. buildRoute（dict range → 末尾 r セグメント）', () => {
    expect(
      buildRoute({ gameType: 'dict', level: 2, theme: 'ビジネス', mode: 'quiz', endCondition: EC_DEFAULT, range: 3 }),
    ).toBe(`/dict/2/${encビジネス}/quiz/r3`)
  })

  it('g7. buildRoute（sentences range → slug sentences・末尾 r セグメント）', () => {
    expect(
      buildRoute({ gameType: 'wsent', level: 1, theme: '日常', mode: 'both', endCondition: EC_DEFAULT, range: 2 }),
    ).toBe(`/sentences/1/${enc日常}/both/r2`)
  })

  it('g8. ec 非既定＋range は ec セグメント→range セグメントの順', () => {
    expect(
      buildRoute({ gameType: 'dict', level: 2, theme: 'ビジネス', mode: 'quiz', endCondition: ec('items', 25), range: 3 }),
    ).toBe(`/dict/2/${encビジネス}/quiz/i25/r3`)
  })

  it('g9. range 無しは r セグメントを出さない（非回帰）', () => {
    expect(
      buildRoute({ gameType: 'dict', level: 2, theme: 'ビジネス', mode: 'quiz', endCondition: EC_DEFAULT }),
    ).toBe(`/dict/2/${encビジネス}/quiz`)
  })

  it('g10. words/dict/sentences × range 有無 × ec 有無で往復不変（parse∘build=id）', () => {
    const states = [
      // words（#362 非回帰）
      { gameType: 'words', level: 1, theme: '日常', mode: 'en', endCondition: EC_DEFAULT, range: 2 },
      { gameType: 'words', level: 4, theme: 'ビジネス', mode: 'quiz-ja', endCondition: ec('items', 25), range: 3 },
      // dict
      { gameType: 'dict', level: 2, theme: 'ビジネス', mode: 'quiz', endCondition: EC_DEFAULT, range: 3 },
      { gameType: 'dict', level: 3, theme: '旅行', mode: 'pick', endCondition: ec('items', 25), range: 1 },
      // sentences(wsent)
      { gameType: 'wsent', level: 1, theme: '日常', mode: 'both', endCondition: EC_DEFAULT, range: 2 },
      { gameType: 'wsent', level: 2, theme: 'すべて', mode: 'en', endCondition: ec('chars', 600), range: 4 },
      // range 無し（従来形）も壊れない
      { gameType: 'dict', level: 2, theme: 'ビジネス', mode: 'quiz', endCondition: EC_DEFAULT },
      { gameType: 'wsent', level: 1, theme: '日常', mode: 'both', endCondition: ec('time', 30) },
    ]
    for (const s of states) {
      expect(parseRoute(buildRoute(s))).toEqual(s)
    }
  })

  it('g11. range を含む path の冪等（parse∘build∘parse が parse と一致）', () => {
    const paths = [
      '/dict/2/ビジネス/quiz/r3',
      '/dict/2/ビジネス/quiz/i25/r3',
      '/sentences/1/日常/both/r2',
      '/dict/2/ビジネス/quiz/r0', // 不正 range → 丸め後で安定
      '/dict/2/ビジネス/quiz', // range 無し
    ]
    for (const p of paths) {
      const once = parseRoute(p)
      expect(parseRoute(buildRoute(once))).toEqual(once)
    }
  })

  it('g12. story/touch/romaji は range 非対応（付いても無視・range を持たない）', () => {
    expect(parseRoute('/story/travel/r2')).not.toHaveProperty('range')
    expect(parseRoute('/touch/home/easy/r2')).not.toHaveProperty('range')
    expect(parseRoute('/romaji/ka/r2')).not.toHaveProperty('range')
    // range プロパティを与えても range 非対応ページは URL に出さない
    expect(
      buildRoute({ gameType: 'story', storyId: 'travel', endCondition: EC_DEFAULT, range: 2 }),
    ).not.toContain('r2')
  })
})
