import { describe, it, expect } from 'vitest'
// 未実装モジュール（契約C）。coder が Green にする対象。
import { acceptsRomaji, isKanaComplete } from './input.js'

describe('acceptsRomaji（契約C: 入力途中として妥当か）', () => {
  it.each([
    ['し', '', true],
    ['し', 's', true],
    ['し', 'shi', true],
    ['し', 'si', true], // 訓令式
    ['し', 'sx', false], // 妥当な綴りの前方一致でない
    ['ん', 'n', true],
    ['ん', 'nn', true],
    ['っ', 'xtu', true],
    ['きゃ', 'ky', true],
    ['きゃ', 'kya', true],
  ])('acceptsRomaji(%s, %s) === %s', (kana, input, expected) => {
    expect(acceptsRomaji(kana, input)).toBe(expected)
  })

  it('空入力は常に妥当（accepts:true）', () => {
    for (const kana of ['し', 'ん', 'っ', 'きゃ', 'あ']) {
      expect(acceptsRomaji(kana, '')).toBe(true)
    }
  })
})

describe('isKanaComplete（契約C: そのかなを打ち切ったか）', () => {
  it.each([
    ['し', '', false],
    ['し', 's', false],
    ['し', 'shi', true],
    ['し', 'si', true], // 訓令式でも完了
    ['し', 'sx', false],
    ['ん', 'n', false], // nn/n' で確定、単独 n は未完
    ['ん', 'nn', true],
    ['っ', 'xtu', true],
    ['きゃ', 'ky', false],
    ['きゃ', 'kya', true],
  ])('isKanaComplete(%s, %s) === %s', (kana, input, expected) => {
    expect(isKanaComplete(kana, input)).toBe(expected)
  })

  it('空入力は常に未完（complete:false）', () => {
    for (const kana of ['し', 'ん', 'っ', 'きゃ', 'あ']) {
      expect(isKanaComplete(kana, '')).toBe(false)
    }
  })
})
