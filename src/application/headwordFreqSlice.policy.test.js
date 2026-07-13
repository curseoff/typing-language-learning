// #370 dict/wsent の「見出し語 freq を結合して range スライスする」同型ロジックを
// application 層の薄い純ヘルパへ集約する契約テスト（Red 先行）。
// 対象は未実装の src/application/headwordFreqSlice.policy.js の 2 export：
//   - headwordFreqMap(words): Map(en→freq) を返す純関数（= new Map(words.map(w=>[w.en,w.freq])) 相当）
//   - sliceByHeadwordFreq(entries, range, freqMap): range==null は素通り、
//     それ以外は domain の wordsInRangeBy(entries, range, RANGE_SIZE,
//       (e)=>freqMap.get(e.word)??null, (e)=>e.word) と完全一致。
// 検証するのは「振る舞い（入出力・境界・決定性）」であり内部実装ではない。
import { describe, it, expect } from 'vitest'
import { RANGE_SIZE, wordsInRangeBy } from '../domain/words/wordRange.service.js'
import { headwordFreqMap, sliceByHeadwordFreq } from './headwordFreqSlice.policy.js'

// domain の正準スライスを直接呼ぶ参照実装（一致検証の基準）。
const refSlice = (entries, range, freqMap) =>
  wordsInRangeBy(
    entries,
    range,
    RANGE_SIZE,
    (e) => freqMap.get(e.word) ?? null,
    (e) => e.word,
  )

describe('headwordFreqMap（単語配列から Map(en→freq) を作る純関数）', () => {
  it('en をキー・freq を値にした Map を返す', () => {
    expect(headwordFreqMap([{ en: 'a', freq: 3 }, { en: 'b', freq: 1 }])).toEqual(
      new Map([
        ['a', 3],
        ['b', 1],
      ]),
    )
  })

  it('空配列なら空の Map を返す', () => {
    expect(headwordFreqMap([])).toEqual(new Map())
  })
})

describe('sliceByHeadwordFreq（見出し語 freq を結合して range スライスする純ヘルパ）', () => {
  // 見出し語 word を持つ dict/wsent 相当の entries。freq は freqMap 側で結合する。
  const entries = [
    { word: 'delta', text: 'd1' },
    { word: 'alpha', text: 'a1' },
    { word: 'charlie', text: 'c1' },
    { word: 'bravo', text: 'b1' },
    { word: 'echo', text: 'e1' }, // freqMap に無い → freq 欠落（null 扱い）を含める
  ]
  const freqMap = new Map([
    ['alpha', 10],
    ['bravo', 20],
    ['charlie', 30],
    ['delta', 40],
    // 'echo' は意図的に欠落
  ])

  it('range=1 のとき wordsInRangeBy と完全一致する', () => {
    expect(sliceByHeadwordFreq(entries, 1, freqMap)).toEqual(refSlice(entries, 1, freqMap))
  })

  it('range=2 のとき wordsInRangeBy と完全一致する', () => {
    expect(sliceByHeadwordFreq(entries, 2, freqMap)).toEqual(refSlice(entries, 2, freqMap))
  })

  it('freq 欠落(freqMap に無い word)を含む entries でも wordsInRangeBy の順序規則どおりに並ぶ', () => {
    // echo は freq 無し → 正準順では「freq 有り」より後ろ・欠落同士は word 昇順。
    const got = sliceByHeadwordFreq(entries, 1, freqMap)
    expect(got).toEqual(refSlice(entries, 1, freqMap))
    // 参照実装に委ねつつ、freq 欠落 entry が末尾側に来ることも明示（回帰固定）。
    expect(got[got.length - 1].word).toBe('echo')
  })

  it('range==null のときは entries をそのまま返す（素通り）', () => {
    expect(sliceByHeadwordFreq(entries, null, freqMap)).toBe(entries)
  })

  it('同じ (entries, range, freqMap) を2回呼ぶと同じ結果になる（決定的＝preview と実出題の同一性）', () => {
    const first = sliceByHeadwordFreq(entries, 1, freqMap)
    const second = sliceByHeadwordFreq(entries, 1, freqMap)
    expect(first).toEqual(second)
  })

  it('RANGE_SIZE=100 の境界: range=2 は 101 件目以降を取り wordsInRangeBy と一致する', () => {
    expect(RANGE_SIZE).toBe(100)
    // freq 昇順で並ぶよう freq=連番、word は一意キーとして付与。
    const many = Array.from({ length: 150 }, (_, i) => ({ word: `w${String(i).padStart(3, '0')}` }))
    const fm = new Map(many.map((e, i) => [e.word, i]))
    const got = sliceByHeadwordFreq(many, 2, fm)
    expect(got).toEqual(refSlice(many, 2, fm))
    expect(got).toHaveLength(50) // 150 - 100 = 51件目..150件目 → 50件
  })
})
