// キーボード表示。指ごとに色分け、ホームポジションに印、打つべきキーをハイライト。
import { KEY_ROWS, FINGER, HOME_KEYS } from '../../content/keyboard.js'

export default function Keyboard({ target, hasError }) {
  return (
    <div className="kb">
      {KEY_ROWS.map((row, r) => (
        <div key={r} className="kb-row">
          {row.map((k) => {
            const isTarget = k === target
            let cls = `kb-key fg-${FINGER[k]}`
            if (HOME_KEYS.includes(k)) cls += ' home'
            if (isTarget) cls += hasError ? ' target err' : ' target'
            return (
              <div key={k} className={cls}>
                {k.toUpperCase()}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
