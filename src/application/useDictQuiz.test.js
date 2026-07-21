// @vitest-environment jsdom
// 英英4択クイズの結合テスト。打鍵で数問解いてから60秒経過をシミュレートして finish させ、
// record と segStats を確認する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDictQuiz } from './useDictQuiz.js'
import { DICT_QUIZ_COUNT } from '../domain/dictionary/dictset.service.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.service.js'
import { DICT } from '../content/dictionaryAll.js'
import { WORDS } from '../content/wordsAll.js'
import { END_TIME_VALUES } from '../content/endConditions.js'
import { loadDictRecords, dictRecKey, initMemoryPersistence } from './records.service.js'

// #364 range 出題用の freqMap（見出し語 en→freq）。dict は freq を持たないため単語データから作る。
const FREQ_MAP = new Map(WORDS.map((w) => [w.en, w.freq]))

const ENDLESS = { kind: 'endless', value: null }
const MIN_RECORD_MS = END_TIME_VALUES[0] * 1000 // 記録に必要な最低プレイ時間（30秒）

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

const runOutClock = () => {
  act(() => vi.advanceTimersByTime(TIME_LIMIT_MS + 200))
  act(() => vi.runOnlyPendingTimers())
}

const solve = (result, n) => {
  for (let i = 0; i < n; i++) {
    if (result.current.finished) break
    const correct = result.current.question.options.find((o) => o.answer)
    ;[...correct.variants[0]].forEach(typeKey) // 正解の見出し語を打つ
    typeKey('Enter')
    act(() => vi.advanceTimersByTime(50))
  }
}

describe('useDictQuiz（英英4択・60秒・結合）', () => {
  it('正解を打って数問解き、60秒で finish。record と segStats(全問正解) を保存する', () => {
    const { result } = renderHook(() =>
      useDictQuiz({ dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', onExit: () => {} }),
    )
    solve(result, 6)
    runOutClock()
    expect(result.current.finished).toBe(true)
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz')][0]
    expect(rec.keys).toBeGreaterThan(0)
    expect(rec.correct).toBe(rec.words)
    expect(rec.seconds).toBeCloseTo(60, 0)
    expect(rec.segStats).toHaveLength(rec.words)
    expect(rec.segStats.every((s) => s.correct === true)).toBe(true)
  })

  it('通常プレイ（seed 未指定）でも record に有効な seed が入る＝記録から再挑戦できる', () => {
    const { result } = renderHook(() =>
      useDictQuiz({ dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', onExit: () => {} }),
    )
    solve(result, 4)
    runOutClock()
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz')][0]
    expect(rec.seed).toEqual(expect.any(Number))
    expect(rec.source).toBe('dict')
  })

  it('range 指定時は範囲別キー（__R{n}）に記録し record.range を載せる（#364）', () => {
    const { result } = renderHook(() =>
      useDictQuiz({ dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', range: 1, freqMap: FREQ_MAP, onExit: () => {} }),
    )
    solve(result, 4)
    runOutClock()
    const ranged = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz', undefined, 1)]
    expect(ranged?.length).toBeGreaterThan(0)
    expect(ranged[0].range).toBe(1)
    // range 未指定は record に range を載せない（後方互換）。
    expect(loadDictRecords()[dictRecKey(1, 'すべて', 'quiz')]).toBeUndefined()
  })

  it('range 指定は freq 順で決定的＝同 range なら seed 非依存で同じ出題列（#364）', () => {
    const opts = { dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', range: 1, freqMap: FREQ_MAP, onExit: () => {} }
    const a = renderHook(() => useDictQuiz({ ...opts, seed: 111 }))
    const b = renderHook(() => useDictQuiz({ ...opts, seed: 999 }))
    // seed が違っても range 出題は同一の prompt 列（freq 順固定・rng 不使用）。
    expect(a.result.current.question.prompt).toBe(b.result.current.question.prompt)
  })

  it('同じ seed なら同じ出題・選択肢を再現し、record に seed が入る（リプレイ）', () => {
    const seed = 369121
    const opts = { dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', seed, onExit: () => {} }
    const a = renderHook(() => useDictQuiz(opts))
    const b = renderHook(() => useDictQuiz(opts))
    expect(a.result.current.question.prompt).toBe(b.result.current.question.prompt)
    expect(a.result.current.question.options.map((o) => o.display)).toEqual(
      b.result.current.question.options.map((o) => o.display),
    )

    const { result } = renderHook(() => useDictQuiz(opts))
    solve(result, 4)
    runOutClock()
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz')][0]
    expect(rec.seed).toBe(seed)
    expect(rec.source).toBe('dict')
  })
})

describe('useDictQuiz 操作（クリック選択・打ちミス・打ち直し・継ぎ足し・もう一度）', () => {
  const opts = { dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', onExit: () => {} }

  it('クリック（pick）でも選択が確定し、正解なら correct が増える。確定後の pick は無視する', () => {
    const { result } = renderHook(() => useDictQuiz(opts))
    const answer = result.current.question.options.find((o) => o.answer)
    const wrong = result.current.question.options.find((o) => !o.answer)
    act(() => result.current.pick(answer))
    expect(result.current.picked).toBe(answer)
    expect(result.current.correct).toBe(1)
    expect(result.current.typedKeys).toBe(0) // クリック選択は打鍵数に加算しない
    act(() => result.current.pick(wrong))
    expect(result.current.picked).toBe(answer) // 多重確定しない
    expect(result.current.correct).toBe(1)
  })

  it('どの選択肢の先頭にもならない打鍵はミス扱い＝mistakes/missedItems が増え hasError になる', () => {
    const { result } = renderHook(() => useDictQuiz(opts))
    typeKey('1') // 英単語の先頭になり得ない文字＝必ずミス
    expect(result.current.mistakes).toBe(1)
    expect(result.current.hasError).toBe(true)
    expect(result.current.missedItems).toBe(1) // ミスした設問数は1（同じ設問で何度ミスしても1）
    expect(result.current.input).toBe('') // ミスは入力に積まない
    typeKey('2')
    expect(result.current.mistakes).toBe(2)
    expect(result.current.missedItems).toBe(1)
  })

  it('Backspace で打ちかけの入力を1文字ずつ戻せる（打ち直して正解できる）', () => {
    const { result } = renderHook(() => useDictQuiz(opts))
    const answer = result.current.question.options.find((o) => o.answer)
    const head = answer.variants[0].slice(0, 2)
    ;[...head].forEach(typeKey)
    expect(result.current.input).toBe(head)
    typeKey('Backspace')
    expect(result.current.input).toBe(head.slice(0, 1))
    typeKey('Backspace')
    expect(result.current.input).toBe('')
    expect(result.current.picked).toBeNull() // 戻しただけでは確定しない
    ;[...answer.variants[0]].forEach(typeKey)
    expect(result.current.picked).toBe(answer)
  })

  it('問題を全部解いても終わらず、再シャッフルで継ぎ足して出題し続ける（時間制）', () => {
    const { result } = renderHook(() => useDictQuiz(opts))
    solve(result, DICT_QUIZ_COUNT + 2) // 初回分を解き切って更に先へ進む
    expect(result.current.finished).toBe(false)
    expect(result.current.index).toBe(DICT_QUIZ_COUNT + 2)
    expect(result.current.question).toBeDefined() // 継ぎ足された問題が出ている
    runOutClock()
    const rec = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz')][0]
    expect(rec.words).toBe(DICT_QUIZ_COUNT + 2) // 初回分を超えて解いた設問も記録に載る
  }, 30000)

  it('終了後に Enter（restart）で最初から遊べる＝状態が初期化され seed も切り直す', () => {
    const { result } = renderHook(() => useDictQuiz(opts))
    solve(result, 3)
    runOutClock()
    expect(result.current.finished).toBe(true)
    const firstSeed = result.current.result.seed
    typeKey('Enter') // 結果画面での Enter＝もう一度
    expect(result.current.finished).toBe(false)
    expect(result.current.result).toBeNull()
    expect(result.current.index).toBe(0)
    expect(result.current.correct).toBe(0)
    expect(result.current.typedKeys).toBe(0)
    expect(result.current.picked).toBeNull()
    solve(result, 3)
    runOutClock()
    const list = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz')]
    expect(list.length).toBe(2)
    expect(list.some((r) => r.seed !== firstSeed)).toBe(true)
  }, 30000)
})

// #208 段6：エンドレスは ESC で終了。30秒以上プレイした時だけ記録する。
const pressEscape = () => typeKey('Escape')

describe('useDictQuiz エンドレス（#208 段6：ESC・30秒以上で記録）', () => {
  it('経過<30秒で ESC したら記録せず onExit（中断＝TOPへ）', () => {
    const onExit = vi.fn()
    const { result } = renderHook(() =>
      useDictQuiz({ dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', endCondition: ENDLESS, onExit }),
    )
    solve(result, 1) // startTime 確定
    act(() => vi.advanceTimersByTime(MIN_RECORD_MS - 100)) // 29.9秒
    pressEscape()
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(result.current.finished).toBe(false)
    expect(loadDictRecords()[dictRecKey(1, 'すべて', 'quiz', ENDLESS)] ?? []).toEqual([])
  }, 20000)

  it('経過>=30秒で ESC したら finished になり記録される（速度が成績）', () => {
    const onExit = vi.fn()
    const { result } = renderHook(() =>
      useDictQuiz({ dict: DICT, level: 1, theme: 'すべて', kind: 'quiz', endCondition: ENDLESS, onExit }),
    )
    solve(result, 3)
    act(() => vi.advanceTimersByTime(MIN_RECORD_MS)) // 30秒
    pressEscape()
    expect(result.current.finished).toBe(true)
    expect(onExit).not.toHaveBeenCalled()
    const list = loadDictRecords()[dictRecKey(1, 'すべて', 'quiz', ENDLESS)]
    expect(list.length).toBe(1)
    expect(list[0].endCondition.kind).toBe('endless')
    expect(list[0].speed).toEqual(expect.any(Number))
  }, 20000)
})
