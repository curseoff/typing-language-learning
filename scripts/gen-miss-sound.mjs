// 打鍵ミス時の効果音 WAV（public/miss.wav）を生成する（外部依存なし・再現可能）。
// 生成物はコミットせず prebuild/predev で毎回作り直す（他の生成物と同方針）。
//   - 短く控えめな「柔らかいブザー」：低めの2音（わずかに不協和）を指数減衰で鳴らす。
//   - ~140ms・モノラル・16bit PCM・44.1kHz。ピーク振幅は控えめ（耳障りにしない）。
//   - 先頭/末尾に数ミリ秒のフェードを掛けてプチッというクリックノイズを防ぐ。
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SAMPLE_RATE = 44100
const DURATION = 0.14 // 秒（~140ms）
const PEAK = 0.22 // 控えめなピーク振幅（0..1）
const FADE = 0.004 // 端の 4ms フェード（クリック防止）
// 低めの2音（わずかに不協和＝ブザー感）。母音のような明るさは避ける。
const FREQS = [196, 233]

// 1サンプルの振幅（-1..1）を返す。指数減衰＋端フェード。
export function sample(t) {
  const decay = Math.exp(-t * 22) // 速い指数減衰（短く消える）
  let s = 0
  for (const f of FREQS) s += Math.sin(2 * Math.PI * f * t)
  s /= FREQS.length
  // 端フェード（先頭 FADE で立ち上げ、末尾 FADE で落とす）
  let edge = 1
  if (t < FADE) edge = t / FADE
  const tail = DURATION - t
  if (tail < FADE) edge = Math.min(edge, Math.max(0, tail / FADE))
  return s * decay * edge * PEAK
}

// 16bit PCM モノラル WAV のバイト列（Buffer）を組み立てる。
export function buildWav() {
  const n = Math.floor(SAMPLE_RATE * DURATION)
  const dataSize = n * 2 // 16bit = 2byte/サンプル
  const buf = Buffer.alloc(44 + dataSize)
  // RIFF ヘッダ
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  // fmt チャンク（PCM）
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16) // fmt サイズ
  buf.writeUInt16LE(1, 20) // audioFormat=1（PCM）
  buf.writeUInt16LE(1, 22) // チャンネル=1（モノラル）
  buf.writeUInt32LE(SAMPLE_RATE, 24)
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28) // byteRate
  buf.writeUInt16LE(2, 32) // blockAlign
  buf.writeUInt16LE(16, 34) // bitsPerSample
  // data チャンク
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, sample(i / SAMPLE_RATE)))
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  return buf
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const out = join(here, '..', 'public', 'miss.wav')
  writeFileSync(out, buildWav())
  console.log(`✓ miss.wav 生成: ${DURATION * 1000}ms / ${SAMPLE_RATE}Hz mono 16bit`)
}

// 直接実行時だけ書き出す（import 時は副作用なし）。
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
