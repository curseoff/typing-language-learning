// 運指ガイドの手（キーボードの下）。手描きイラスト風：有機的な指・ラフな輪郭・
// 指先に色がのって付け根で白へフェード。指の色はキーの指色（FINGER_COLOR）と対応。
// activeFinger（例 'li'）の指を強調する。
import { FINGER_COLOR } from '../../content/keyboard.js'

// 指/親指のカプセル形。base=付け根（平ら）, tip=指先（丸い）。outline=true は底辺を開けた線用。
function capsule([bx, by], [tx, ty], w, outline) {
  const hw = w / 2
  let dx = tx - bx
  let dy = ty - by
  const len = Math.hypot(dx, dy) || 1
  dx /= len
  dy /= len
  const nx = -dy
  const ny = dx
  const bL = [bx + nx * hw, by + ny * hw]
  const bR = [bx - nx * hw, by - ny * hw]
  const tL = [tx + nx * hw, ty + ny * hw]
  const tR = [tx - nx * hw, ty - ny * hw]
  const k = hw * 1.4 // 指先の丸みを前方へ膨らませる量
  const c1 = [tL[0] + dx * k, tL[1] + dy * k]
  const c2 = [tR[0] + dx * k, tR[1] + dy * k]
  const d = `M ${bL[0]} ${bL[1]} L ${tL[0]} ${tL[1]} C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${tR[0]} ${tR[1]} L ${bR[0]} ${bR[1]}`
  return outline ? d : `${d} Z`
}

// 左手のローカル座標（右手は scale(-1,1) で反転）。
const FINGERS = [
  { f: 'p', base: [92, 300], tip: [74, 150], w: 52 }, // 小指
  { f: 'r', base: [150, 292], tip: [150, 64], w: 58 }, // 薬指
  { f: 'm', base: [206, 290], tip: [214, 42], w: 60 }, // 中指
  { f: 'i', base: [262, 294], tip: [292, 96], w: 58 }, // 人差し指
]
const THUMB = { base: [296, 292], tip: [366, 356], w: 58 } // 親指
const PALM = 'M 74 292 C 54 350, 62 420, 142 442 C 218 462, 306 446, 340 372 C 356 338, 344 290, 314 296 Z'
const WRIST = 'M 66 300 C 44 356, 56 424, 142 446 C 220 466, 310 448, 344 372'
const PAPER = '#fffdf8'
const INK = '#3a3733'

function Hand({ prefix, active, place }) {
  const fill = (key) => (key === active ? FINGER_COLOR[key] : `url(#grad-${key.slice(1)})`)
  const sw = (key) => (key === active ? 8 : 6)
  const op = (key) => (active && key !== active ? 0.9 : 1)
  return (
    <g transform={place} filter="url(#rough-hand)">
      {/* 手のひら（白） */}
      <path d={PALM} fill={PAPER} />
      {/* 指の色（付け根で白へフェード） */}
      {FINGERS.map(({ f, base, tip, w }) => (
        <path key={`f${f}`} d={capsule(base, tip, w, false)} fill={fill(prefix + f)} opacity={op(prefix + f)} />
      ))}
      <path d={capsule(THUMB.base, THUMB.tip, THUMB.w, false)} fill="url(#grad-thumb)" />
      {/* 輪郭（底辺は開けて手のひらと一体に見せる） */}
      {FINGERS.map(({ f, base, tip, w }) => (
        <path
          key={`o${f}`}
          d={capsule(base, tip, w, true)}
          fill="none"
          stroke={INK}
          strokeWidth={sw(prefix + f)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      <path
        d={capsule(THUMB.base, THUMB.tip, THUMB.w, true)}
        fill="none"
        stroke={INK}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 手首・手のひら外周 */}
      <path d={WRIST} fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

export default function Hands({ activeFinger }) {
  return (
    <svg className="touch-hands" viewBox="0 0 1000 480" role="img" aria-label="運指の手（指の色はキーの色に対応）">
      <defs>
        {/* 指ごとの縦グラデーション：指先=色 → 付け根=白 */}
        {[
          ['p', FINGER_COLOR.lp],
          ['r', FINGER_COLOR.lr],
          ['m', FINGER_COLOR.lm],
          ['i', FINGER_COLOR.li],
          ['thumb', FINGER_COLOR.thumb],
        ].map(([id, c]) => (
          <linearGradient key={id} id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c} />
            <stop offset="0.62" stopColor={c} />
            <stop offset="1" stopColor={PAPER} />
          </linearGradient>
        ))}
        {/* 手描き風のゆらぎ */}
        <filter id="rough-hand" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4" />
        </filter>
      </defs>

      {/* 左手 / 右手のラベル */}
      <rect x={196} y={6} width={96} height={34} rx={17} fill="#3f8d7f" />
      <text x={244} y={30} textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700">左手</text>
      <rect x={708} y={6} width={96} height={34} rx={17} fill="#e8939b" />
      <text x={756} y={30} textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700">右手</text>

      <Hand prefix="l" active={activeFinger} place="translate(110 36)" />
      <Hand prefix="r" active={activeFinger} place="translate(890 36) scale(-1 1)" />
    </svg>
  )
}
