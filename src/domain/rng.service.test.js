import { describe, it, expect } from 'vitest'
// Issue #412 貧血ドメイン整理（挙動不変リファクタ・TDD Red）。
// application 層（useWords.js:36-43 / useMarathon.js:34-41 / useDict.js:37-44）に
// インライン重複していた FNV-1a を domain/rng.service.js へ抽出する。
// ここでは「抽出後の fnv1a が現行インライン実装と byte 同一」であることを、
// 具体的な入力→出力の厳密一致で pin する（現行式を node で実行して得た期待値）。
// 本体（fnv1a の export）は coder が Green で作る＝現状は未実装で undefined→呼ぶと Red。
import { fnv1a, mulberry32 } from './rng.service.js'

// 参照実装（現行インライン式そのまま）。fnv1a の戻り値がこれと一致することを検証する。
function fnv1aRef(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

describe('fnv1a（#412 抽出：現行インライン実装と byte 同一）', () => {
  it('具体入力→出力を厳密一致で pin する（現行式で算出した期待値）', () => {
    // 期待値は現行 FNV-1a 32bit（offset 0x811c9dc5 / prime 0x01000193 / >>>0）を node 実行して取得。
    expect(fnv1a('above')).toBe(2753641482)
    expect(fnv1a('reserve')).toBe(657005387)
    expect(fnv1a('cat')).toBe(108289031)
    expect(fnv1a('apple')).toBe(280767167)
    expect(fnv1a('x')).toBe(4245442695)
  })

  it('空文字は FNV offset basis（0x811c9dc5 = 2166136261）を返す', () => {
    expect(fnv1a('')).toBe(2166136261)
  })

  it('参照実装（現行インライン式）と多数の語で完全一致する', () => {
    for (const w of ['dog', 'house', 'tree', 'book', 'the', 'a', 'reserve', 'あいう', '日本語', 'a b']) {
      expect(fnv1a(w)).toBe(fnv1aRef(w))
    }
  })

  it('決定的：同じ入力は常に同じ値を返す', () => {
    expect(fnv1a('reserve')).toBe(fnv1a('reserve'))
  })

  it('戻り値は符号なし 32bit 整数（>>>0 済み・0..2^32-1 の整数）', () => {
    for (const w of ['above', 'x', 'ffffffff', '']) {
      const v = fnv1a(w)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(0xffffffff)
      expect(v).toBe(v >>> 0)
    }
  })

  it('同ファイルの既存 export（mulberry32）は保持される', () => {
    expect(typeof mulberry32).toBe('function')
  })
})
