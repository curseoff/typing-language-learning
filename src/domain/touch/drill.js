// タッチタイピングの出題列生成（キー集合からランダムにN打、同キー連続は避ける）。
export const TOUCH_COUNT = 40

export function buildDrill(keys, count = TOUCH_COUNT) {
  const out = []
  let prev = null
  for (let i = 0; i < count; i++) {
    let k = keys[Math.floor(Math.random() * keys.length)]
    if (keys.length > 1) {
      let guard = 0
      while (k === prev && guard < 5) {
        k = keys[Math.floor(Math.random() * keys.length)]
        guard++
      }
    }
    out.push(k)
    prev = k
  }
  return out
}
