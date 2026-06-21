import { describe, it, expect } from 'vitest'
import { alignJaToKana, kanjiDone } from './progress.js'
import { WORDS } from '../../content/words.js'
import { SENTENCES } from '../../content/sentences.js'

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
    for (const s of SENTENCES) check(s)
  })
})
