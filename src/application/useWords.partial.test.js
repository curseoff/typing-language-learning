// @vitest-environment jsdom
// #468: 終了時に「入力途中の語」がある場合の partial 記録（単語入力・入力系）の結合テスト。
// 終了条件に達した瞬間まだ打ち切っていない語は、打った分だけを partial:true の segStat として
// 積んでから finish する（＝打鍵が記録から消えない）。従来この分岐は出題順まかせ＝
// たまたま語の途中で終わった実行でしか踏まれず、被覆が実行ごとに揺れていた（#468 の揺れ源）。
// ここでは seed を固定し「必ず語の途中で終わる」状況を明示的に作って分岐を確定させる。
//   ・chars 制 … 語長より少ない打鍵数で終了 → finishByProgress の partial 経路。
//   ・endless + Esc … 語の途中で ESC → finishByEsc の partial 経路。
// label は seg.type で英語側/日本語側を出し分けるので、mode='en'/'ja' の両方を通す。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWords } from './useWords.js'
import { WORDS } from '../content/wordsAll.js'
import { initMemoryPersistence } from './records.service.js'

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

// 現在語の canonical を先頭から n 文字だけ打つ（語は完了させない＝途中で止める）。
const typePrefix = (result, n) => {
  for (let i = 0; i < n; i++) {
    const seg = result.current.segments[result.current.segIndex]
    typeKey(seg.canonical[result.current.segInput.length])
    act(() => vi.advanceTimersByTime(10))
  }
}

// seed 固定＝出題順を実行間で不変にする（この分岐が「たまたま」ではなく必ず踏まれるようにする）。
const opts = (endCondition, mode = 'en') => ({
  allWords: WORDS,
  level: 1,
  theme: 'すべて',
  mode,
  endCondition,
  seed: 12345,
  onExit: () => {},
})

// 記録に積まれた最後の segStat（＝終了時に途中だった語）。
const lastSeg = (result) => result.current.result.segStats.at(-1)

describe('useWords（終了時の入力途中の語を partial として記録する・#468）', () => {
  it('chars 制：語を打ち切る前に打鍵数へ達したら、打った分を partial:true で積んで終了する', () => {
    const { result } = renderHook(() => useWords(opts({ kind: 'chars', value: 2 })))
    const seg = result.current.segments[0]
    expect(seg.canonical.length).toBeGreaterThan(2) // 前提：2打鍵では終わらない語
    typePrefix(result, 2)
    expect(result.current.finished).toBe(true)
    expect(lastSeg(result)).toMatchObject({ partial: true, keys: 2, en: seg.en, ja: seg.ja })
  }, 20000)

  it('chars 制：partial の label は出題側で決まる（en は英語・ja は日本語）', () => {
    const en = renderHook(() => useWords(opts({ kind: 'chars', value: 2 }, 'en')))
    typePrefix(en.result, 2)
    expect(lastSeg(en.result).label).toBe(lastSeg(en.result).en)

    const ja = renderHook(() => useWords(opts({ kind: 'chars', value: 2 }, 'ja')))
    typePrefix(ja.result, 2)
    expect(lastSeg(ja.result).label).toBe(lastSeg(ja.result).ja)
  }, 20000)

  it('endless：語の途中で ESC しても、打った分は partial:true で記録に残る', () => {
    const { result } = renderHook(() => useWords(opts({ kind: 'endless' })))
    typePrefix(result, 1)
    act(() => vi.advanceTimersByTime(30_000)) // 記録に残る最低プレイ時間を超える
    typeKey('Escape')
    expect(result.current.finished).toBe(true)
    expect(lastSeg(result)).toMatchObject({ partial: true, keys: 1 })
  }, 20000)

  it('endless：1打鍵も無い状態の ESC は partial を積まない（空の途中記録を作らない）', () => {
    const { result } = renderHook(() => useWords(opts({ kind: 'endless' })))
    typePrefix(result, 3) // 1語目を数打鍵→完了させて次語の頭（入力0）で止める
    const before = result.current.segIndex
    while (result.current.segIndex === before) typePrefix(result, 1)
    expect(result.current.segInput).toBe('')
    act(() => vi.advanceTimersByTime(30_000))
    typeKey('Escape')
    expect(result.current.finished).toBe(true)
    expect(result.current.result.segStats.every((s) => !s.partial)).toBe(true)
  }, 20000)
})
