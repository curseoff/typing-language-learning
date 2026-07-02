// ティッカー右端フェードを「語境界」に合わせる純粋計算。
// 固定幅フェードだと、ほぼ収まっている語の末尾まで薄く切れて「私は夜に本…」のように
// 語が途中で欠けて見える。そこで「右端からはみ出す最初の語（＝入ってくる先読み語）」の
// 左端へフェード開始位置をスナップし、収まる語はくっきり／はみ出す語だけをゴースト化する。
//
// boxes: [{ left, width }] … いずれも track のビュー座標（offsetLeft + translateX）。
// trackWidth: track の可視幅(px)。
// 返り値: { fadeStart, fadeEnd } … right へ向かうグラデーションで
//   0..fadeStart は不透明、fadeStart..fadeEnd で透明へ。
export function computeTickerFade(boxes, trackWidth, { gap = 10, edge = 8 } = {}) {
  if (!Array.isArray(boxes) || !(trackWidth > 0)) {
    // 計測前などは従来相当のごく浅い右端フェードに退避。
    return { fadeStart: Math.max(0, trackWidth - edge), fadeEnd: trackWidth }
  }
  // 右端をはみ出す最初の「部分的に見えている」語を探す＝これが入ってくる先読み語。
  let entering = null
  for (const b of boxes) {
    if (!b) continue
    const right = b.left + b.width
    // 左端がビュー内にあり、右端が可視域を越える語。
    if (b.left < trackWidth && right > trackWidth) {
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
export function tickerMaskImage(boxes, trackWidth, opts) {
  const { fadeStart, fadeEnd } = computeTickerFade(boxes, trackWidth, opts)
  return `linear-gradient(to right, #000 0, #000 ${fadeStart}px, transparent ${fadeEnd}px)`
}
