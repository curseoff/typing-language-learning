// @vitest-environment jsdom
// #210 回帰: 単語例文（マラソン）で終了条件=問題数（items=N）にしたとき、
// N が「初期出題セグメント数」を超えても、出題を継ぎ足して N 問完答で終了・記録できること。
//
// バグ #210（リリースブロッカー）: useMarathon.js の完了分岐に出題の継ぎ足しが無く、
// segIndex が初期セグメント末尾に達すると handleKey が入力を無視し（seg 未定義で return）、
// items 制は endLimitMs=Infinity でタイマー終了も無いため、終了経路が消えてハングする。
// useWords.js / useDict.js には有る「segIndex+1>=segments.length で buildPassage を追記」が
// useMarathon にだけ欠落しているのが根因。
//
// このテストは「継ぎ足してハングせず finish する」という振る舞いを検証する（実装のなぞりではない）。
// 継ぎ足しが無い現状では初期セグメントを打ち尽くした時点で segIndex が末尾で固まり、
// onFinish が呼ばれない＝Red（失敗）になる。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMarathon } from './useMarathon.js'
import { WORD_SENTENCES } from '../content/wordSentences/all.js'

// items 制は「時間では終わらない」（endLimitMs=Infinity）ので fake timers は使うが時間は進めない。
// 終了は完答した問題数（進捗判定）だけで決まる。
beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'performance'] }))
afterEach(() => vi.useRealTimers())

const typeKey = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

// 現在セグメントを canonical で最後まで打って 1 問完答する（1 セグメント=1 問）。
// items 制は時間で終わらないので timer は進めない（速く回すため）。
// - segments を打ち尽くすと seg が undefined になり break（バグ時の打ち止めを無限ループにしない）。
// - onFinish 済み（finish 後）は handleKey が無視して segIndex が進まないので、これも break。
// - guard は 1 セグメント canonical の最大長より十分大きく取る（安全弁）。
const completeWord = (result, onFinish) => {
  const startIdx = result.current.segIndex
  let guard = 0
  while (
    result.current.segIndex === startIdx &&
    onFinish.mock.calls.length === 0 &&
    guard < 500
  ) {
    const seg = result.current.segments[result.current.segIndex]
    if (!seg) break // 出題を打ち尽くした（継ぎ足しが無いと発生）
    typeKey(seg.canonical[result.current.segInput.length])
    guard++
  }
}

describe('useMarathon（単語例文・問題数制 items・#210 回帰）', () => {
  it('items=N が初期セグメント数を超えても、継ぎ足して N 問完答で onFinish が1回呼ばれる', () => {
    const pool = WORD_SENTENCES.filter((s) => s.level === 1)
    const seed = 424242 // 出題列を決定的にして「初期セグメント数」を安定させる

    // まず probe で初期セグメント数を測る（同じ seed なら本番 hook と同一の出題列になる）。
    const probe = renderHook(() => useMarathon({ active: false, onFinish: vi.fn() }))
    act(() => probe.result.current.start('en', 1, 'wsent', pool, seed))
    const initialSegCount = probe.result.current.segments.length
    probe.unmount()
    expect(initialSegCount).toBeGreaterThan(0)

    // N を初期セグメント数より確実に大きくする（buildPassage の実数に依存せず超過を保証）。
    const N = initialSegCount + 3
    const endCondition = { kind: 'items', value: N } // 再レンダ間で安定参照にする

    const onFinish = vi.fn()
    const { result } = renderHook(() => useMarathon({ active: true, onFinish, endCondition }))
    act(() => result.current.start('en', 1, 'wsent', pool, seed))
    expect(result.current.segments.length).toBe(initialSegCount) // 同 seed で probe と一致

    // N 問（+余裕2）まで 1 問ずつ完答する。finish したら onFinish で自動的に打ち止め。
    for (let i = 0; i < N + 2 && onFinish.mock.calls.length === 0; i++) {
      completeWord(result, onFinish)
    }

    // 継ぎ足して N 問完答 → ちょうど 1 回 finish（バグ時は初期セグメント枯渇でハング＝0 回）。
    expect(onFinish).toHaveBeenCalledTimes(1)
    const [record] = onFinish.mock.calls[0]
    expect(record.source).toBe('wsent')
    expect(record.endCondition.kind).toBe('items')
    expect(record.endCondition.value).toBe(N)
    // 全問ノーミス完答なので一発正解数は N と等しい。
    expect(record.correctCount).toBe(N)

    // 継ぎ足しにより、初期セグメント数より出題が増えていること（継ぎ足しの副次確認）。
    expect(result.current.segments.length).toBeGreaterThan(initialSegCount)
  }, 20000)
})
