// #370 dict/wsent の「見出し語 freq を結合して range スライスする」同型ロジックを集約する
// application 層の薄い純ヘルパ。副作用なし・React/DOM 非依存・入力非破壊。
// freq は単語データ側にあるため、見出し語(en/word)をキーに freqMap で結合してから
// domain の正準スライス（wordsInRangeBy）へ委ねる。
import { RANGE_SIZE, wordsInRangeBy } from '../domain/words/wordRange.service.js'

// 単語配列から Map(en→freq) を作る純関数（見出し語 freq 結合の索引）。
export const headwordFreqMap = (words) => new Map(words.map((w) => [w.en, w.freq]))

// entries（見出し語 word を持つ dict/wsent 相当）を freqMap で freq 結合し range スライスする。
// range==null は素通り（同一参照を返す）＝範囲未指定は全件出題。それ以外は正準順で 100 件区切り。
export function sliceByHeadwordFreq(entries, range, freqMap) {
  if (range == null) return entries
  return wordsInRangeBy(
    entries,
    range,
    RANGE_SIZE,
    (e) => freqMap.get(e.word) ?? null,
    (e) => e.word,
  )
}
