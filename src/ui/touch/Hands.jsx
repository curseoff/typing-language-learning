// 運指ガイドの手（キーボードの下に置く）。指の色はキーの指色（FINGER_COLOR）と対応。
// activeFinger（例 'li'）が来た指を強調し、ほかは少し沈める。
import { FINGER_COLOR } from '../../content/keyboard.js'

// 左手の指（小指→人差し指）。dx=手の中心からの左右位置, top=指先のy, len=長さ。
const FINGERS = [
  { f: 'p', dx: -115, top: 122, len: 92 }, // 小指
  { f: 'r', dx: -57, top: 80, len: 134 }, // 薬指
  { f: 'm', dx: 1, top: 60, len: 154 }, // 中指
  { f: 'i', dx: 59, top: 92, len: 122 }, // 人差し指
]
const FW = 46 // 指の幅
const STROKE = '#33312e'

function Hand({ prefix, cx, s, active }) {
  const pivotX = cx + s * 120 // 親指の付け根
  const pivotY = 250
  const dim = (on) => (active && !on ? 0.85 : 1)
  return (
    <g>
      {/* 手のひら */}
      <rect x={cx - 128} y={196} width={256} height={108} rx={46} fill="#fffdf8" stroke={STROKE} strokeWidth={2.5} />
      {/* 親指（スペース） */}
      <rect
        x={pivotX - 22}
        y={pivotY - 116}
        width={44}
        height={132}
        rx={22}
        fill={FINGER_COLOR.thumb}
        stroke={STROKE}
        strokeWidth={2.5}
        transform={`rotate(${s * 30} ${pivotX} ${pivotY})`}
      />
      {/* 4本指 */}
      {FINGERS.map(({ f, dx, top, len }) => {
        const key = prefix + f
        const on = active === key
        return (
          <rect
            key={f}
            x={cx + s * dx - FW / 2}
            y={top - (on ? 8 : 0)}
            width={FW}
            height={len + 60}
            rx={FW / 2}
            fill={FINGER_COLOR[key]}
            stroke={on ? '#1f2937' : STROKE}
            strokeWidth={on ? 4 : 2.5}
            opacity={dim(on)}
          />
        )
      })}
    </g>
  )
}

export default function Hands({ activeFinger }) {
  return (
    <svg className="touch-hands" viewBox="0 0 1000 320" role="img" aria-label="運指の手（指の色はキーの色に対応）">
      {/* 左手 / 右手のラベル */}
      <rect x={150} y={6} width={96} height={34} rx={17} fill="#3f8d7f" />
      <text x={198} y={30} textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700">左手</text>
      <rect x={754} y={6} width={96} height={34} rx={17} fill="#e8939b" />
      <text x={802} y={30} textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700">右手</text>

      <Hand prefix="l" cx={290} s={1} active={activeFinger} />
      <Hand prefix="r" cx={710} s={-1} active={activeFinger} />
    </svg>
  )
}
