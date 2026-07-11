// 既存の DomainService（domain の .service.js の純関数）を共通契約（assertDomainService）に載せる
// メタテスト。#330（#322 契約テストシリーズ第5弾）。
// DomainService は状態を持たない横断ロジック＝「決定性・非破壊・外部乱数非依存」の3メタ性質を満たす。
// 各 fn の具体計算は当該 service の *.test.js が担い、ここでは正解値を再エンコードしない（同義反復回避）。
// 本ファイルは純粋（jsdom/sqlite 不要＝既定の node 環境）。fixture はテスト内インラインの最小データで、
// 教材 *Data.js には依存しない。#323 VO・#324 Entity・#325 Aggregate・#329 Repository 契約と対になる。
// ファイル名は .test.js ＝命名メタテスト（.service.js サフィックス強制）の対象外。
import { describe, it, expect } from 'vitest'
import { assertDomainService } from '../test/contracts/domainService.js'
import { mulberry32 } from './rng.service.js'

// またぐ対象（rng 注入で決定化するもの／純関数）。
import { sessionToRecord } from './records/sessionResult.service.js'
import { startTypingSession } from './session/typingSession.entity.js'
import { makeEndCondition } from './session/endCondition.vo.js'
import {
  buildUnits,
  scramble,
  enWords,
  jaPunct,
  typingLang,
  choiceSeg,
  segMatches,
} from './typing/units.service.js'
import {
  buildWordSet,
  buildWordPassage,
  makeQuiz,
  levelWords,
} from './words/wordset.service.js'
import {
  buildDictSet,
  makeDictQuiz,
  makeDictPick,
  levelEntries,
} from './dictionary/dictset.service.js'
import { buildPassage } from './marathon/passage.service.js'
import { buildKanaDrill } from './romaji/drill.service.js'
import { buildDrill } from './touch/drill.service.js'
import {
  endConditionTag,
  compareRecords,
  recKey,
  rankInsert,
} from './records/ranking.service.js'
import {
  wordRecKey,
  dictRecKey,
  storyRecKey,
  itemId,
} from './records/recordKeys.service.js'
import { storyFlowProgress } from './story/flowProgress.service.js'
import { lookahead, firstChoiceNodeId } from './story/navigation.service.js'
import { acceptsRomaji, isKanaComplete } from './romaji/input.service.js'
import { decidePermissionAction } from './persist/permission.service.js'
import { toRomaji, kanaConsumed } from './romaji/romaji.service.js'
import { alignJaToKana } from './typing/progress.service.js'

const SEED = 7

// 単語の最小 fixture（level/theme/kana を持つ。en は互いに前方一致しない＝makeQuiz の衝突回避を満たす）。
const words = () => [
  { en: 'apple', ja: 'りんご', kana: 'りんご', word: 'apple', level: 1, theme: '日常' },
  { en: 'table', ja: 'テーブル', kana: 'てーぶる', word: 'table', level: 1, theme: '日常' },
  { en: 'chair', ja: 'いす', kana: 'いす', word: 'chair', level: 1, theme: '日常' },
  { en: 'house', ja: 'いえ', kana: 'いえ', word: 'house', level: 1, theme: '旅行' },
  { en: 'water', ja: 'みず', kana: 'みず', word: 'water', level: 1, theme: '旅行' },
  { en: 'music', ja: 'おんがく', kana: 'おんがく', word: 'music', level: 1, theme: '日常' },
  { en: 'plant', ja: 'しょくぶつ', kana: 'しょくぶつ', word: 'plant', level: 1, theme: '日常' },
]

// 英英の最小 fixture（word/def が互いに前方一致しない＝makeDictQuiz/Pick の衝突回避を満たす）。
const dict = () => [
  { word: 'apple', def: 'a round red fruit', ja: 'りんご', kana: 'あっぷる', level: 1, theme: '日常' },
  { word: 'table', def: 'furniture with a flat top', ja: 'テーブル', kana: 'てーぶる', level: 1, theme: '日常' },
  { word: 'chair', def: 'you sit on it', ja: 'いす', kana: 'ちぇあ', level: 1, theme: '日常' },
  { word: 'house', def: 'people live in it', ja: 'いえ', kana: 'はうす', level: 1, theme: '旅行' },
  { word: 'water', def: 'clear liquid you drink', ja: 'みず', kana: 'うぉーたー', level: 1, theme: '旅行' },
  { word: 'music', def: 'sound with rhythm', ja: 'おんがく', kana: 'みゅーじっく', level: 1, theme: '日常' },
]

// 例文 item（tr モードで scramble を通す・kana/jaWords を持つ）。
const sentence = () => ({
  en: 'The clouds are above the mountain.',
  ja: '雲は山の上にあります。',
  kana: 'くもはやまのうえにあります。',
  word: 'above',
  jaWords: ['雲', 'は', '山', 'の', '上', 'に', 'あり', 'ます'],
})

// 記録レコードの最小 fixture（time60 ランキング＝keys 降順で並ぶ）。
const rec = (keys, mistakes = 0) => ({ keys, mistakes, date: '2026-01-01' })

// ───────────────────────────────────────────────────────────
// rng 注入で決定化するもの（出力はプレーンなオブジェクト/配列）
// ───────────────────────────────────────────────────────────

describe('DomainService契約: sessionResult.sessionToRecord', () => {
  // 数回打鍵した Session Entity（クロージャ状態）を毎回新しく作る。
  const played = () => {
    const s = startTypingSession({ id: 's1', endCondition: makeEndCondition('time', 60) })
    for (let i = 0; i < 12; i++) s.registerHit()
    for (let i = 0; i < 3; i++) s.registerMiss()
    s.setElapsed(30000)
    return s
  }
  assertDomainService({
    fn: sessionToRecord,
    sampleInput: () => [played(), { mode: 'ja' }],
    // Entity のクロージャ状態は JSON では見えない＝progress/status を観測する専用 snapshot。
    // finish を呼ばず（status='active' のまま）進捗も書き換えないことを見る。
    snapshot: ([s]) => ({ p: s.progress(), st: s.status() }),
  })
})

// buildUnits は mode ごとに rng の使い方が違う（tr モードのみ scramble を通る）＝mode 別に検証。
for (const mode of ['ja', 'both', 'en', 'en-tr', 'ja-tr']) {
  describe(`DomainService契約: units.buildUnits(${mode})`, () =>
    assertDomainService({
      fn: buildUnits,
      sampleInput: () => [sentence(), mode, { rng: mulberry32(SEED) }],
    }))
}

describe('DomainService契約: units.scramble', () =>
  assertDomainService({
    // rng は第2引数に直接渡す（{rng} ではない）。入力 arr を破壊しないことも見る。
    fn: scramble,
    sampleInput: () => [[1, 2, 3, 4, 5], mulberry32(SEED)],
  }))

describe('DomainService契約: wordset.buildWordSet', () =>
  assertDomainService({
    fn: buildWordSet,
    sampleInput: () => [words(), 1, 'すべて', 10, { rng: mulberry32(SEED) }],
  }))

describe('DomainService契約: wordset.buildWordPassage', () =>
  assertDomainService({
    // mode='both' は scramble を通らない（内部の buildUnits に rng が伝わらないため）＝Math.random 非依存。
    fn: buildWordPassage,
    sampleInput: () => [words(), 1, 'すべて', 'both', { rng: mulberry32(SEED), target: 60 }],
  }))

describe('DomainService契約: wordset.makeQuiz', () =>
  assertDomainService({
    // 出題2語・誤答候補は fixture 全語（en が互いに衝突しない＝4択が埋まる）。
    fn: makeQuiz,
    sampleInput: () => [words().slice(0, 2), words(), 'en', 4, { rng: mulberry32(SEED) }],
  }))

describe('DomainService契約: dictset.buildDictSet', () =>
  assertDomainService({
    fn: buildDictSet,
    sampleInput: () => [dict(), 1, 'すべて', 8, { rng: mulberry32(SEED) }],
  }))

describe('DomainService契約: dictset.makeDictQuiz', () =>
  assertDomainService({
    fn: makeDictQuiz,
    sampleInput: () => [dict(), dict(), 6, 4, { rng: mulberry32(SEED) }],
  }))

describe('DomainService契約: dictset.makeDictPick', () =>
  assertDomainService({
    fn: makeDictPick,
    sampleInput: () => [dict(), dict(), 6, 4, { rng: mulberry32(SEED) }],
  }))

describe('DomainService契約: passage.buildPassage', () =>
  assertDomainService({
    fn: buildPassage,
    sampleInput: () => ['both', [sentence()], { rng: mulberry32(SEED), target: 60 }],
  }))

describe('DomainService契約: drill.buildKanaDrill', () =>
  assertDomainService({
    fn: buildKanaDrill,
    sampleInput: () => [['か', 'き', 'く', 'け', 'こ'], 8, { rng: mulberry32(SEED) }],
  }))

describe('DomainService契約: drill.buildDrill', () =>
  assertDomainService({
    fn: buildDrill,
    sampleInput: () => [['a', 's', 'd', 'f', 'j'], 8, { rng: mulberry32(SEED) }],
  }))

// ───────────────────────────────────────────────────────────
// rng 無し・純関数（決定性・非破壊のみ＝並び/上限の意味は #325/#329 の責務）
// ───────────────────────────────────────────────────────────

describe('DomainService契約: ranking.endConditionTag', () =>
  assertDomainService({
    fn: endConditionTag,
    sampleInput: () => [makeEndCondition('chars', 600)],
  }))

describe('DomainService契約: ranking.compareRecords', () =>
  assertDomainService({
    // 入力 record a/b を書き換えないことを見る（並び順の正しさは ranking.test.js の責務）。
    fn: compareRecords,
    sampleInput: () => [makeEndCondition('time', 60), rec(100, 1), rec(80, 0)],
  }))

describe('DomainService契約: ranking.recKey', () =>
  assertDomainService({
    fn: recKey,
    sampleInput: () => ['both', 1, 'sentence', '日常', makeEndCondition('time', 30)],
  }))

describe('DomainService契約: ranking.rankInsert', () =>
  assertDomainService({
    // 入力 list を破壊しないことを見る（整列・上限の意味は再検証しない）。
    fn: rankInsert,
    sampleInput: () => [[rec(50), rec(70)], rec(60), makeEndCondition('time', 60), 15],
  }))

describe('DomainService契約: recordKeys.wordRecKey', () =>
  assertDomainService({
    fn: wordRecKey,
    sampleInput: () => [3, '日常', 'both', makeEndCondition('time', 60)],
  }))

describe('DomainService契約: recordKeys.dictRecKey', () =>
  assertDomainService({
    fn: dictRecKey,
    sampleInput: () => [3, '日常', 'both', makeEndCondition('chars', 600)],
  }))

describe('DomainService契約: recordKeys.storyRecKey', () =>
  assertDomainService({
    fn: storyRecKey,
    sampleInput: () => ['demo', makeEndCondition('time', 60)],
  }))

describe('DomainService契約: recordKeys.itemId', () =>
  assertDomainService({
    fn: itemId,
    sampleInput: () => ['w', 'en', 'reserve'],
  }))

describe('DomainService契約: units.enWords', () =>
  assertDomainService({
    fn: enWords,
    sampleInput: () => ['I am here for sightseeing.'],
  }))

describe('DomainService契約: units.jaPunct', () =>
  assertDomainService({
    fn: jaPunct,
    sampleInput: () => ['観光で来ました。'],
  }))

describe('DomainService契約: units.typingLang', () =>
  assertDomainService({
    fn: typingLang,
    sampleInput: () => ['ja-tr'],
  }))

describe('DomainService契約: units.choiceSeg', () =>
  assertDomainService({
    fn: choiceSeg,
    sampleInput: () => [{ en: 'apple', ja: 'りんご', kana: 'りんご', word: 'apple' }, 'ja'],
  }))

describe('DomainService契約: units.segMatches', () =>
  assertDomainService({
    fn: segMatches,
    sampleInput: () => [{ variants: ['reserve', 'reserv'] }, 're'],
  }))

describe('DomainService契約: wordset.levelWords', () =>
  assertDomainService({
    fn: levelWords,
    sampleInput: () => [words(), 1],
  }))

describe('DomainService契約: dictset.levelEntries', () =>
  assertDomainService({
    fn: levelEntries,
    sampleInput: () => [dict(), 1],
  }))

describe('DomainService契約: flowProgress.storyFlowProgress', () =>
  assertDomainService({
    fn: storyFlowProgress,
    sampleInput: () => [
      { en: 'I am here for sightseeing.', ja: '観光で来ました。', kana: 'かんこうできました。' },
      { stage: 'text', mode: 'both', activeType: 'ja', input: 'kankou' },
    ],
  }))

describe('DomainService契約: navigation.lookahead', () =>
  assertDomainService({
    // node/nodes を破壊しないことを見る。
    fn: lookahead,
    sampleInput: () => {
      const nodes = {
        a: { next: 'b', text: 'A' },
        b: { next: 'c', text: 'B' },
        c: { text: 'C' },
      }
      return [nodes.a, nodes, 4]
    },
  }))

describe('DomainService契約: navigation.firstChoiceNodeId', () =>
  assertDomainService({
    fn: firstChoiceNodeId,
    sampleInput: () => [
      { intro: { next: 'q1', text: '導入' }, q1: { choices: [{ label: 'はい' }], text: '分岐' } },
    ],
  }))

describe('DomainService契約: input.acceptsRomaji', () =>
  assertDomainService({
    fn: acceptsRomaji,
    sampleInput: () => ['きゃ', 'ky'],
  }))

describe('DomainService契約: input.isKanaComplete', () =>
  assertDomainService({
    fn: isKanaComplete,
    sampleInput: () => ['きゃ', 'kya'],
  }))

describe('DomainService契約: permission.decidePermissionAction', () =>
  assertDomainService({
    fn: decidePermissionAction,
    sampleInput: () => ['granted'],
  }))

// ───────────────────────────────────────────────────────────
// @tll/core 再エクスポート（代表のみ・薄く＝全 export は上流被覆に委ねる）
// ───────────────────────────────────────────────────────────

describe('DomainService契約: romaji.toRomaji', () =>
  assertDomainService({
    fn: toRomaji,
    sampleInput: () => ['きゃ'],
  }))

describe('DomainService契約: romaji.kanaConsumed', () =>
  assertDomainService({
    fn: kanaConsumed,
    sampleInput: () => ['きゃく', 'kya'],
  }))

describe('DomainService契約: progress.alignJaToKana', () =>
  assertDomainService({
    fn: alignJaToKana,
    sampleInput: () => ['観光', 'かんこう'],
  }))

// ───────────────────────────────────────────────────────────
// mulberry32 は別扱い（出力が「関数」＝assertDomainService の対象外）。
// 他 service が「毎回新規生成」を要する根拠＝決定的ジェネレータの性質を直接固定する。
// ───────────────────────────────────────────────────────────
describe('rng.service.mulberry32（決定的ジェネレータ）', () => {
  const firstN = (gen, n) => Array.from({ length: n }, () => gen())

  it('同じ seed の2ジェネレータは先頭 N 個の数列が一致する', () => {
    expect(firstN(mulberry32(42), 5)).toEqual(firstN(mulberry32(42), 5))
  })

  it('別 seed では数列が異なる', () => {
    expect(firstN(mulberry32(1), 5)).not.toEqual(firstN(mulberry32(2), 5))
  })

  it('返り値は [0,1) の数', () => {
    const gen = mulberry32(123)
    for (let i = 0; i < 100; i++) {
      const v = gen()
      expect(typeof v).toBe('number')
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('同一インスタンスの連続呼び出しは状態が進む（＝describe スコープで使い回すと決定性が崩れる根拠）', () => {
    const gen = mulberry32(7)
    const a = gen()
    const b = gen()
    expect(a).not.toBe(b)
  })
})
