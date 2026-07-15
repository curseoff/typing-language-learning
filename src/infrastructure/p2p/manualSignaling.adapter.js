// #426 対戦基盤スライス2：手動シグナリング用の接続コードの符号化/復号（トランスポート非依存の純コーデック）。
// SDP 等のシグナリングオブジェクトを「短い貼り付け可能な文字列」へ相互変換する。QR/コピペで相手へ渡す想定。
//   encodeSignal(obj) … JSON → deflate-raw 圧縮 → Base64URL（自コード＝trusted）。
//   decodeSignal(code) … Base64URL → 展開 → JSON.parse（相手から貼られる untrusted 入力）。
// 信頼境界：decode は versusMessage.vo.js と同じ方針で、壊れた/不正な入力に対し決して throw せず null。
// 圧縮は 'deflate-raw'（gzip ヘッダ/フッタや zlib のオーバーヘッドが無く SDP のような短文に最小・
// ブラウザ標準 CompressionStream/DecompressionStream で相互運用可）。

// Uint8Array → Base64URL 文字列（'+/=' を '-_' へ・パディング除去）。
function bytesToBase64Url(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Base64URL 文字列 → Uint8Array（不正文字は atob が throw するので呼び出し側で捕捉する）。
function base64UrlToBytes(code) {
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// Uint8Array を 1 チャンクだけ流す ReadableStream を作る（Blob.stream は jsdom に無いので直接構築）。
function bytesToStream(bytes) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

// Uint8Array を deflate-raw で圧縮/展開する共通処理（Compression/DecompressionStream をパイプに通す）。
async function pipeThrough(bytes, transform) {
  const stream = bytesToStream(bytes).pipeThrough(transform)
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

// シグナリングオブジェクトを接続コード（Base64URL）へ符号化する（自コード＝trusted・失敗は throw）。
export async function encodeSignal(obj) {
  const json = JSON.stringify(obj)
  const input = new TextEncoder().encode(json)
  const compressed = await pipeThrough(input, new CompressionStream('deflate-raw'))
  return bytesToBase64Url(compressed)
}

// 接続コードを復号してオブジェクトへ戻す（untrusted 入力）。壊れた/不正な入力は throw せず null。
export async function decodeSignal(code) {
  if (typeof code !== 'string' || code.length === 0) return null
  try {
    const compressed = base64UrlToBytes(code)
    const decompressed = await pipeThrough(compressed, new DecompressionStream('deflate-raw'))
    const json = new TextDecoder().decode(decompressed)
    return JSON.parse(json)
  } catch {
    // Base64URL 崩れ・展開失敗・非 JSON など、どんな不正入力でも境界で握りつぶし null。
    return null
  }
}
