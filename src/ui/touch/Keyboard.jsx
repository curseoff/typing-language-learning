// キーボード表示。指ごとに色分け、ホームポジションに印、打つべきキーをハイライト。
// 刻印は JIS 日本語キーボード（実機）を参照に、英字（主）＋ JIS かな（右下）＋ シフト記号（上）を表示。
import {
  KEY_ROWS,
  KEY_LEGENDS,
  ROW_OFFSET,
  DISPLAY_ONLY_KEYS,
  FINGER,
  HOME_KEYS,
  BUMP_KEYS,
} from '../../content/keyboard.js'

// 数字段・記号キーは英字キーと違って main が大きい一文字でないため、刻印の出し分けに使う。
const ALPHA = /^[a-z]$/

function KeyCap({ k, target, hasError }) {
  const legend = KEY_LEGENDS[k] ?? {}
  const isTarget = k === target
  const isDisplayOnly = DISPLAY_ONLY_KEYS.includes(k)

  let cls = `kb-key fg-${FINGER[k]}`
  if (HOME_KEYS.includes(k)) cls += ' home'
  if (BUMP_KEYS.includes(k)) cls += ' bump'
  if (isDisplayOnly) cls += ' display-only'
  if (isTarget) cls += hasError ? ' target err' : ' target'

  // 主たる刻印（英字は大文字、その他はキーの記号そのまま）
  const main = ALPHA.test(k) ? k.toUpperCase() : k

  return (
    <div className={cls}>
      {legend.shift ? <span className="kb-shift">{legend.shift}</span> : null}
      <span className="kb-main">{main}</span>
      {legend.kanaSmall ? <span className="kb-kana-small">{legend.kanaSmall}</span> : null}
      {legend.kana ? <span className="kb-kana">{legend.kana}</span> : null}
    </div>
  )
}

export default function Keyboard({ target, hasError }) {
  return (
    <div className="kb">
      {KEY_ROWS.map((row, r) => (
        <div key={r} className="kb-row" style={{ marginLeft: ROW_OFFSET[r] ?? 0 }}>
          {row.map((k) => (
            <KeyCap key={k} k={k} target={target} hasError={hasError} />
          ))}
        </div>
      ))}
    </div>
  )
}
