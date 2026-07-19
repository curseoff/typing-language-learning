// #432 P2P穴埋め対戦：自分の進捗を送信 payload へ変換する純ポリシーの単体テスト。
// 本体 src/application/versus/versusPlay.policy.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// segStats fixture は segTracker.policy が積む実構造に合わせる（{ partial, mistakes, ... }）。
//   correct = firstTryCorrectCount(segStats)              … !partial かつ (mistakes??0)===0 の件数
//   lives   = livesFor(missedItemCount(segStats, currentMistakes), initialLives)  … initialLives が数値のときだけ
import { describe, it, expect } from 'vitest'
import { toProgressPayload } from './versusPlay.policy.js'
import { firstTryCorrectCount, missedItemCount } from '../../domain/records/segmentStats.service.js'
import { livesFor } from '../../domain/versus/suddenDeath.service.js'
import { maskFill } from '../../domain/versus/progressMask.service.js'

// segTracker.policy.js が積む segStats 要素の実構造に合わせた fixture。
// 一発正解＝!partial かつ mistakes0。ここでは 3 問正解・1 問ミス・1 問打ち切り。
const SEG_STATS = [
  { no: 1, type: 'ja', label: '海', keys: 3, mistakes: 0, seconds: 1.2, speed: 150, partial: false },
  { no: 2, type: 'ja', label: '山', keys: 3, mistakes: 0, seconds: 1.0, speed: 180, partial: false },
  { no: 3, type: 'ja', label: '川', keys: 3, mistakes: 2, seconds: 2.0, speed: 90, partial: false }, // ミスあり
  { no: 4, type: 'ja', label: '空', keys: 3, mistakes: 0, seconds: 1.1, speed: 160, partial: false },
  { no: 5, type: 'ja', label: '風', keys: 1, mistakes: 0, seconds: 0.5, speed: 120, partial: true }, // 打ち切り
]

describe('toProgressPayload: 透過フィールドと correct', () => {
  it('typed/total/mistakes をそのまま透過する', () => {
    const p = toProgressPayload({
      typed: 12,
      total: 30,
      mistakes: 2,
      segStats: SEG_STATS,
      currentMistakes: 0,
      initialLives: null,
    })
    expect(p.typed).toBe(12)
    expect(p.total).toBe(30)
    expect(p.mistakes).toBe(2)
  })

  it('correct は firstTryCorrectCount(segStats) と一致する', () => {
    const p = toProgressPayload({
      typed: 12,
      total: 30,
      mistakes: 2,
      segStats: SEG_STATS,
      currentMistakes: 0,
      initialLives: null,
    })
    expect(p.correct).toBe(firstTryCorrectCount(SEG_STATS))
    expect(p.correct).toBe(3) // 問1・2・4 が一発正解
  })
})

describe('toProgressPayload: lives（サドンデス時のみ）', () => {
  it('initialLives が数値のとき lives = livesFor(missedItemCount(...), initialLives)', () => {
    const currentMistakes = 1
    const initialLives = 3
    const p = toProgressPayload({
      typed: 12,
      total: 30,
      mistakes: 2,
      segStats: SEG_STATS,
      currentMistakes,
      initialLives,
    })
    const expected = livesFor(missedItemCount(SEG_STATS, currentMistakes), initialLives)
    expect(p.lives).toBe(expected)
    // 確定ミス問題=1（問3）＋進行中ミスあり(+1)=2 → 3-2=1
    expect(p.lives).toBe(1)
  })

  it('initialLives が null なら lives を含めない', () => {
    const p = toProgressPayload({
      typed: 12,
      total: 30,
      mistakes: 2,
      segStats: SEG_STATS,
      currentMistakes: 0,
      initialLives: null,
    })
    expect('lives' in p).toBe(false)
  })

  it('initialLives が undefined なら lives を含めない', () => {
    const p = toProgressPayload({
      typed: 12,
      total: 30,
      mistakes: 2,
      segStats: SEG_STATS,
      currentMistakes: 0,
    })
    expect('lives' in p).toBe(false)
  })

  it('ライフは 0 で下げ止まる（負にならない）', () => {
    const p = toProgressPayload({
      typed: 12,
      total: 30,
      mistakes: 5,
      segStats: SEG_STATS,
      currentMistakes: 1,
      initialLives: 1, // ミス問題2 > ライフ1 → 0
    })
    expect(p.lives).toBe(0)
  })
})

// #432 相手カードの速度・時間が0：progress payload に速度(speed)・経過時間(elapsedMs)を載せる。
// 呼び出し側が計測した speed/elapsedMs を透過するだけの純ポリシー（派生計算はしない）。
// 後方互換：undefined のときはキー自体を含めない（既存の呼び出しを壊さない）。
describe('toProgressPayload: speed/elapsedMs（相手カード表示用）', () => {
  it('speed と elapsedMs を渡すと payload に含める', () => {
    const p = toProgressPayload({
      typed: 12,
      total: 30,
      mistakes: 2,
      segStats: SEG_STATS,
      currentMistakes: 0,
      initialLives: null,
      speed: 185,
      elapsedMs: 4200,
    })
    expect(p.speed).toBe(185)
    expect(p.elapsedMs).toBe(4200)
  })

  it('speed=0 / elapsedMs=0（レース開始直後の下限）も含める', () => {
    const p = toProgressPayload({
      typed: 0,
      total: 30,
      mistakes: 0,
      segStats: [],
      currentMistakes: 0,
      initialLives: null,
      speed: 0,
      elapsedMs: 0,
    })
    expect(p.speed).toBe(0)
    expect(p.elapsedMs).toBe(0)
  })

  it('speed が undefined ならキーを含めない（後方互換）', () => {
    const p = toProgressPayload({
      typed: 12,
      total: 30,
      mistakes: 2,
      segStats: SEG_STATS,
      currentMistakes: 0,
      initialLives: null,
      elapsedMs: 4200,
    })
    expect('speed' in p).toBe(false)
    expect(p.elapsedMs).toBe(4200)
  })

  it('elapsedMs が undefined ならキーを含めない（後方互換）', () => {
    const p = toProgressPayload({
      typed: 12,
      total: 30,
      mistakes: 2,
      segStats: SEG_STATS,
      currentMistakes: 0,
      initialLives: null,
      speed: 185,
    })
    expect('elapsedMs' in p).toBe(false)
    expect(p.speed).toBe(185)
  })

  it('speed/elapsedMs を渡さない既存呼び出しは両キーを含めない（後方互換）', () => {
    const p = toProgressPayload({
      typed: 12,
      total: 30,
      mistakes: 2,
      segStats: SEG_STATS,
      currentMistakes: 0,
      initialLives: null,
    })
    expect('speed' in p).toBe(false)
    expect('elapsedMs' in p).toBe(false)
    // 既存の correct/lives 仕様は不変（correct は必ず入り、lives は initialLives=null なので入らない）。
    expect(p.correct).toBe(firstTryCorrectCount(SEG_STATS))
    expect('lives' in p).toBe(false)
  })
})

// #437 伏せ字マスバー：手元の実長 curLen を送信側で cap マスに量子化し、cells（0..cap 整数）を載せる。
// curLen 実長はワイヤに流さない（cells のみ）。ミス中フラグ miss も透過する。
// 4択（curLen or cap 未指定）では cells を出さない。後方互換：未指定ならキー自体を含めない。
describe('toProgressPayload: cells/miss（伏せ字マスバー・#437）', () => {
  it('curLen と cap を渡すと cells = maskFill(...) を含める（送信側で量子化）', () => {
    const p = toProgressPayload({
      typed: 12,
      total: 30,
      mistakes: 2,
      segStats: SEG_STATS,
      currentMistakes: 0,
      initialLives: null,
      curPos: 1,
      curLen: 3,
      cap: 12,
    })
    expect(p.cells).toBe(maskFill({ curPos: 1, curLen: 3, cap: 12 }))
    expect(p.cells).toBe(4) // floor(1/3*12)=4
  })

  it('curLen=0（未着手）でも cells を含める（cells=0）', () => {
    const p = toProgressPayload({
      typed: 0,
      total: 30,
      mistakes: 0,
      segStats: [],
      currentMistakes: 0,
      initialLives: null,
      curPos: 0,
      curLen: 0,
      cap: 12,
    })
    expect(p.cells).toBe(0)
  })

  it('curLen 未指定なら cells を含めない（4択相当・後方互換）', () => {
    const p = toProgressPayload({
      typed: 12,
      total: 30,
      mistakes: 2,
      segStats: SEG_STATS,
      currentMistakes: 0,
      initialLives: null,
      curPos: 1,
      cap: 12,
    })
    expect('cells' in p).toBe(false)
  })

  it('cap 未指定なら cells を含めない（4択相当・後方互換）', () => {
    const p = toProgressPayload({
      typed: 12,
      total: 30,
      mistakes: 2,
      segStats: SEG_STATS,
      currentMistakes: 0,
      initialLives: null,
      curPos: 1,
      curLen: 3,
    })
    expect('cells' in p).toBe(false)
  })

  it('miss を渡すと payload に含める（true/false どちらも透過）', () => {
    const t = toProgressPayload({
      typed: 12, total: 30, mistakes: 2, segStats: SEG_STATS, currentMistakes: 0, initialLives: null, miss: true,
    })
    expect(t.miss).toBe(true)
    const f = toProgressPayload({
      typed: 12, total: 30, mistakes: 2, segStats: SEG_STATS, currentMistakes: 0, initialLives: null, miss: false,
    })
    expect(f.miss).toBe(false)
  })

  it('miss が undefined ならキーを含めない（後方互換）', () => {
    const p = toProgressPayload({
      typed: 12, total: 30, mistakes: 2, segStats: SEG_STATS, currentMistakes: 0, initialLives: null,
    })
    expect('miss' in p).toBe(false)
  })

  it('cells/miss を渡さない既存呼び出しは両キーを含めない（後方互換）', () => {
    const p = toProgressPayload({
      typed: 12, total: 30, mistakes: 2, segStats: SEG_STATS, currentMistakes: 0, initialLives: null,
    })
    expect('cells' in p).toBe(false)
    expect('miss' in p).toBe(false)
  })
})
