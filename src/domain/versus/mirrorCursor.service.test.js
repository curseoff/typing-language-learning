import { describe, it, expect } from 'vitest'
// #439 道Y PR-A：受信側で本物盤面をローカル描画するための純ドメイン。
// 本体 src/domain/versus/mirrorCursor.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的・入力非破壊。答えの実文字を戻り値に一切含めない。
//   mirrorCursor({ seg, segInput })                       … TopFlow 表示単位のカーソル（en=空白込み char / ja=kanaConsumed）。
//   pickMirrorSegIndex(segments, qIndex, typedSide)       … qIndex(=sentenceIndex) の対象 seg の配列 index（無ければ -1）。
import { mirrorCursor, pickMirrorSegIndex } from './mirrorCursor.service.js'

// ============================================================================
// 契約②（§7）mirrorCursor：typedSide=seg.type、TopFlow 表示単位で curPos を返す。
//   en：curPos = clamp([...prefix].length, 0, [...seg.en].length)  ＝空白込み char。
//   ja：curPos = clamp(kanaConsumed(seg.kana, prefix), 0, [...seg.kana].length)。
//   ※ 既存 boardCursor（方式B・非空白 char）とは別関数＝空白の数え方が異なる。
// ============================================================================
describe('mirrorCursor（#439道Y・受信側カーソル：typedSide/curPos）', () => {
  it('en：空白を数える（en="to go" / prefix="to " → curPos:3）', () => {
    // MaskedText は seg.en を空白込み index で色付けするため、空白も1文字として進める。
    const seg = { type: 'en', en: 'to go' }
    expect(mirrorCursor({ seg, segInput: 'to ' })).toEqual({ typedSide: 'en', curPos: 3 })
  })

  it('en：語頭のみは打鍵 char 数（en="to go" / prefix="to" → curPos:2）', () => {
    const seg = { type: 'en', en: 'to go' }
    expect(mirrorCursor({ seg, segInput: 'to' })).toEqual({ typedSide: 'en', curPos: 2 })
  })

  it('en：完了は空白込みの総 char 数（en="to go" 完了 → curPos:5）', () => {
    const seg = { type: 'en', en: 'to go' }
    expect(mirrorCursor({ seg, segInput: 'to go' })).toEqual({ typedSide: 'en', curPos: 5 })
  })

  it('en：過入力は en 長（空白込み）で上限 clamp（en="to go" / prefix="to going" → curPos:5）', () => {
    // [...'to going'].length=8 だが seg.en 長=5 で clamp。
    const seg = { type: 'en', en: 'to go' }
    expect(mirrorCursor({ seg, segInput: 'to going' })).toEqual({ typedSide: 'en', curPos: 5 })
  })

  it('en：未打鍵は curPos:0', () => {
    const seg = { type: 'en', en: 'to go' }
    expect(mirrorCursor({ seg, segInput: '' })).toEqual({ typedSide: 'en', curPos: 0 })
  })

  it('ja：kanaConsumed で数える（kana="たいよう" / prefix="taiyo" → curPos:3＝た・い・よ）', () => {
    const seg = { type: 'ja', ja: '太陽', kana: 'たいよう' }
    expect(mirrorCursor({ seg, segInput: 'taiyo' })).toEqual({ typedSide: 'ja', curPos: 3 })
  })

  it('ja：途中打鍵は kanaConsumed（kana="たいよう" / prefix="tai" → curPos:2＝た・い）', () => {
    const seg = { type: 'ja', ja: '太陽', kana: 'たいよう' }
    expect(mirrorCursor({ seg, segInput: 'tai' })).toEqual({ typedSide: 'ja', curPos: 2 })
  })

  it('ja：完了は kana 長（kana="たいよう" 完了 → curPos:4）', () => {
    const seg = { type: 'ja', ja: '太陽', kana: 'たいよう' }
    expect(mirrorCursor({ seg, segInput: 'taiyou' })).toEqual({ typedSide: 'ja', curPos: 4 })
  })

  it('ja：kana 欠落は curPos:0（かな長0で clamp）', () => {
    const seg = { type: 'ja', ja: '太陽' }
    expect(mirrorCursor({ seg, segInput: 'taiyo' })).toEqual({ typedSide: 'ja', curPos: 0 })
  })

  it('segInput=undefined は curPos:0（en）', () => {
    const seg = { type: 'en', en: 'to go' }
    expect(mirrorCursor({ seg, segInput: undefined })).toEqual({ typedSide: 'en', curPos: 0 })
  })

  it('segInput=null は curPos:0（ja）', () => {
    const seg = { type: 'ja', ja: '太陽', kana: 'たいよう' }
    expect(mirrorCursor({ seg, segInput: null })).toEqual({ typedSide: 'ja', curPos: 0 })
  })

  it('戻り値は { typedSide, curPos } の2キーのみ＝実文字（en/kana）を含めない', () => {
    const seg = { type: 'en', en: 'to go' }
    const out = mirrorCursor({ seg, segInput: 'to ' })
    expect(Object.keys(out).sort()).toEqual(['curPos', 'typedSide'])
  })

  it('入力を破壊しない（seg/segInput 非変更）', () => {
    const seg = { type: 'en', en: 'to go' }
    const frozen = Object.freeze({ ...seg })
    mirrorCursor({ seg: frozen, segInput: 'to ' })
    expect(frozen).toEqual({ type: 'en', en: 'to go' })
  })
})

// ============================================================================
// 契約③（§7）pickMirrorSegIndex：sentenceIndex===qIndex かつ
//   （type===typedSide または単一言語で seg が1本）を満たす配列 index。無ければ -1。
//   both は en/ja 2 本のうち typedSide 側を選ぶ。
// ============================================================================
describe('pickMirrorSegIndex（#439道Y・qIndex の対象 seg index）', () => {
  // both モード：各 sentenceIndex に en/ja の2 seg（en が先、ja が後）。
  const bothSegs = [
    { sentenceIndex: 0, type: 'en', en: 'a' },
    { sentenceIndex: 0, type: 'ja', kana: 'あ' },
    { sentenceIndex: 1, type: 'en', en: 'b' },
    { sentenceIndex: 1, type: 'ja', kana: 'い' },
    { sentenceIndex: 2, type: 'en', en: 'c' }, // idx4
    { sentenceIndex: 2, type: 'ja', kana: 'う' }, // idx5
  ]
  // 単一言語（en）モード：各 sentenceIndex に1 seg。
  const singleEnSegs = [
    { sentenceIndex: 0, type: 'en', en: 'a' },
    { sentenceIndex: 1, type: 'en', en: 'b' },
    { sentenceIndex: 2, type: 'en', en: 'c' },
    { sentenceIndex: 3, type: 'en', en: 'd' }, // idx3
  ]

  it('both：qIndex=2/typedSide="ja" は ja 側 index（→5）を選ぶ', () => {
    expect(pickMirrorSegIndex(bothSegs, 2, 'ja')).toBe(5)
  })

  it('both：qIndex=2/typedSide="en" は en 側 index（→4）を選ぶ', () => {
    expect(pickMirrorSegIndex(bothSegs, 2, 'en')).toBe(4)
  })

  it('単一言語：qIndex=3 の唯一 seg の index（→3）を返す', () => {
    expect(pickMirrorSegIndex(singleEnSegs, 3, 'en')).toBe(3)
  })

  it('単一言語：seg が1本なら type と typedSide が食い違っても選ぶ（en seg / typedSide="ja" → 3）', () => {
    // 契約：「type===typedSide または単一言語で seg が1本」の OR 分岐。
    expect(pickMirrorSegIndex(singleEnSegs, 3, 'ja')).toBe(3)
  })

  it('qIndex がバッチ外は -1（both / qIndex=999）', () => {
    expect(pickMirrorSegIndex(bothSegs, 999, 'en')).toBe(-1)
  })

  it('typedSide が不正（en/ja 以外）は -1', () => {
    expect(pickMirrorSegIndex(bothSegs, 2, 'xx')).toBe(-1)
  })

  it('空配列は -1', () => {
    expect(pickMirrorSegIndex([], 0, 'en')).toBe(-1)
  })

  it('入力（segments）を破壊しない', () => {
    const segs = bothSegs.map((s) => ({ ...s }))
    const snapshot = JSON.stringify(segs)
    pickMirrorSegIndex(segs, 2, 'ja')
    expect(JSON.stringify(segs)).toBe(snapshot)
  })
})
