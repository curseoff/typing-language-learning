import { describe, it, expect } from 'vitest'
import { computeTickerFade, tickerMaskImage } from './tickerMask.js'

describe('computeTickerFade', () => {
  const trackW = 300

  it('計測前(空/幅0)は浅い端フェードに退避する', () => {
    expect(computeTickerFade([], 0)).toEqual({ fadeStart: 0, fadeEnd: 0 })
    expect(computeTickerFade(null, trackW)).toEqual({ fadeStart: 292, fadeEnd: 300 })
  })

  it('全ての語が収まるときはくっきり(浅い端フェードのみ)', () => {
    const boxes = [
      { left: 0, width: 80 },
      { left: 90, width: 80 },
      { left: 180, width: 80 }, // 右端 260 < 300
    ]
    expect(computeTickerFade(boxes, trackW)).toEqual({ fadeStart: 292, fadeEnd: 300 })
  })

  it('右端をはみ出す最初の語の左端(−gap/2)へフェード開始をスナップ', () => {
    const boxes = [
      { left: 0, width: 100 },
      { left: 110, width: 100 }, // 右端 210 収まる
      { left: 220, width: 100 }, // 右端 320 > 300 → これが入ってくる語
    ]
    // 220 - gap/2(5) = 215
    expect(computeTickerFade(boxes, trackW)).toEqual({ fadeStart: 215, fadeEnd: 300 })
  })

  it('収まる語(210)はフェードに巻き込まれない＝fadeStart は 210 より右', () => {
    const boxes = [
      { left: 0, width: 100 },
      { left: 110, width: 100 }, // 右端 210
      { left: 220, width: 100 }, // はみ出し
    ]
    const { fadeStart } = computeTickerFade(boxes, trackW)
    expect(fadeStart).toBeGreaterThanOrEqual(210)
  })

  it('gap オプションでスナップ位置の手前量を調整できる', () => {
    const boxes = [
      { left: 0, width: 100 },
      { left: 220, width: 100 },
    ]
    expect(computeTickerFade(boxes, trackW, { gap: 20 }).fadeStart).toBe(210) // 220 - 10
  })

  it('ビュー外(左端が trackWidth 以上)の語は入ってくる語とみなさない', () => {
    const boxes = [
      { left: 0, width: 100 },
      { left: 320, width: 100 }, // 完全に右外
    ]
    // 部分的に見えるはみ出し語が無い → 収まる扱い
    expect(computeTickerFade(boxes, trackW).fadeStart).toBe(292)
  })

  it('tickerMaskImage は mask 用の linear-gradient 文字列を返す', () => {
    const boxes = [
      { left: 0, width: 100 },
      { left: 220, width: 100 },
    ]
    expect(tickerMaskImage(boxes, trackW)).toBe(
      'linear-gradient(to right, #000 0, #000 215px, transparent 300px)'
    )
  })
})

// #108 回帰：狭幅で「現在アイテムの幅 > track 幅」になると、左端固定(left≤0)の
// 現在アイテムが「入ってくる語」と誤検出され fadeStart=0 に潰れ、いま打っている文が
// 全幅グラデで沈む。入ってくる語は「left>0 かつ右端 trackWidth を越える語」であるべき。
describe('computeTickerFade #108 現在アイテムが track 幅を超えるとき', () => {
  const trackW = 322

  it('ケースA: 左端固定(left=0)の現在アイテムが track 幅を超えても現在文を全幅で沈めない(fadeStart≠0)', () => {
    // 単語例文 both の1ペア = 665px が track 322px を越える実測ケース。
    // 右から入ってくる別アイテムは無いので、浅い右端フェード(trackWidth - edge)へ退避すべき。
    const boxes = [{ left: 0, width: 665 }]
    expect(computeTickerFade(boxes, trackW)).toEqual({ fadeStart: 314, fadeEnd: 322 })
  })

  it('ケースA(負の左端): スクロールで左へ流れた現在アイテム(left<0)でも fadeStart を 0 にしない', () => {
    // left が負でも「入ってくる語」ではない＝現在アイテムなので暗くしない。
    const boxes = [{ left: -120, width: 665 }]
    const { fadeStart } = computeTickerFade(boxes, trackW)
    expect(fadeStart).toBeGreaterThan(0)
    expect(fadeStart).toBe(314) // trackWidth - edge の浅い端フェードへ退避
  })

  it('ケースB(正常維持): left≤0 の現在アイテムがあっても、後続の left>0 の語が右端を越えればその左端へスナップ', () => {
    const boxes = [
      { left: -20, width: 80 }, // 現在アイテム(左へ流れ中・右端 60 は track 内)
      { left: 70, width: 100 }, // 右端 170 収まる
      { left: 180, width: 200 }, // 左端 180>0・右端 380>322 → 入ってくる語
    ]
    // 180 - gap/2(5) = 175 にスナップ（現在アイテムの left≤0 に引きずられない）
    expect(computeTickerFade(boxes, trackW).fadeStart).toBe(175)
  })
})

// #203 回帰：ticker+both で 2ペア目以降(現在アイテムの index≥1)の打ち始めに、
// 現在ペアの view-left が正(>0)になり、幅広だと右端も越えるため、現在アイテム自身が
// 「入ってくる語」と誤検出され fadeStart=left-gap/2 に潰れて現在文が沈む。
// entering 判定は「index > curIndex の後続語」に限定すべき（現在アイテム以前は除外）。
describe('computeTickerFade #203 現在アイテムの index≥1 で幅広のとき', () => {
  const trackW = 322

  it('curIndex を渡すと現在アイテム(index1)は entering 扱いされず、現在文が沈まない(浅い端フェード)', () => {
    // #203 実測: trackWidth=322, curIdx=1 frac=0 の現在ペア view-left=112.7・幅 665。
    const boxes = [
      { left: -560, width: 665 }, // index0: 左へ流れ去った過去ペア(right=105<322)
      { left: 112.7, width: 665 }, // index1: 現在ペア(right=777.7>322・幅広)
      { left: 787.7, width: 665 }, // index2: 未来ペア(left>trackWidth で画面外)
    ]
    const { fadeStart } = computeTickerFade(boxes, trackW, { curIndex: 1 })
    // 現在アイテムが entering と誤検出されると fadeStart≈112.7-5=107.7 で沈む。
    expect(fadeStart).not.toBeCloseTo(107.7)
    // 真の入場語は無い(index2 は画面外)ので、先読み無し相当の浅い端フェードへ退避。
    expect(fadeStart).toBeGreaterThan(300)
    expect(fadeStart).toBeCloseTo(314) // trackWidth - edge
  })

  it('curIndex 指定でも、現在より後(index>curIndex)の真の入場語にはスナップする', () => {
    const boxes = [
      { left: -560, width: 665 }, // index0: 過去ペア
      { left: 112.7, width: 665 }, // index1: 現在ペア(entering ではない)
      { left: 300, width: 665 }, // index2: 現在より後・left<322 かつ right>322 → 真の入場語
    ]
    const { fadeStart } = computeTickerFade(boxes, trackW, { curIndex: 1 })
    // 300 - gap/2(5) = 295 にスナップ。
    expect(fadeStart).toBeCloseTo(295)
  })

  it('後方互換: curIndex 未指定なら従来どおり全 box を対象に判定する', () => {
    const boxes = [
      { left: 0, width: 100 },
      { left: 110, width: 100 }, // 右端 210 収まる
      { left: 220, width: 100 }, // 右端 320>322... 実は 320<322 なので収まる
    ]
    // trackW=322 では index2 の右端 320<322 で収まる → 浅い端フェード。
    expect(computeTickerFade(boxes, trackW)).toEqual({ fadeStart: 314, fadeEnd: 322 })
  })
})
