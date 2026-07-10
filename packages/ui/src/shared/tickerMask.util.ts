// ティッカー右端フェードを「語境界」に合わせる純粋計算。
// 固定幅フェードだと、ほぼ収まっている語の末尾まで薄く切れて「私は夜に本…」のように
// 語が途中で欠けて見える。そこで「右端からはみ出す最初の語（＝入ってくる先読み語）」の
// 左端へフェード開始位置をスナップし、収まる語はくっきり／はみ出す語だけをゴースト化する。
//
// boxes: [{ left, width }] … いずれも track のビュー座標（offsetLeft + translateX）。
// trackWidth: track の可視幅(px)。
// 返り値: { fadeStart, fadeEnd } … right へ向かうグラデーションで
//   0..fadeStart は不透明、fadeStart..fadeEnd で透明へ。
export interface TickerBox {
  left: number
  width: number
}

export interface TickerFadeOpts {
  gap?: number
  edge?: number
  curIndex?: number
}

export interface TickerFade {
  fadeStart: number
  fadeEnd: number
}

export function computeTickerFade(
  boxes: TickerBox[] | null | undefined,
  trackWidth: number,
  { gap = 10, edge = 8, curIndex = -1 }: TickerFadeOpts = {},
): TickerFade {
  if (!Array.isArray(boxes) || !(trackWidth > 0)) {
    // 計測前などは従来相当のごく浅い右端フェードに退避。
    return { fadeStart: Math.max(0, trackWidth - edge), fadeEnd: trackWidth }
  }
  // 右端をはみ出す最初の「右から入ってくる先読み語」を探す。
  // 現在アイテムは左端固定(left≤0)で、狭幅だと幅 > track になり右端も越えるが、
  // これは「入ってくる語」ではない（#108: 誤検出すると fadeStart=0 で現在文が全幅で沈む）。
  // よって left>0 かつ 右端が可視域を越える後続語だけを entering とみなす。
  // #203: 現在アイテム(index=curIndex)は 2 ペア目以降で view-left が正になり、
  // 幅広だと右端も越えるため entering と誤検出されうる。現在アイテムおよびそれ以前
  // (idx ≤ curIndex)は入場語ではないので探索から除外する（既定 -1 なら全 box が対象）。
  let entering: TickerBox | null = null
  for (let idx = 0; idx < boxes.length; idx++) {
    const b = boxes[idx]
    if (!b) continue
    if (idx <= curIndex) continue
    const right = b.left + b.width
    // 左端がビュー内の正の位置にあり、右端が可視域を越える語。
    if (b.left > 0 && b.left < trackWidth && right > trackWidth) {
      entering = b
      break
    }
  }
  if (!entering) {
    // すべて収まる（先読みが無い）＝くっきり見せる。ごく浅い端フェードだけ残す。
    return { fadeStart: Math.max(0, trackWidth - edge), fadeEnd: trackWidth }
  }
  // 収まる語はくっきり見せたいので、語間ギャップの半分だけ手前からフェード開始。
  const fadeStart = Math.min(Math.max(0, entering.left - gap / 2), trackWidth)
  return { fadeStart, fadeEnd: trackWidth }
}

// computeTickerFade の結果を CSS の mask-image 文字列に変換する。
export function tickerMaskImage(
  boxes: TickerBox[] | null | undefined,
  trackWidth: number,
  opts?: TickerFadeOpts,
): string {
  const { fadeStart, fadeEnd } = computeTickerFade(boxes, trackWidth, opts)
  return `linear-gradient(to right, #000 0, #000 ${fadeStart}px, transparent ${fadeEnd}px)`
}
