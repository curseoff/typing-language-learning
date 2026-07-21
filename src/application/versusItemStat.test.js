// @vitest-environment jsdom
// #450 対戦の学習統計を通常プレイと区別する（書き込み側の仕様テスト）。
// 対戦は相手に追われる特殊な条件で打つので、その打鍵を solo の「この問題が苦手」という
// 判断材料に混ぜたくない。そこで 3 つの入力フックに versus フラグを足し、真なら
// 問題ごとの累積統計（item-stats）を対戦用の id（'vw'/'vd'/'vs'）へ積む。
//
// ここで最も重要なのは「versus 省略時の id が従来と1バイトも同じ」こと：ここが変わると
// 過去に積んだ統計が全部迷子になり、収録一覧の記録が丸ごと消えたように見える。
// そのため各フックで従来 id を文字列リテラルで固定して比較する（実装のなぞりではなく
// 「保存先の座標」そのものが仕様なので、リテラルで固定するのが正しい）。
//
// 検証方法：recordItemStat をモックし「どの id に積んだか」を見る。emit は問題が切り替わるか
// finish で flush されたときに起きるので、少し打ってから終了させて呼び出しを取り出す。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('./records.service.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, recordItemStat: vi.fn(() => ({})) }
})

import { useWords } from './useWords.js'
import { useDict } from './useDict.js'
import { useMarathon } from './useMarathon.js'
import { TIME_LIMIT_MS } from '../domain/marathon/passage.service.js'
import { WORDS } from '../content/wordsAll.js'
import { DICT } from '../content/dictionaryAll.js'
import { WORD_SENTENCES } from '../content/wordSentences/all.js'
import { recordItemStat, initMemoryPersistence } from './records.service.js'

beforeEach(() => {
  localStorage.clear()
  initMemoryPersistence()
  vi.clearAllMocks()
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

// 現在のセグメントを canonical で n 文字ぶん打つ（終了・打ち尽くしで打ち止め）。
const typeSome = (result, n) => {
  for (let i = 0; i < n; i++) {
    if (result.current.finished) break
    const seg = result.current.segments[result.current.segIndex]
    if (!seg) break
    typeKey(seg.canonical[result.current.segInput.length])
    act(() => vi.advanceTimersByTime(10))
  }
}

// recordItemStat が積んだ id の一覧（呼ばれていなければテスト側で気付けるよう空配列）。
const recordedIds = () => recordItemStat.mock.calls.map(([id]) => id)

describe('#450 useWords の versus（単語入力の学習統計を対戦と分ける）', () => {
  const opts = (extra = {}) => ({
    allWords: WORDS,
    level: 1,
    theme: 'すべて',
    mode: 'en',
    seed: 424242, // 出題列を固定する（打つ問題が毎回変わると通る経路がぶれる＝カバレッジも揺れる）
    onExit: () => {},
    saveRecord: false, // 記録一覧は本テストの関心外（item-stats の id だけを見る）
    ...extra,
  })

  it('versus 未指定なら従来どおり "w:<mode>:<en>" へ積む（既定＝通常プレイ・既存データ互換）', () => {
    const h = renderHook(() => useWords(opts()))
    const first = h.result.current.segments[0].en
    typeSome(h.result, 5)
    runOutClock()
    expect(recordedIds()).toContain(`w:en:${first}`)
    // 対戦 id には一切積まない。
    expect(recordedIds().every((id) => id.startsWith('w:'))).toBe(true)
  }, 20000)

  it('versus:false を明示しても従来 id（省略と同一）', () => {
    const h = renderHook(() => useWords(opts({ versus: false })))
    const first = h.result.current.segments[0].en
    typeSome(h.result, 5)
    runOutClock()
    expect(recordedIds()).toContain(`w:en:${first}`)
  }, 20000)

  it('versus:true なら対戦 id "vw:<mode>:<en>" へ積み、通常 id には積まない', () => {
    const h = renderHook(() => useWords(opts({ versus: true })))
    const first = h.result.current.segments[0].en
    typeSome(h.result, 5)
    runOutClock()
    expect(recordedIds()).toContain(`vw:en:${first}`)
    expect(recordedIds()).not.toContain(`w:en:${first}`)
  }, 20000)
})

describe('#450 useDict の versus（英英の学習統計を対戦と分ける）', () => {
  const opts = (extra = {}) => ({
    dict: DICT,
    level: 1,
    theme: 'すべて',
    mode: 'ja',
    seed: 424242, // 出題列を固定（同上）
    onExit: () => {},
    saveRecord: false,
    ...extra,
  })

  it('versus 未指定なら従来どおり "d:<mode>:<word>" へ積む（既定＝通常プレイ・既存データ互換）', () => {
    const h = renderHook(() => useDict(opts()))
    const first = h.result.current.segments[0].word
    typeSome(h.result, 10)
    runOutClock()
    expect(recordedIds()).toContain(`d:ja:${first}`)
    expect(recordedIds().every((id) => id.startsWith('d:'))).toBe(true)
  }, 20000)

  it('versus:true なら対戦 id "vd:<mode>:<word>" へ積み、通常 id には積まない', () => {
    const h = renderHook(() => useDict(opts({ versus: true })))
    const first = h.result.current.segments[0].word
    typeSome(h.result, 10)
    runOutClock()
    expect(recordedIds()).toContain(`vd:ja:${first}`)
    expect(recordedIds()).not.toContain(`d:ja:${first}`)
  }, 20000)
})

describe('#450 useMarathon の versus（単語例文の学習統計を対戦と分ける）', () => {
  const pool = WORD_SENTENCES.filter((s) => s.level === 1)
  const seed = 424242 // 出題列を決定的にする

  // start してから打鍵し、時間切れで finish（＝tracker が flush されて emit が出る）。
  const play = (extra = {}) => {
    const h = renderHook(() => useMarathon({ active: true, onFinish: () => {}, ...extra }))
    act(() => h.result.current.start('en', 1, 'wsent', pool, seed, 'すべて'))
    const first = h.result.current.segments[0].en
    typeSome(h.result, 10)
    runOutClock()
    return first
  }

  it('versus 未指定なら従来どおり "s:<mode>:<en>" へ積む（既定＝通常プレイ・既存データ互換）', () => {
    const first = play()
    expect(recordedIds()).toContain(`s:en:${first}`)
    expect(recordedIds().every((id) => id.startsWith('s:'))).toBe(true)
  }, 20000)

  it('versus:true なら対戦 id "vs:<mode>:<en>" へ積み、通常 id には積まない', () => {
    const first = play({ versus: true })
    expect(recordedIds()).toContain(`vs:en:${first}`)
    expect(recordedIds()).not.toContain(`s:en:${first}`)
  }, 20000)
})
