// #362 単語の固定範囲（range）を切り出す決定的な純ロジック wordRange.service の契約テスト。
// 対象は本ファイルの隣に coder が作る純関数群（rng 不使用・入力非破壊・決定的）。
// - numberedWords(pool): 正準順で安定ソートした新配列。
//     コンパレータ（全順序）: ①freq!=null が先（有り<無し）②freq 有り同士は freq 昇順（小=高頻度が先）
//     ③freq 同値/freq 無し同士は en 昇順。
// - wordsInRange(pool, rangeIndex, size=100): numberedWords の [(i-1)*size, i*size) スライス（i は 1 始まり）。
// - rangeCount(total, size=100): Math.ceil(total/size)。
// - rangeLabel(rangeIndex, size=100, total?): `${(i-1)*size+1}-${i*size}`。total 指定時は末尾を実長に。
// - poolForRange(words, level, theme, rangeIndex, size=100): strict な level×theme プール（空でも level 全体へ
//     フォールバックしない）に wordsInRange を当てる。
//
// 独立性の方針：コンパレータ内部を写経せず、順序の外形（freq 昇順・en タイブレーク・freq 無し末尾）と
// 範囲スライスの境界・網羅性・非破壊・決定性を固定する。
// 本体は未実装なので、この import で「正しい理由の Red（module not found）」になる（狙い）。
import { describe, it, expect } from 'vitest'
import {
  numberedWords,
  wordsInRange,
  rangeCount,
  rangeLabel,
  poolForRange,
} from './wordRange.service.js'

// freq を持つ/持たない語を作るヘルパー（freq は正の整数、省略で「freq 無し」）。
const W = (en, freq) => {
  const base = { en, ja: `${en}訳`, kana: 'あ', level: 1, theme: '日常' }
  return freq == null ? base : { ...base, freq }
}

describe('numberedWords（正準順の安定ソート）', () => {
  it('freq 有りは freq 昇順（小=高頻度が先）に並ぶ', () => {
    const pool = [W('take', 35), W('make', 30), W('come', 28)]
    expect(numberedWords(pool).map((w) => w.en)).toEqual(['come', 'make', 'take'])
  })

  it('freq 同値は en 昇順でタイブレークする', () => {
    const pool = [W('banana', 5), W('apple', 5)]
    expect(numberedWords(pool).map((w) => w.en)).toEqual(['apple', 'banana'])
  })

  it('freq 無しの語は末尾へ回し、末尾同士は en 昇順に並ぶ', () => {
    const pool = [W('zebra', null), W('ant', null), W('bee', 3)]
    expect(numberedWords(pool).map((w) => w.en)).toEqual(['bee', 'ant', 'zebra'])
  })

  it('freq 有りは freq 無しより必ず先に来る', () => {
    const pool = [W('zzz', null), W('apple', 10)]
    expect(numberedWords(pool).map((w) => w.en)).toEqual(['apple', 'zzz'])
  })

  it('空配列は空配列を返す', () => {
    expect(numberedWords([])).toEqual([])
  })

  it('単一要素はそのまま返す', () => {
    expect(numberedWords([W('solo', 7)]).map((w) => w.en)).toEqual(['solo'])
  })

  it('入力配列を破壊しない（非破壊・新配列を返す）', () => {
    const pool = [W('take', 35), W('make', 30), W('come', 28)]
    const before = pool.map((w) => w.en)
    const out = numberedWords(pool)
    expect(pool.map((w) => w.en)).toEqual(before) // 元配列は不変
    expect(out).not.toBe(pool) // 別インスタンス
  })

  it('同一入力で同一出力（決定的・rng 不使用）', () => {
    const pool = [W('take', 35), W('make', 30), W('come', 28), W('z', null)]
    expect(numberedWords(pool).map((w) => w.en)).toEqual(
      numberedWords(pool).map((w) => w.en),
    )
  })
})

describe('wordsInRange（1 始まりの固定範囲スライス）', () => {
  // freq を一意に振った 250 語（freq 昇順＝word000..word249 の順に安定化する）。
  const many = Array.from({ length: 250 }, (_, i) =>
    W(`word${String(i).padStart(3, '0')}`, i + 1),
  )

  it('rangeIndex=1 は先頭 100 語（1..100）', () => {
    const r1 = wordsInRange(many, 1)
    expect(r1).toHaveLength(100)
    expect(r1[0].en).toBe('word000')
    expect(r1[99].en).toBe('word099')
  })

  it('rangeIndex=3 は端数の 50 語（201..250）', () => {
    const r3 = wordsInRange(many, 3)
    expect(r3).toHaveLength(50)
    expect(r3[0].en).toBe('word200')
    expect(r3[49].en).toBe('word249')
  })

  it('範囲外の rangeIndex（=4）は空配列', () => {
    expect(wordsInRange(many, 4)).toEqual([])
  })

  it('rangeIndex=0・負値は空配列', () => {
    expect(wordsInRange(many, 0)).toEqual([])
    expect(wordsInRange(many, -1)).toEqual([])
  })

  it('非整数の rangeIndex（1.5）は空配列', () => {
    expect(wordsInRange(many, 1.5)).toEqual([])
  })

  it('空 pool は空配列', () => {
    expect(wordsInRange([], 1)).toEqual([])
  })

  it('size を明示できる（size=100 と既定が一致）', () => {
    expect(wordsInRange(many, 2, 100).map((w) => w.en)).toEqual(
      wordsInRange(many, 2).map((w) => w.en),
    )
  })

  it('全 range を連結すると numberedWords(pool) 全体に一致する（網羅性・重複/欠落なし）', () => {
    const cnt = rangeCount(many.length)
    const concat = []
    for (let i = 1; i <= cnt; i++) concat.push(...wordsInRange(many, i))
    expect(concat.map((w) => w.en)).toEqual(numberedWords(many).map((w) => w.en))
  })
})

describe('rangeCount（総数から範囲数を導く）', () => {
  it('total=0 は 0', () => {
    expect(rangeCount(0)).toBe(0)
  })

  it('total=250, size=100 は 3（端数繰り上げ）', () => {
    expect(rangeCount(250, 100)).toBe(3)
  })

  it('total=100, size=100 は 1（ちょうど）', () => {
    expect(rangeCount(100, 100)).toBe(1)
  })
})

describe('rangeLabel（範囲の表示ラベル）', () => {
  it('既定 size=100 で 2 → "101-200"', () => {
    expect(rangeLabel(2)).toBe('101-200')
  })

  it('1 → "1-100"', () => {
    expect(rangeLabel(1)).toBe('1-100')
  })

  it('total 指定時は末尾範囲を実長に丸める（3,100,250 → "201-250"）', () => {
    expect(rangeLabel(3, 100, 250)).toBe('201-250')
  })

  it('total 指定でも末尾でない範囲は full 幅（1,100,250 → "1-100"）', () => {
    expect(rangeLabel(1, 100, 250)).toBe('1-100')
  })
})

describe('poolForRange（strict な level×theme に範囲を当てる）', () => {
  const words = [
    { en: 'aaa', ja: 'a訳', kana: 'あ', level: 1, theme: '日常', freq: 10 },
    { en: 'bbb', ja: 'b訳', kana: 'い', level: 1, theme: '日常', freq: 5 },
    { en: 'ccc', ja: 'c訳', kana: 'う', level: 1, theme: '旅行', freq: 8 },
    { en: 'ddd', ja: 'd訳', kana: 'え', level: 2, theme: '日常', freq: 3 },
  ]

  it('level1/日常 の range1 が freq 昇順で切り出される', () => {
    expect(poolForRange(words, 1, '日常', 1).map((w) => w.en)).toEqual(['bbb', 'aaa'])
  })

  it("theme='すべて' は level 全体（全テーマ）を freq 昇順で切り出す", () => {
    expect(poolForRange(words, 1, 'すべて', 1).map((w) => w.en)).toEqual([
      'bbb',
      'ccc',
      'aaa',
    ])
  })

  it('該当 0 語（level に無い）は空配列', () => {
    expect(poolForRange(words, 3, '日常', 1)).toEqual([])
  })

  it('strict：level×theme が空でも level 全体へフォールバックせず空配列を返す', () => {
    // level1 に語はあるが theme=ビジネスは無い → strict なので [] （levelThemePool と違い level 全体に落ちない）
    expect(poolForRange(words, 1, 'ビジネス', 1)).toEqual([])
  })
})
