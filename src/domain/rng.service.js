// シード付き擬似乱数生成器（mulberry32）。
// 同じ seed からは同じ乱数列を返す（決定的）＝記録の問題列を再現するのに使う。
// seed の生成（Math.random 等）は呼び出し側(UI)で行い、この層は純粋に保つ。
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
