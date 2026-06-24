// 入力エンジンのエッジ：翻訳モードのチップ生成・選択肢セグメント・分割ヘルパー。
import { describe, it, expect } from 'vitest'
import {
  buildUnits,
  enWords,
  jaPunct,
  choiceSeg,
  typingLang,
  segMatches,
} from './units.js'

const item = {
  en: 'I read a book.',
  ja: '私は本を読みます。',
  kana: 'わたしはほんをよみます。',
  jaWords: ['私', 'は', '本', 'を', '読み', 'ます'], // 末尾句読点を含まない
}

describe('enWords / jaPunct', () => {
  it('英文は語＋末尾記号を独立チップに分割', () => {
    expect(enWords('I read a book.')).toEqual(['I', 'read', 'a', 'book', '.'])
    expect(enWords('How are you?')).toEqual(['How', 'are', 'you', '?'])
    expect(enWords('go home')).toEqual(['go', 'home']) // 記号なし
  })
  it('和文末尾の句読点を取り出す', () => {
    expect(jaPunct('私は本を読みます。')).toBe('。')
    expect(jaPunct('今何時ですか？')).toBe('？')
    expect(jaPunct('走る')).toBeUndefined()
  })
})

describe('buildUnits 翻訳モード', () => {
  it('en-tr: 英訳セグメント＋語チップ（元語順index付き）', () => {
    const [s] = buildUnits(item, 'en-tr')
    expect(s.type).toBe('en')
    expect(s.translate).toBe(true)
    expect(s.words).toEqual(['I', 'read', 'a', 'book', '.'])
    // chips は {text,i} で、i の集合は 0..n-1（順不同でも全て揃う）
    expect(s.chips.map((c) => c.i).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
    expect(s.chips.map((c) => c.text).sort()).toEqual([...s.words].sort())
  })

  it('ja-tr: jaWords が末尾句読点を欠く時は補って ja を再構成できる', () => {
    const [s] = buildUnits(item, 'ja-tr')
    expect(s.type).toBe('ja')
    expect(s.translate).toBe(true)
    // words を連結すると ja（句読点込み）に一致する
    expect(s.words.join('')).toBe(item.ja)
    expect(s.words[s.words.length - 1]).toBe('。')
  })

  it('ja-tr: jaWords が無い場合は ja 全体を1チップにする', () => {
    const [s] = buildUnits({ en: 'x', ja: '走る', kana: 'はしる' }, 'ja-tr')
    expect(s.words).toEqual(['走る'])
  })
})

describe('choiceSeg / typingLang', () => {
  it('typingLang は ja/ja-tr で ja、それ以外は en', () => {
    expect(typingLang('ja')).toBe('ja')
    expect(typingLang('ja-tr')).toBe('ja')
    expect(typingLang('en')).toBe('en')
    expect(typingLang('both')).toBe('en')
    expect(typingLang('en-tr')).toBe('en')
  })
  it('choiceSeg は打つ言語に応じた非伏せセグメント', () => {
    expect(choiceSeg(item, 'ja').type).toBe('ja')
    expect(choiceSeg(item, 'en').type).toBe('en')
    expect(choiceSeg(item, 'ja').translate).toBe(false)
  })
})

describe('segMatches 前方一致', () => {
  it('空入力は常に一致（どの variant も先頭が空文字で始まる）', () => {
    const seg = buildUnits(item, 'en')[0]
    expect(segMatches(seg, '')).toBe(true)
  })
  it('英セグメントは大文字小文字を区別する', () => {
    const seg = buildUnits(item, 'en')[0] // 'I read a book.'
    expect(segMatches(seg, 'I')).toBe(true)
    expect(segMatches(seg, 'i')).toBe(false)
  })
})
