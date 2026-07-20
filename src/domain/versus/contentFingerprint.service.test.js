import { describe, it, expect } from 'vitest'
// #439 道Y PR-A：content 版ズレ（穴③）検知用の純ドメイン。
// 本体 src/domain/versus/contentFingerprint.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的・安定・入力非破壊。
//   contentFingerprint(pool)      … pool 件数＋各要素キー（en/word 等）から 32bit 決定ハッシュ（FNV-1a 等）。
//   fingerprintsMatch(a, b)       … 2 指紋の一致判定（真偽）。
import { contentFingerprint, fingerprintsMatch } from './contentFingerprint.service.js'

describe('contentFingerprint（#439道Y・content 指紋：決定的 32bit ハッシュ）', () => {
  it('同一内容の pool（別オブジェクト・同順）は同一指紋＝構造的に決定的', () => {
    const a = [{ en: 'apple' }, { en: 'banana' }]
    const b = [{ en: 'apple' }, { en: 'banana' }]
    expect(contentFingerprint(a)).toBe(contentFingerprint(b))
  })

  it('要素キーを1つ差し替えると別指紋（banana→cherry）', () => {
    const a = [{ en: 'apple' }, { en: 'banana' }]
    const b = [{ en: 'apple' }, { en: 'cherry' }]
    expect(contentFingerprint(a)).not.toBe(contentFingerprint(b))
  })

  it('件数が違うと別指紋（1件 vs 2件）', () => {
    const one = [{ en: 'apple' }]
    const two = [{ en: 'apple' }, { en: 'banana' }]
    expect(contentFingerprint(one)).not.toBe(contentFingerprint(two))
  })

  it('空 pool は定数 0', () => {
    expect(contentFingerprint([])).toBe(0)
  })

  it('null は 0（防御）', () => {
    expect(contentFingerprint(null)).toBe(0)
  })

  it('undefined は 0（防御）', () => {
    expect(contentFingerprint(undefined)).toBe(0)
  })

  it('非空 pool の指紋は整数の数値', () => {
    const fp = contentFingerprint([{ en: 'apple' }, { en: 'banana' }])
    expect(typeof fp).toBe('number')
    expect(Number.isInteger(fp)).toBe(true)
  })

  it('非空 pool の指紋は 0（無効センチネル）ではない', () => {
    // 0 は空/null 用の予約値。実在 content が 0 に潰れると縮退判定が誤発火する。
    expect(contentFingerprint([{ en: 'apple' }, { en: 'banana' }])).not.toBe(0)
  })

  it('入力（pool）を破壊しない', () => {
    const pool = [{ en: 'apple' }, { en: 'banana' }]
    const snapshot = JSON.stringify(pool)
    contentFingerprint(pool)
    expect(JSON.stringify(pool)).toBe(snapshot)
  })
})

describe('fingerprintsMatch（#439道Y・指紋一致判定）', () => {
  it('同一指紋は true（fingerprintsMatch(x, x) === true）', () => {
    const x = contentFingerprint([{ en: 'apple' }, { en: 'banana' }])
    expect(fingerprintsMatch(x, x)).toBe(true)
  })

  it('構造的に同一の pool の指紋どうしは一致（true）', () => {
    const a = contentFingerprint([{ en: 'apple' }, { en: 'banana' }])
    const b = contentFingerprint([{ en: 'apple' }, { en: 'banana' }])
    expect(fingerprintsMatch(a, b)).toBe(true)
  })

  it('異なる pool の指紋どうしは不一致（false）', () => {
    const a = contentFingerprint([{ en: 'apple' }, { en: 'banana' }])
    const b = contentFingerprint([{ en: 'apple' }, { en: 'cherry' }])
    expect(fingerprintsMatch(a, b)).toBe(false)
  })
})
