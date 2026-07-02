// 打鍵ミス効果音の再生（infrastructure・ベストエフォート）。
// AudioContext を遅延生成し、WAV を一度だけ decode してキャッシュ、都度 BufferSource を作って鳴らす
// （連打に強い）。読み込み/再生失敗・非対応環境は握りつぶす（例外を投げず＝タイピングを妨げない）。
// ミュート時は AudioContext に触れる前に return する（gate は純粋関数 shouldPlayMiss で判定）。
import { isSoundMuted } from './soundSettingsRepository.js'

// public/ 配下の miss.wav の URL（Vite の base に追従。Electron の file:// でも相対解決される）。
const MISS_URL = `${import.meta.env.BASE_URL}miss.wav`

let ctx = null // 遅延生成する AudioContext（初回 playMiss で作成）
let missBuffer = null // decode 済みの AudioBuffer（一度だけ取得）
let loading = false // 二重読み込み防止

// ミュートなら鳴らさない、という純粋な判定（テスト可能に切り出す）。
export function shouldPlayMiss(muted) {
  return !muted
}

// AudioContext を用意して返す（無ければ生成）。非対応環境や失敗時は null。
// ユーザー操作（keydown）起点で呼ばれるので suspended なら resume する。
function ensureContext() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume?.().catch(() => {})
    return ctx
  }
  const Ctor =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : typeof globalThis !== 'undefined' && globalThis.webkitAudioContext
        ? globalThis.webkitAudioContext
        : null
  if (!Ctor) return null
  try {
    ctx = new Ctor()
    ctx.resume?.().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

// WAV を一度だけ取得して decode し missBuffer に保持する（失敗は握りつぶす）。
function ensureBuffer(context) {
  if (missBuffer || loading) return
  loading = true
  try {
    fetch(MISS_URL)
      .then((res) => res.arrayBuffer())
      .then((buf) => context.decodeAudioData(buf))
      .then((decoded) => {
        missBuffer = decoded
      })
      .catch(() => {})
      .finally(() => {
        loading = false
      })
  } catch {
    loading = false
  }
}

// ミス効果音を鳴らす（ミュート時は何もしない）。ベストエフォートで例外は投げない。
// バッファ未読込の初回は読み込みを起動し、次回以降のミスから鳴る（初回1打は無音になり得る）。
export function playMiss() {
  if (!shouldPlayMiss(isSoundMuted())) return
  const context = ensureContext()
  if (!context) return
  ensureBuffer(context)
  if (!missBuffer) return
  try {
    const source = context.createBufferSource()
    source.buffer = missBuffer
    source.connect(context.destination)
    source.start(0)
  } catch {
    // 再生に失敗してもタイピングは続行
  }
}

// テスト用：モジュール内キャッシュをリセットする（本番コードからは使わない）。
export function _resetForTest() {
  ctx = null
  missBuffer = null
  loading = false
}
