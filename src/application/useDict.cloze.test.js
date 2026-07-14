// @vitest-environment jsdom
// #402 穴埋め学習モード（cloze）の英英入力（useDict）結合テスト。learningMode='cloze' で
// 5問ブロック交互（normal→cloze）＝後半ブロックの打鍵対象 seg に文中伏字レンジ（clozeRanges）が付き、
// cloze の問題でミスすると clozeRevealed が立ち、記録に learning='cloze' が載ることを確認する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDict } from './useDict.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.service.js'
import { DICT } from '../content/dictionaryAll.js'
import { loadDictRecords, dictRecKey, initMemoryPersistence } from './records.service.js'

beforeEach(() => {
  localStorage.clear()
  initMemoryPersistence()
  vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] })
})
afterEach(() => vi.useRealTimers())

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

const runOutClock = () => {
  act(() => vi.advanceTimersByTime(TIME_LIMIT_MS + 200))
  act(() => vi.runOnlyPendingTimers())
}

const completeSeg = (result) => {
  const seg = result.current.segments[result.current.segIndex]
  if (!seg) return
  for (const ch of seg.canonical) {
    typeKey(ch)
    act(() => vi.advanceTimersByTime(10))
  }
}

const SEED = 30402

// #404 dict×ja の cloze 結合用フィクスチャ。jaWords を持つダミー辞書（実データ非依存）で、
// 日本語モードの穴埋めが dict でも和文中 1〜3 語伏字になることを決定的に検証する。
// jaWords は連結すると item.ja に一致（末尾句読点なし）＝computeClozeMask が語境界を確実に取れる。
// 内容語（水/飲む/本/読む/良い/友達/会う/速く/走る/林檎/食べる/夜/眠る）は助詞でないため伏字候補になる。
const JA_DICT = [
  { word: 'water', def: 'a clear liquid people drink', ja: '水を飲む', kana: 'みずをのむ', level: 1, theme: '日常', jaWords: ['水', 'を', '飲む'] },
  { word: 'book', def: 'a set of printed pages', ja: '本を読む', kana: 'ほんをよむ', level: 1, theme: '日常', jaWords: ['本', 'を', '読む'] },
  { word: 'friend', def: 'a person you like well', ja: '良い友達に会う', kana: 'よいともだちにあう', level: 1, theme: '日常', jaWords: ['良い', '友達', 'に', '会う'] },
  { word: 'run', def: 'to move very fast', ja: '速く走る', kana: 'はやくはしる', level: 1, theme: '日常', jaWords: ['速く', '走る'] },
  { word: 'apple', def: 'a round red fruit', ja: '林檎を食べる', kana: 'りんごをたべる', level: 1, theme: '日常', jaWords: ['林檎', 'を', '食べる'] },
  { word: 'sleep', def: 'to rest at night', ja: '夜に眠る', kana: 'よるにねむる', level: 1, theme: '日常', jaWords: ['夜', 'に', '眠る'] },
]

describe('useDict cloze（#402 穴埋め・結合）', () => {
  it('先頭5問ブロックは伏字なし・後半ブロックの打鍵対象 seg に clozeRanges が付く', () => {
    const { result } = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'en', seed: SEED, learningMode: 'cloze', onExit: () => {} }),
    )
    const segs = result.current.segments
    expect(segs.filter((s) => s.sentenceIndex < 5).every((s) => !s.clozeRanges)).toBe(true)
    expect(segs.some((s) => s.sentenceIndex >= 5 && Array.isArray(s.clozeRanges) && s.clozeRanges.length > 0)).toBe(true)
  })

  it('cloze の問題でミスすると clozeRevealed が立ち、その seg を打ち切ると戻る', () => {
    const { result } = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'en', seed: SEED, learningMode: 'cloze', onExit: () => {} }),
    )
    expect(result.current.clozeRevealed).toBe(false)
    typeKey('1') // 不正キーでミス
    expect(result.current.clozeRevealed).toBe(true)
    completeSeg(result)
    expect(result.current.clozeRevealed).toBe(false)
  }, 20000)

  it('60秒 finish で record.learning に cloze が載る', () => {
    const { result } = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'en', seed: SEED, endCondition: { kind: 'time', value: 60 }, learningMode: 'cloze', onExit: () => {} }),
    )
    for (let i = 0; i < 40; i++) completeSeg(result)
    runOutClock()
    expect(result.current.finished).toBe(true)
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'en', { kind: 'time', value: 60 })][0]
    expect(rec.learning).toBe('cloze')
  }, 20000)

  it('learningMode 未指定（normal）は clozeRanges を付けず clozeRevealed も立たない', () => {
    const { result } = renderHook(() =>
      useDict({ dict: DICT, level: 1, theme: 'すべて', mode: 'en', seed: SEED, onExit: () => {} }),
    )
    expect(result.current.segments.every((s) => !s.clozeRanges)).toBe(true)
    typeKey('1')
    expect(result.current.clozeRevealed).toBe(false)
  })
})

// #404 dict×ja：日本語モード（読みを打つ）でも穴埋めが dict に配線されていること。
// toDictSeg が jaWords を渡す → buildPassage の cloze フェーズで ja seg（type='ja'）に和文の
// char レンジ（clozeRanges）が付く。照合（打鍵）は読みのまま＝伏字は表示メタのみ。
describe('useDict cloze × ja（#404 日本語モードの dict 穴埋め・結合）', () => {
  it('先頭5問ブロックは伏字なし・後半ブロックの ja seg に jaWords 由来の clozeRanges が付く', () => {
    const { result } = renderHook(() =>
      useDict({ dict: JA_DICT, level: 1, theme: 'すべて', mode: 'ja', seed: SEED, learningMode: 'cloze', onExit: () => {} }),
    )
    const segs = result.current.segments
    // ja モードなので打鍵対象 seg は全て type='ja'。
    expect(segs.every((s) => s.type === 'ja')).toBe(true)
    // 前半ブロック（normal・sentenceIndex<5）は伏字なし。
    expect(segs.filter((s) => s.sentenceIndex < 5).every((s) => !s.clozeRanges)).toBe(true)
    // 後半ブロック（cloze・sentenceIndex>=5）に 1〜3 個の char レンジが付く。
    const cloze = segs.filter((s) => s.sentenceIndex >= 5 && Array.isArray(s.clozeRanges) && s.clozeRanges.length > 0)
    expect(cloze.length).toBeGreaterThan(0)
    for (const s of cloze) {
      expect(s.clozeRanges.length).toBeGreaterThanOrEqual(1)
      expect(s.clozeRanges.length).toBeLessThanOrEqual(3)
      // 各レンジは和文（ja）の語境界＝助詞（を/に）や句読点を覆わず、jaWords のいずれかの語ちょうど。
      const words = new Set(JA_DICT.find((d) => d.ja === s.ja).jaWords)
      for (const r of s.clozeRanges) {
        expect(r.end).toBeGreaterThan(r.start)
        expect(r.end).toBeLessThanOrEqual(s.ja.length)
        expect(words.has(s.ja.slice(r.start, r.end))).toBe(true)
      }
    }
  })

  it('決定的：同じ seed なら ja seg の clozeRanges は同一（再現可能）', () => {
    const rangesFor = () => {
      const { result } = renderHook(() =>
        useDict({ dict: JA_DICT, level: 1, theme: 'すべて', mode: 'ja', seed: SEED, learningMode: 'cloze', onExit: () => {} }),
      )
      return result.current.segments
        .filter((s) => s.sentenceIndex < 12)
        .map((s) => s.clozeRanges ?? null)
    }
    expect(rangesFor()).toEqual(rangesFor())
  })

  it('cloze の問題でミスすると clozeRevealed が立ち、その ja seg を打ち切ると戻る', () => {
    const { result } = renderHook(() =>
      useDict({ dict: JA_DICT, level: 1, theme: 'すべて', mode: 'ja', seed: SEED, learningMode: 'cloze', onExit: () => {} }),
    )
    expect(result.current.clozeRevealed).toBe(false)
    typeKey('1') // 読みに無いキーでミス
    expect(result.current.clozeRevealed).toBe(true)
    completeSeg(result)
    expect(result.current.clozeRevealed).toBe(false)
  }, 20000)

  it('60秒 finish で record.learning に cloze が載る（ja・dict 記録キー）', () => {
    const { result } = renderHook(() =>
      useDict({ dict: JA_DICT, level: 1, theme: 'すべて', mode: 'ja', seed: SEED, endCondition: { kind: 'time', value: 60 }, learningMode: 'cloze', onExit: () => {} }),
    )
    for (let i = 0; i < 40; i++) completeSeg(result)
    runOutClock()
    expect(result.current.finished).toBe(true)
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'ja', { kind: 'time', value: 60 })][0]
    expect(rec.learning).toBe('cloze')
  }, 20000)

  it('learningMode 未指定（normal・ja）は clozeRanges を付けず clozeRevealed も立たない（後方互換）', () => {
    const { result } = renderHook(() =>
      useDict({ dict: JA_DICT, level: 1, theme: 'すべて', mode: 'ja', seed: SEED, onExit: () => {} }),
    )
    expect(result.current.segments.every((s) => !s.clozeRanges)).toBe(true)
    typeKey('1')
    expect(result.current.clozeRevealed).toBe(false)
  })
})
