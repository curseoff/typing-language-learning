// @vitest-environment jsdom
// 手動シグナリングコーデックの単体テスト：往復（encode→decode が deep-equal）、
// 不正入力（garbage/空/null）→ null、decode は決して throw しない。
// ※CompressionStream/DecompressionStream は Node18+/vitest（node 22）で利用可。
import { describe, it, expect } from 'vitest'
import { encodeSignal, decodeSignal } from './manualSignaling.adapter.js'

describe('infrastructure/p2p/manualSignaling.adapter', () => {
  it('encode→decode で元オブジェクトへ復元する（往復）', async () => {
    const obj = {
      type: 'offer',
      sdp: 'v=0\r\no=- 42 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      role: 'host',
      nested: { a: 1, b: [true, false, null], s: '日本語テスト' },
    }
    const code = await encodeSignal(obj)
    expect(typeof code).toBe('string')
    expect(code.length).toBeGreaterThan(0)
    const back = await decodeSignal(code)
    expect(back).toEqual(obj)
  })

  it('接続コードは Base64URL のみ（+ / = を含まない）', async () => {
    // 長めのペイロードでパディング/記号が出やすい状況を作る。
    const code = await encodeSignal({ sdp: 'x'.repeat(500), n: 12345 })
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it("decodeSignal('garbage') は null（throw しない）", async () => {
    await expect(decodeSignal('garbage!!!')).resolves.toBeNull()
  })

  it("decodeSignal('') は null", async () => {
    await expect(decodeSignal('')).resolves.toBeNull()
  })

  it('decodeSignal(null) は null', async () => {
    await expect(decodeSignal(null)).resolves.toBeNull()
  })

  it('decodeSignal(非文字列) は null', async () => {
    await expect(decodeSignal(42)).resolves.toBeNull()
    await expect(decodeSignal({})).resolves.toBeNull()
  })

  it('有効な Base64URL でも展開できなければ null（非圧縮データ）', async () => {
    // "hello" を素の Base64URL にしたもの（deflate-raw ストリームではない）。
    const notCompressed = btoa('hello').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    await expect(decodeSignal(notCompressed)).resolves.toBeNull()
  })

  it('展開できても JSON でなければ null', async () => {
    // 生テキスト "not json" を deflate-raw 圧縮 → Base64URL したコードを作り、decode が null を返すこと。
    const bytes = new TextEncoder().encode('not json at all')
    const src = new ReadableStream({
      start(c) {
        c.enqueue(bytes)
        c.close()
      },
    })
    const stream = src.pipeThrough(new CompressionStream('deflate-raw'))
    const buf = new Uint8Array(await new Response(stream).arrayBuffer())
    let binary = ''
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i])
    const code = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    await expect(decodeSignal(code)).resolves.toBeNull()
  })
})
