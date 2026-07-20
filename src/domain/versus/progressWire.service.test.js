import { describe, it, expect } from 'vitest'
// #439 バグA：progress 送信のフィールド選別を純関数へ切り出す（手動ホワイトリストの取りこぼし再発防止）。
// useVersus.sendProgress が payload を「固定ホワイトリストで再構築」する際、#439 で足した
// qIndex/typedSide/curPos を destructure し忘れて丸ごと捨てていた（相手カードの複製が出ない）。
// 本体 src/domain/versus/progressWire.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的・入力非破壊。
//   pickProgressFields(input) → 定義済み（!== undefined）のホワイトリストキーだけを写した新オブジェクト。
//   ホワイトリスト＝typed,total,mistakes,correct,lives,speed,elapsedMs,cells,miss,qIndex,typedSide,curPos。
//   peerId/at は含めない（呼び出し側＝useVersus が selfId/performance.now で付与する）。
import { pickProgressFields } from './progressWire.service.js'

describe('pickProgressFields（#439・progress 転送フィールドの純関数選別）', () => {
  it('全キー定義：ホワイトリスト全キーを写す（qIndex/typedSide/curPos を含む＝本バグの回帰ガード）', () => {
    const input = {
      typed: 3,
      total: 10,
      mistakes: 1,
      correct: 2,
      lives: 3,
      speed: 240,
      elapsedMs: 5000,
      cells: 4,
      miss: false,
      qIndex: 5,
      typedSide: 'en',
      curPos: 3,
    }
    expect(pickProgressFields(input)).toEqual({
      typed: 3,
      total: 10,
      mistakes: 1,
      correct: 2,
      lives: 3,
      speed: 240,
      elapsedMs: 5000,
      cells: 4,
      miss: false,
      qIndex: 5,
      typedSide: 'en',
      curPos: 3,
    })
  })

  it('本バグ核心：#439 の qIndex/typedSide/curPos が確実に転送される（destructure 漏れの再発検知）', () => {
    const out = pickProgressFields({ typed: 0, total: 8, mistakes: 0, qIndex: 2, typedSide: 'ja', curPos: 1 })
    expect(out.qIndex).toBe(2)
    expect(out.typedSide).toBe('ja')
    expect(out.curPos).toBe(1)
  })

  it('0 値保持：qIndex:0 / curPos:0 は !== undefined 判定で残す（falsy 落ちしない）', () => {
    const out = pickProgressFields({ typed: 0, total: 5, mistakes: 0, qIndex: 0, curPos: 0, typedSide: 'en' })
    expect(out).toHaveProperty('qIndex', 0)
    expect(out).toHaveProperty('curPos', 0)
    expect(out).toHaveProperty('typed', 0)
    expect(out).toHaveProperty('mistakes', 0)
  })

  it('未定義キーは省略：lives 無しなら出力に lives キーを持たない（後方互換＝最小 progress）', () => {
    const out = pickProgressFields({ typed: 1, total: 4, mistakes: 0 })
    expect(out).toEqual({ typed: 1, total: 4, mistakes: 0 })
    expect(out).not.toHaveProperty('lives')
    expect(out).not.toHaveProperty('correct')
    expect(out).not.toHaveProperty('speed')
    expect(out).not.toHaveProperty('elapsedMs')
    expect(out).not.toHaveProperty('cells')
    expect(out).not.toHaveProperty('miss')
    expect(out).not.toHaveProperty('qIndex')
    expect(out).not.toHaveProperty('typedSide')
    expect(out).not.toHaveProperty('curPos')
  })

  it('ホワイトリスト外キーは落とす（foo は転送しない）', () => {
    const out = pickProgressFields({ typed: 1, total: 4, mistakes: 0, foo: 'bar', extra: 123 })
    expect(out).not.toHaveProperty('foo')
    expect(out).not.toHaveProperty('extra')
    expect(out).toEqual({ typed: 1, total: 4, mistakes: 0 })
  })

  it('peerId/at は含めない（呼び出し側が selfId/at を付与する責務）', () => {
    const out = pickProgressFields({ peerId: 'p-self', at: 12345, typed: 2, total: 6, mistakes: 1 })
    expect(out).not.toHaveProperty('peerId')
    expect(out).not.toHaveProperty('at')
    expect(out).toEqual({ typed: 2, total: 6, mistakes: 1 })
  })

  it('純粋：入力オブジェクトを破壊せず、新しいオブジェクトを返す', () => {
    const input = { typed: 2, total: 6, mistakes: 1, qIndex: 1, typedSide: 'en', curPos: 2 }
    const snapshot = { ...input }
    const out = pickProgressFields(input)
    expect(input).toEqual(snapshot) // 非破壊
    expect(out).not.toBe(input) // 別オブジェクト
  })
})
