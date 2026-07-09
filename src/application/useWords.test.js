// @vitest-environment jsdom
// 単語入力モードの結合テスト。canonical を打鍵してから60秒経過をシミュレートして finish させ、
// record と問題ごとの記録(segStats=各語の速度/ミス) を確認する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWords } from './useWords.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.js'
import { WORDS } from '../content/wordsAll.js'
import { END_TIME_VALUES } from '../content/endConditions.js'
import { loadWordRecords, wordRecKey, initMemoryPersistence } from './records.js'

beforeEach(() => {
  localStorage.clear()
  initMemoryPersistence() // 記録メモリ像を空にリセット（sqlite専用化で facade は localStorage を読まない）
  vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] })
})
afterEach(() => vi.useRealTimers())

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

// 最初の打鍵から60秒経過させて finish を発火させる。
const runOutClock = () => {
  act(() => vi.advanceTimersByTime(TIME_LIMIT_MS + 200))
  act(() => vi.runOnlyPendingTimers())
}

// n 文字ぶん canonical を打つ（時間制なので完走はしない）。
// 各打鍵の間に少し時間を進め、語ごとの speed が 0 にならないようにする。
const typeSome = (result, n) => {
  for (let i = 0; i < n; i++) {
    const seg = result.current.segments[result.current.segIndex]
    if (!seg) break
    typeKey(seg.canonical[result.current.segInput.length])
    act(() => vi.advanceTimersByTime(10))
  }
}

describe('useWords（単語入力・結合）', () => {
  it('英語モードで打鍵後、60秒で finish し record と segStats を保存する', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    typeSome(result, 60)
    runOutClock()
    expect(result.current.finished).toBe(true)
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'en')][0]
    expect(rec.keys).toBeGreaterThan(0)
    expect(rec.mistakes).toBe(0) // 正打のみ
    expect(rec.accuracy).toBe(100)
    expect(rec.speed).toBeGreaterThan(0)
    expect(rec.seconds).toBeCloseTo(60, 0)
    expect(rec.segStats.length).toBeGreaterThan(0)
    expect(rec.segStats[0]).toMatchObject({ type: 'en' })
    expect(rec.segStats[0].speed).toBeGreaterThan(0)
  }, 20000)

  it('通常プレイ（seed 未指定）でも record に有効な seed が入る＝記録から再挑戦できる', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    typeSome(result, 30)
    runOutClock()
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'en')][0]
    expect(rec.seed).toEqual(expect.any(Number)) // null ではなく有効な seed
    expect(rec.source).toBe('word')
  }, 20000)

  it('restart は新しい seed を切り直して別の問題列にする（record の seed が変わる）', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    typeSome(result, 30)
    runOutClock()
    const first = loadWordRecords()[wordRecKey(1, 'すべて', 'en')][0].seed
    act(() => result.current.restart())
    typeSome(result, 30)
    runOutClock()
    const seeds = loadWordRecords()[wordRecKey(1, 'すべて', 'en')].map((r) => r.seed)
    expect(seeds).toContain(first)
    // 2件の seed が別物（=別の問題列）であること
    expect(new Set(seeds).size).toBe(2)
  }, 20000)

  it('間違ったキーはミスとして数えられる', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', onExit: () => {} }),
    )
    // 現在語の正しい次の文字でないキー（数字）を打つ→ミス
    const before = result.current.mistakes
    typeKey('1')
    expect(result.current.mistakes).toBe(before + 1)
    expect(result.current.hasError).toBe(true)
  })

  // #208 段2: 文字数制（chars）は「時間」ではなく「打鍵数」で終了する。
  it('文字数制 chars=N は時間切れ(60秒)を待たず、N 文字打鍵した時点で finished になる', () => {
    const N = 5
    const endCondition = { kind: 'chars', value: N }
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', endCondition, onExit: () => {} }),
    )
    // N-1 文字ではまだ終わらない（時間では無く打鍵数で終わる境界）。
    typeSome(result, N - 1)
    expect(result.current.finished).toBe(false)
    // N 文字目で終了する（60秒アドバンスはしない＝時間では終わっていない）。
    typeSome(result, 1)
    expect(result.current.finished).toBe(true)
    // 記録は chars 用キーに保存され、所要時間(seconds)が成績として入る。
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'en', endCondition)][0]
    expect(rec.endCondition.kind).toBe('chars')
    expect(rec.keys).toBe(N)
    expect(rec.seconds).toEqual(expect.any(Number))
  }, 20000)

  it('文字数制では 60秒経過しても打鍵数に達しなければ終了しない（時間では終わらない）', () => {
    const endCondition = { kind: 'chars', value: 100 }
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', endCondition, onExit: () => {} }),
    )
    // 数文字だけ打って開始（100 文字には届かない）。
    typeSome(result, 5)
    // 60秒経過させても、chars=100 に達していないので終了してはいけない。
    runOutClock()
    expect(result.current.finished).toBe(false)
  }, 20000)

  it('同じ seed なら同じ単語列を再現し、record に seed が入る（リプレイ）', () => {
    const seed = 987654
    const opts = { allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', seed, onExit: () => {} }
    const a = renderHook(() => useWords(opts))
    const b = renderHook(() => useWords(opts))
    const labelsA = a.result.current.segments.map((s) => s.canonical)
    const labelsB = b.result.current.segments.map((s) => s.canonical)
    expect(labelsA).toEqual(labelsB)
    expect(labelsA.length).toBeGreaterThan(0)

    // 打鍵→60秒で record.seed が記録されることを確認
    const { result } = renderHook(() => useWords(opts))
    typeSome(result, 30)
    runOutClock()
    const rec = loadWordRecords()[wordRecKey(1, 'すべて', 'en')][0]
    expect(rec.seed).toBe(seed)
    expect(rec.source).toBe('word')
  }, 20000)
})

// #208 段6：エンドレスは ESC で終了。30秒(=END_TIME_VALUES[0])以上プレイした時だけ記録する。
const ENDLESS = { kind: 'endless', value: null }
const MIN_RECORD_MS = END_TIME_VALUES[0] * 1000 // 記録に必要な最低プレイ時間（30秒）

// 現在セグの正しい次の1文字を打つ（時間は進めない＝経過を境界で正確に制御するため）。
const typeCorrect = (result) => {
  const seg = result.current.segments[result.current.segIndex]
  typeKey(seg.canonical[result.current.segInput.length])
}
const pressEscape = () => typeKey('Escape')

describe('useWords エンドレス（#208 段6：ESC・30秒以上で記録）', () => {
  it('数文字だけ打って(経過<30秒) ESC したら記録せず onExit（中断＝TOPへ）', () => {
    const onExit = vi.fn()
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', endCondition: ENDLESS, onExit }),
    )
    typeCorrect(result) // startTime を確定（経過 0）
    act(() => vi.advanceTimersByTime(MIN_RECORD_MS - 100)) // 29.9秒＝閾値未満
    pressEscape()
    expect(onExit).toHaveBeenCalledTimes(1) // 中断＝onExit
    expect(result.current.finished).toBe(false) // 結果画面には行かない
    expect(loadWordRecords()[wordRecKey(1, 'すべて', 'en', ENDLESS)] ?? []).toEqual([]) // 非記録
  }, 20000)

  it('経過>=30秒で ESC したら finished になり記録される（中断ではなく記録）', () => {
    const onExit = vi.fn()
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', endCondition: ENDLESS, onExit }),
    )
    typeSome(result, 5) // 数文字打鍵（startTime 確定・keys>0）
    act(() => vi.advanceTimersByTime(MIN_RECORD_MS)) // 30秒以上経過させる
    pressEscape()
    expect(result.current.finished).toBe(true) // 結果画面へ
    expect(onExit).not.toHaveBeenCalled() // 30秒以上は中断ではない
    const list = loadWordRecords()[wordRecKey(1, 'すべて', 'en', ENDLESS)]
    expect(list.length).toBe(1)
    expect(list[0].endCondition.kind).toBe('endless')
    expect(list[0].speed).toEqual(expect.any(Number)) // 速度が成績として残る
  }, 20000)

  it('ちょうど30秒(>=)で ESC すれば記録される（境界）', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', endCondition: ENDLESS, onExit: () => {} }),
    )
    typeCorrect(result) // 経過 0 から
    act(() => vi.advanceTimersByTime(MIN_RECORD_MS)) // ちょうど30秒
    pressEscape()
    expect(result.current.finished).toBe(true)
    expect((loadWordRecords()[wordRecKey(1, 'すべて', 'en', ENDLESS)] ?? []).length).toBe(1)
  }, 20000)

  it('エンドレスは自動終了しない（打鍵・時間経過だけでは finished にならない＝ESC 必須）', () => {
    const { result } = renderHook(() =>
      useWords({ allWords: WORDS, level: 1, theme: 'すべて', mode: 'en', endCondition: ENDLESS, onExit: () => {} }),
    )
    typeSome(result, 30)
    act(() => vi.advanceTimersByTime(MIN_RECORD_MS * 3)) // 90秒経過してもエンドレスは終わらない
    expect(result.current.finished).toBe(false)
  }, 20000)
})
