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
