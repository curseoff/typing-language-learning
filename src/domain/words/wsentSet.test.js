import { describe, it, expect } from 'vitest'
import { filterWsentByTheme } from './wsentSet.service.js'

// #390: 単語例文の「テーマ絞り」を domain の純関数へ集約する契約。
// 現行2箇所と挙動等価であること（バイト等価の式を pin）：
//   App.jsx:422                       theme === 'すべて' ? pool : pool.filter((s) => themeMap[s.word] === theme)
//   WordSentenceSection.container:53  theme === 'すべて' ? loaded.items : loaded.items.filter((s) => loaded.themes[s.word] === theme)
// 例文は theme を直接持たず、見出し語 word → theme の themeMap で絞る点が words/dict と異なる。

describe('filterWsentByTheme (#390 例文テーマ絞り)', () => {
  const pool = [
    { word: 'apple', text: 'I ate an apple.' },
    { word: 'travel', text: 'I love to travel.' },
    { word: 'invoice', text: 'Send the invoice.' },
  ]
  const themeMap = { apple: '日常', travel: '旅行', invoice: 'ビジネス' }

  it("theme='すべて' は pool をそのまま（同一参照で）返す", () => {
    // 現行 App.jsx:422 の素通り（filtered === pool）と一致させる。
    const out = filterWsentByTheme(pool, 'すべて', themeMap)
    expect(out).toBe(pool)
  })

  it('theme 指定時は themeMap で見出し語の theme が一致する要素だけを順序保持で残す', () => {
    const out = filterWsentByTheme(pool, '旅行', themeMap)
    expect(out).toEqual([{ word: 'travel', text: 'I love to travel.' }])
  })

  it('複数一致は入力順を保つ', () => {
    const many = [
      { word: 'apple', text: 'a' },
      { word: 'travel', text: 'b' },
      { word: 'orange', text: 'c' },
    ]
    const map = { apple: '日常', travel: '旅行', orange: '日常' }
    const out = filterWsentByTheme(many, '日常', map)
    expect(out).toEqual([
      { word: 'apple', text: 'a' },
      { word: 'orange', text: 'c' },
    ])
  })

  it('themeMap に無い見出し語の要素は除外される（undefined !== theme）', () => {
    const p = [
      { word: 'apple', text: 'a' },
      { word: 'unknown', text: 'u' }, // themeMap に無い
    ]
    const out = filterWsentByTheme(p, '日常', { apple: '日常' })
    expect(out).toEqual([{ word: 'apple', text: 'a' }])
  })

  it('空 pool は空を返す（すべて・指定とも）', () => {
    expect(filterWsentByTheme([], 'すべて', themeMap)).toEqual([])
    expect(filterWsentByTheme([], '旅行', themeMap)).toEqual([])
  })

  it('空 themeMap ＋ theme 指定は全除外で空を返す', () => {
    expect(filterWsentByTheme(pool, '旅行', {})).toEqual([])
  })

  it('決定的：同じ入力で同じ結果を返す', () => {
    const a = filterWsentByTheme(pool, 'ビジネス', themeMap)
    const b = filterWsentByTheme(pool, 'ビジネス', themeMap)
    expect(a).toEqual(b)
    expect(a).toEqual([{ word: 'invoice', text: 'Send the invoice.' }])
  })

  it('非破壊：入力 pool・themeMap を変更しない', () => {
    const p = [
      { word: 'apple', text: 'a' },
      { word: 'travel', text: 'b' },
    ]
    const pSnap = JSON.parse(JSON.stringify(p))
    const map = { apple: '日常', travel: '旅行' }
    const mapSnap = { ...map }
    filterWsentByTheme(p, '旅行', map)
    expect(p).toEqual(pSnap)
    expect(map).toEqual(mapSnap)
  })
})
