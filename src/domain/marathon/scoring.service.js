// マラソンの採点（速度・正確率・経過秒）。採点式は Score VO（records/score.vo.js）に一本化する。
// makeScore は {speed, accuracy, seconds} のみの凍結オブジェクトを返す＝既存の分割代入消費側と形状互換。
import { makeScore } from '../records/score.vo.js'

export function score(input) {
  return makeScore(input)
}
