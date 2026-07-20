// #439 道Y PR-A：受信側で本物盤面をローカル描画するための純ドメイン。
// TopFlow の表示単位（MaskedText/MaskedRuby の index）に一致するカーソルと、
// qIndex(=sentenceIndex) から対象 seg の配列 index を引く。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的・入力非破壊。答えの実文字を戻り値に一切含めない。
//   mirrorCursor({ seg, segInput })                 … TopFlow 表示単位のカーソル（en=空白込み char / ja=kanaConsumed）。
//   pickMirrorSegIndex(segments, qIndex, typedSide) … qIndex の対象 seg の配列 index（無ければ -1）。
import { kanaConsumed } from '@tll/core'

// 値を [lo, hi] に丸める（防御 clamp）。NaN/非数は lo に寄せる。
function clamp(n, lo, hi) {
  if (!(typeof n === 'number' && Number.isFinite(n))) return lo
  if (n < lo) return lo
  if (n > hi) return hi
  return n
}

// 契約②：受信側カーソル。typedSide=seg.type、TopFlow 表示単位で curPos を返す。
//   en：clamp([...prefix].length, 0, [...seg.en].length)＝空白込み char（MaskedText の index に一致）。
//   ja：clamp(kanaConsumed(seg.kana, prefix), 0, [...seg.kana].length)＝かな消費数（MaskedRuby の index に一致）。
// 戻り値は { typedSide, curPos } の2キーのみ＝綴り/かなの文字を一切含めない。
export function mirrorCursor({ seg, segInput }) {
  const typedSide = seg.type
  const input = typeof segInput === 'string' ? segInput : ''
  if (typedSide === 'ja') {
    const kana = typeof seg.kana === 'string' ? seg.kana : ''
    const kanaLen = [...kana].length
    const curPos = clamp(kanaConsumed(kana, input), 0, kanaLen)
    return { typedSide: 'ja', curPos }
  }
  // en：空白込みの char 数を、答え側の空白込み char 数で clamp。
  const en = typeof seg.en === 'string' ? seg.en : ''
  const enLen = [...en].length
  const curPos = clamp([...input].length, 0, enLen)
  return { typedSide: 'en', curPos }
}

// 契約③：qIndex(=sentenceIndex) の対象 seg の配列 index を返す（無ければ -1）。
//   sentenceIndex===qIndex かつ（type===typedSide または該当 sentenceIndex の seg が1本）を満たす index。
//   both は en/ja 2 本のうち typedSide 側を選ぶ。範囲外/typedSide 不正/非配列/空 → -1。入力非破壊。
export function pickMirrorSegIndex(segments, qIndex, typedSide) {
  if (!Array.isArray(segments) || segments.length === 0) return -1
  if (typedSide !== 'en' && typedSide !== 'ja') return -1
  // 該当 sentenceIndex の seg 群を収集（index 付き）。
  const hits = []
  for (let i = 0; i < segments.length; i++) {
    if (segments[i] && segments[i].sentenceIndex === qIndex) hits.push(i)
  }
  if (hits.length === 0) return -1
  // seg が1本なら type 不問でそれを選ぶ（単一言語）。複数なら type===typedSide を選ぶ（both）。
  if (hits.length === 1) return hits[0]
  for (const i of hits) {
    if (segments[i].type === typedSide) return i
  }
  return -1
}
