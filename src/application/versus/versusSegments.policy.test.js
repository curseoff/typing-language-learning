// @vitest-environment jsdom
// #439 道Y PR-B（Red）：受信側で「相手の問題列（初回バッチ）」を決定的に再構成する
//   buildMirrorSegments({ gameType, config, seed, content }) → TopSeg[] の入出力契約テスト。
//
// 本体 src/application/versus/versusSegments.policy.js は coder が Green で作る
//   （現状未実装＝import で落ちる Red）。DRY 抽出（フックと共有 helper 化）は coder が Green で行うので、
//   ここでは buildMirrorSegments の「入出力・決定性・端ケース」に集中する。
//
// 同一式の担保（drift 検知）＝各プレイフック（useDict/useWords/useMarathon）を実レンダーし、その
//   初回バッチ segments（＝相手が実際に解く問題列）と buildMirrorSegments の出力が要素同値であることを
//   突き合わせる。versus は全モード learningMode:'cloze' 固定（VersusMatch.container）なので cloze で縛る。
//
// 仮定（司令塔へ申告済み想定）：
//   - range は content.clamped を正とする（container が clamp 済みの値を各フックの range に渡すため）。
//     テストでは config.range と content.clamped を一致させ、どちらを読んでも同値にする。
//   - content の形は useVersusContent（container）の出力に合わせる：
//       dict  … { dict, gloss, wordRuby, freqMap, clamped }
//       words … { words, clamped }
//       wsent … { gloss, pool, clamped }
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { buildMirrorSegments } from './versusSegments.policy.js'
import { useDict } from '../useDict.js'
import { useWords } from '../useWords.js'
import { useMarathon } from '../useMarathon.js'
import { initMemoryPersistence } from '../records.service.js'
import { makeEndCondition } from '../../domain/session/endCondition.vo.js'
import { makeMatchConfig } from '../../domain/versus/matchConfig.vo.js'

const EC = makeEndCondition('time', 60)

// --- 固定の小さな content フィクスチャ（決定的・cloze も動く最小構成） ---
// dict：word/def/ja/kana/level/theme（jaWords は無くても cloze の en マスクは def 語から作れる）。
const DICT_FX = [
  { word: 'apple', def: 'a round sweet fruit', ja: '甘い果物のりんご', kana: 'あまいくだもののりんご', level: 1, theme: '日常' },
  { word: 'river', def: 'a large stream of water', ja: '大きな水の流れの川', kana: 'おおきなみずのながれのかわ', level: 1, theme: '旅行' },
  { word: 'office', def: 'a place where people work', ja: '人が働く場所の事務所', kana: 'ひとがはたらくばしょのじむしょ', level: 1, theme: 'ビジネス' },
]
// words：en/ja/kana/level/theme/freq（range スライスは freq 主キー）。
const WORDS_FX = [
  { en: 'apple', ja: 'りんご', kana: 'りんご', level: 1, theme: '日常', freq: 100 },
  { en: 'river', ja: 'かわ', kana: 'かわ', level: 1, theme: '旅行', freq: 200 },
  { en: 'work', ja: 'しごと', kana: 'しごと', level: 1, theme: 'ビジネス', freq: 300 },
]
// wsent：例文プール（en/ja/kana/word/jaWords）。start へ直接渡す形。
const WSENT_FX = [
  { en: 'I go to school', ja: '私は学校へ行く', kana: 'わたしはがっこうへいく', word: 'go', jaWords: ['私は', '学校へ', '行く'] },
  { en: 'the river is wide', ja: 'その川は広い', kana: 'そのかわはひろい', word: 'river', jaWords: ['その川は', '広い'] },
  { en: 'we work together', ja: '私たちは一緒に働く', kana: 'わたしたちはいっしょにはたらく', word: 'work', jaWords: ['私たちは', '一緒に', '働く'] },
]

// --- 実プレイフックの初回 segments（＝相手が解く問題列）を読む helper ---
// autoStart:false（segments には無関係＝startTime のみ）・打鍵なし＝初回バッチをそのまま読む。
function dictHookSegments({ dict, level, theme, mode, seed, range, freqMap }) {
  const h = renderHook(() =>
    useDict({ dict, level, theme, mode, seed, endCondition: EC, range, freqMap, learningMode: 'cloze', onExit: () => {}, autoStart: false }),
  )
  const segs = h.result.current.segments
  h.unmount()
  return segs
}
function wordsHookSegments({ words, level, theme, mode, seed, range }) {
  const h = renderHook(() =>
    useWords({ allWords: words, level, theme, mode, seed, endCondition: EC, range, learningMode: 'cloze', onExit: () => {}, autoStart: false }),
  )
  const segs = h.result.current.segments
  h.unmount()
  return segs
}
function wsentHookSegments({ pool, level, theme, mode, seed, range }) {
  const h = renderHook(() => useMarathon({ active: true, onFinish: () => {}, endCondition: EC, learningMode: 'cloze', autoStart: false }))
  act(() => h.result.current.start(mode, level, 'wsent', pool, seed, theme, range))
  const segs = h.result.current.segments
  h.unmount()
  return segs
}

// makeMatchConfig で正規化・凍結された config を作る（container が渡す実物に合わせる）。
function cfg({ gameType, level = 1, theme = 'すべて', range = null, mode }) {
  return makeMatchConfig({ gameType, level, theme, range, mode, endCondition: EC, learningMode: 'cloze' })
}

beforeEach(() => {
  localStorage.clear()
  initMemoryPersistence()
  vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] })
})
afterEach(() => vi.useRealTimers())

describe('buildMirrorSegments: 決定性（同一入力→同一出力）', () => {
  it('dict：同一 {gameType,config,seed,content} で毎回同一の seg 列を返す', () => {
    const args = {
      gameType: 'dict',
      config: cfg({ gameType: 'dict', mode: 'en' }),
      seed: 12345,
      content: { dict: DICT_FX, gloss: {}, wordRuby: {}, freqMap: null, clamped: null },
    }
    const a = buildMirrorSegments(args)
    const b = buildMirrorSegments(args)
    expect(a.length).toBeGreaterThan(0)
    expect(b).toEqual(a) // 要素同値（decodeToProblems/shuffle まで含めて決定的）
  })

  it('dict：Math.random を差し替えても出力が変わらない（mulberry32 のみ・Math.random 不使用）', () => {
    const args = {
      gameType: 'dict',
      config: cfg({ gameType: 'dict', mode: 'en' }),
      seed: 777,
      content: { dict: DICT_FX, gloss: {}, wordRuby: {}, freqMap: null, clamped: null },
    }
    const before = buildMirrorSegments(args)
    const orig = Math.random
    Math.random = () => 0.123456789
    try {
      const after = buildMirrorSegments(args)
      expect(after).toEqual(before)
    } finally {
      Math.random = orig
    }
  })

  it('入力（config・content）を破壊しない（純粋・非破壊）', () => {
    const content = { dict: DICT_FX, gloss: {}, wordRuby: {}, freqMap: null, clamped: null }
    const config = cfg({ gameType: 'dict', mode: 'en' })
    const snapContent = structuredClone(content)
    const snapConfig = structuredClone(config)
    buildMirrorSegments({ gameType: 'dict', config, seed: 42, content })
    expect(content).toEqual(snapContent)
    expect(config).toEqual(snapConfig)
  })
})

describe('buildMirrorSegments: 各フックの初回バッチと同一式（drift 検知）', () => {
  it('dict(en)：useDict の初回 segments と要素同値', () => {
    const seed = 20240718
    const expected = dictHookSegments({ dict: DICT_FX, level: 1, theme: 'すべて', mode: 'en', seed, range: null, freqMap: null })
    const got = buildMirrorSegments({
      gameType: 'dict',
      config: cfg({ gameType: 'dict', mode: 'en' }),
      seed,
      content: { dict: DICT_FX, gloss: {}, wordRuby: {}, freqMap: null, clamped: null },
    })
    expect(expected.length).toBeGreaterThan(0)
    expect(got).toEqual(expected)
  })

  it('words(both)：useWords の初回 segments と要素同値（cloze の clozeSideFor も一致）', () => {
    const seed = 5150
    const expected = wordsHookSegments({ words: WORDS_FX, level: 1, theme: 'すべて', mode: 'both', seed, range: null })
    const got = buildMirrorSegments({
      gameType: 'words',
      config: cfg({ gameType: 'words', mode: 'both' }),
      seed,
      content: { words: WORDS_FX, clamped: null },
    })
    expect(expected.length).toBeGreaterThan(0)
    expect(got).toEqual(expected)
  })

  it('wsent(both)：useMarathon.start の初回 segments と要素同値', () => {
    const seed = 31337
    const expected = wsentHookSegments({ pool: WSENT_FX, level: 1, theme: 'すべて', mode: 'both', seed, range: null })
    const got = buildMirrorSegments({
      gameType: 'wsent',
      config: cfg({ gameType: 'wsent', mode: 'both' }),
      seed,
      content: { gloss: {}, pool: WSENT_FX, clamped: null },
    })
    expect(expected.length).toBeGreaterThan(0)
    expect(got).toEqual(expected)
  })
})

describe('buildMirrorSegments: range（固定範囲の pool 絞り込みが効く）', () => {
  it('words(en) range=1：useWords（range=clamped=1）の初回 segments と要素同値', () => {
    const seed = 909
    // range=1：freq 主キーで [0,100) スライス＝freq 昇順の決定的順（shuffle しない）。
    const expected = wordsHookSegments({ words: WORDS_FX, level: 1, theme: 'すべて', mode: 'en', seed, range: 1 })
    const got = buildMirrorSegments({
      gameType: 'words',
      config: cfg({ gameType: 'words', mode: 'en', range: 1 }),
      seed,
      content: { words: WORDS_FX, clamped: 1 },
    })
    expect(expected.length).toBeGreaterThan(0)
    expect(got).toEqual(expected)
    // range を無視して非 range（seed shuffle）を返す実装では上の toEqual が壊れる＝絞り込みの一致を縛る。
  })

  it('dict(en) range=1：useDict（range=clamped=1・freqMap 注入）の初回 segments と要素同値', () => {
    const seed = 4649
    // dict は freq を持たないので freqMap(word→freq) 経由で freq 順に並べる（useDict.dictRangePool と同式）。
    // freqMap は意図的に freq 昇順と違う挿入順で作る（Map の挿入順ではなく freq で並ぶことを縛る）。
    const freqMap = new Map([
      ['office', 30],
      ['apple', 10],
      ['river', 20],
    ])
    const expected = dictHookSegments({ dict: DICT_FX, level: 1, theme: 'すべて', mode: 'en', seed, range: 1, freqMap })
    const got = buildMirrorSegments({
      gameType: 'dict',
      config: cfg({ gameType: 'dict', mode: 'en', range: 1 }),
      seed,
      content: { dict: DICT_FX, gloss: {}, wordRuby: {}, freqMap, clamped: 1 },
    })
    expect(expected.length).toBeGreaterThan(0)
    expect(got).toEqual(expected)
    // range スライスは freq 昇順の pool 順で固定（ordered＝shuffle しない）＝apple(10)→river(20)→office(30)。
    expect(got.slice(0, 3).map((s) => s.canonical)).toEqual([
      'a round sweet fruit',
      'a large stream of water',
      'a place where people work',
    ])
  })

  it('dict：range が範囲外（該当スライス空）なら通常プールへフォールバックする', () => {
    const seed = 4649
    const freqMap = new Map([
      ['apple', 10],
      ['river', 20],
      ['office', 30],
    ])
    // range=9 は freq 800-899 のスライス＝該当なし。フォールバックで range 無しと同じ列になる。
    const ranged = buildMirrorSegments({
      gameType: 'dict',
      config: cfg({ gameType: 'dict', mode: 'en', range: 9 }),
      seed,
      content: { dict: DICT_FX, gloss: {}, wordRuby: {}, freqMap, clamped: 9 },
    })
    const plain = buildMirrorSegments({
      gameType: 'dict',
      config: cfg({ gameType: 'dict', mode: 'en' }),
      seed,
      content: { dict: DICT_FX, gloss: {}, wordRuby: {}, freqMap: null, clamped: null },
    })
    expect(ranged.length).toBeGreaterThan(0)
    expect(ranged).toEqual(plain)
  })
})

describe('buildMirrorSegments: 端ケース', () => {
  it('dict：pool 空（該当 level なし）→ []', () => {
    const got = buildMirrorSegments({
      gameType: 'dict',
      config: cfg({ gameType: 'dict', mode: 'en' }),
      seed: 1,
      content: { dict: [], gloss: {}, wordRuby: {}, freqMap: null, clamped: null },
    })
    expect(got).toEqual([])
  })

  it('words：pool 空 → []（buildWordPassage の空 pool クラッシュを手前でガード）', () => {
    const got = buildMirrorSegments({
      gameType: 'words',
      config: cfg({ gameType: 'words', mode: 'en' }),
      seed: 1,
      content: { words: [], clamped: null },
    })
    expect(got).toEqual([])
  })

  it('wsent：pool 空 → []', () => {
    const got = buildMirrorSegments({
      gameType: 'wsent',
      config: cfg({ gameType: 'wsent', mode: 'both' }),
      seed: 1,
      content: { gloss: {}, pool: [], clamped: null },
    })
    expect(got).toEqual([])
  })

  it('未対応 gameType → []（quiz など mirror 非対象）', () => {
    const got = buildMirrorSegments({
      gameType: 'quiz',
      config: { gameType: 'quiz', level: 1, theme: 'すべて', range: null, mode: 'en', endCondition: EC, learningMode: 'cloze' },
      seed: 1,
      content: { words: WORDS_FX, clamped: null },
    })
    expect(got).toEqual([])
  })
})
