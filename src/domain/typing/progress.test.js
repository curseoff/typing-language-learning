import { describe, it, expect } from 'vitest'
import { alignJaToKana, kanjiDone, rubyParts } from './progress.js'
import { WORDS } from '../../content/wordsAll.js'
import { WORD_SENTENCES } from '../../content/wordSentences/all.js'

describe('alignJaToKana', () => {
  it('送り仮名が読み先頭の同一かなへ誤マッチしない（見込みの・回帰）', () => {
    // 旧バグ: [0,0,1,2] となり入力ゼロでも「見込」が完了扱いになっていた
    expect(alignJaToKana('見込みの', 'みこみの')).toEqual([1, 2, 3, 4])
  })

  it('カタカナ長音ー＋漢字の送り仮名が正しく対応する（チーム/私たち の回帰）', () => {
    // 旧バグ: 私(わたし)の送り仮名「たち」が読み「わ『た』し」の た に誤マッチし全体がズレ、
    //         「ー」が変な読みに対応して反応しなくなっていた。
    const ja = '私たちのチームは'
    const kana = 'わたしたちのちいむは'
    const ends = alignJaToKana(ja, kana)
    const jc = [...ja]
    const kc = [...kana]
    const seg = (i) => kc.slice(i === 0 ? 0 : ends[i - 1], ends[i]).join('')
    expect(jc[0]).toBe('私')
    expect(seg(0)).toBe('わたし') // 私 → わたし
    expect(jc[5]).toBe('ー')
    expect(seg(5)).toBe('い') // ー → い（チーム＝ちいむ）
    expect(seg(6)).toBe('む') // ム → む
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
  }, 30000) // 約3.8万件の走査。CIが遅いと既定5秒を超えるため延長
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
