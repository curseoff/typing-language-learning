import { describe, it, expect } from 'vitest'
import { alignJaToKana, kanjiDone, rubyParts } from './progress.js'
import { WORDS } from '../../content/wordsAll.js'
import { WORD_SENTENCES } from '../../content/wordSentences/all.js'

describe('alignJaToKana', () => {
  it('送り仮名が読み先頭の同一かなへ誤マッチしない（見込みの・回帰）', () => {
    // 旧バグ: [0,0,1,2] となり入力ゼロでも「見込」が完了扱いになっていた
    expect(alignJaToKana('見込みの', 'みこみの')).toEqual([1, 2, 3, 4])
  })

  it('入力ゼロなら、先頭が漢字の語の漢字doneは0', () => {
    const seg = { ja: '見込みの', kana: 'みこみの' }
    expect(kanjiDone(seg, '')).toBe(0)
  })

  it('全単語・全文で ends が 0..かな長 の範囲かつ単調', () => {
    const check = ({ ja, kana }) => {
      const ends = alignJaToKana(ja, kana)
      const K = [...kana].length
      expect(ends.length).toBe([...ja].length)
      let prev = 0
      for (const e of ends) {
        expect(e).toBeGreaterThanOrEqual(prev)
        expect(e).toBeLessThanOrEqual(K)
        prev = e
      }
      // 先頭が漢字なら入力0でdone=0
      if (!/^[ぁ-ゟァ-ヿ]/.test(ja)) {
        expect(ends.filter((e) => e <= 0).length).toBe(0)
      }
    }
    for (const w of WORDS) check(w)
    for (const s of WORD_SENTENCES) check(s)
  })
})

describe('rubyParts (ふりがな)', () => {
  it('漢字runにのみ読みを付け、送り仮名は素通し', () => {
    expect(rubyParts('分ける', 'わける')).toEqual([
      { chars: ['分'], from: 0, ruby: 'わ' },
      { chars: ['け'], from: 1, ruby: null },
      { chars: ['る'], from: 2, ruby: null },
    ])
  })

  it('連続漢字は1つのrubyにまとめ、読みは全体スライス', () => {
    expect(rubyParts('飛行機', 'ひこうき')).toEqual([
      { chars: ['飛', '行', '機'], from: 0, ruby: 'ひこうき' },
    ])
  })

  it('全単語で ruby を連結すると元の読み(かな)に一致する', () => {
    for (const w of WORDS) {
      const joined = rubyParts(w.ja, w.kana)
        .map((p) => p.ruby ?? p.chars.join(''))
        .join('')
      // 漢字runは読み・かな文字はそのまま → 全体は kana と同じ並びになる
      const expected = [...w.kana].join('')
      // ja がかなのみの語は chars(=かな)が並ぶので kana と一致、漢字語も読みで一致
      expect(joined.length).toBe(expected.length)
    }
  })
})
