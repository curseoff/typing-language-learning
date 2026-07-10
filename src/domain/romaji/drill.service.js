// ローマ字入力練習の出題列生成（かな集合から N 個、同かな連続は避ける）。
// 要素非依存な buildDrill（touch/drill.service.js）に委譲する＝多字かな（きゃ 等）も1単位として扱える。
import { buildDrill } from '../touch/drill.service.js'

export const KANA_DRILL_COUNT = 40

export function buildKanaDrill(kanaSet, count = KANA_DRILL_COUNT, { rng = Math.random } = {}) {
  return buildDrill(kanaSet, count, { rng })
}
