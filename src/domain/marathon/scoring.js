// マラソンの採点（速度・正確率・経過秒）。
export function score({ keys, mistakes, elapsedMs }) {
  const minutes = elapsedMs / 60000
  const speed = minutes > 0 ? Math.round(keys / minutes) : 0 // 打/分
  const denom = keys + mistakes
  const accuracy = denom > 0 ? Math.round((keys / denom) * 100) : 100
  const seconds = Math.round(elapsedMs / 100) / 10
  return { speed, accuracy, seconds }
}
