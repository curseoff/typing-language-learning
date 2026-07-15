// #171 回帰防止：precache-manifest は scope 相対パスで出力する。
// 本番は GitHub Pages のサブパス配信（base: './'）なので、ルート絶対（先頭 /）だと
// sw.js の addAll がオリジン直下へ解決され 404 → install の shell 先読みが丸ごと reject する。
// よって全エントリが先頭 '/' で始まらず、index は './' であることを固定する。
import { describe, it, expect } from 'vitest'
import {
  toSitePath,
  isData,
  isFallbackChunk,
  classify,
  buildManifest,
} from '../../../scripts/gen-precache.mjs'

describe('gen-precache: scope 相対パス化（#171）', () => {
  it('index.html は "./"、それ以外は先頭スラッシュ無しの相対', () => {
    expect(toSitePath('index.html')).toBe('./')
    expect(toSitePath('assets/index-abc123.js')).toBe('assets/index-abc123.js')
    expect(toSitePath('icon.svg')).toBe('icon.svg')
    expect(toSitePath('assets/content-abc123.sqlite3')).toBe('assets/content-abc123.sqlite3')
  })

  it('data 群は content.sqlite3 と wasm のみ（#173：fallback チャンクは含めない）', () => {
    // #414：sqlite は Vite の `?url` import で hash 付き asset になった
    expect(isData('assets/content-abc123.sqlite3')).toBe(true)
    expect(isData('content.sqlite3')).toBe(true) // 素の名前も後方互換で許容
    expect(isData('assets/sqlite3-xyz.wasm')).toBe(true)
    // fallback チャンクは data ではない（skip 扱い）
    expect(isData('assets/L1-abc.js')).toBe(false)
    expect(isData('assets/wordsData-abc.js')).toBe(false)
    expect(isData('assets/dictionaryData-abc.js')).toBe(false)
    expect(isData('assets/wordGlossData-abc.js')).toBe(false)
    // shell 側（小資産）も data ではない
    expect(isData('assets/index-abc.js')).toBe(false)
    expect(isData('icon.svg')).toBe(false)
    expect(isData('manifest.webmanifest')).toBe(false)
  })

  it('fallback チャンク（L1〜L4/wordsData/dictionaryData/wordGlossData）を判定する（#173）', () => {
    expect(isFallbackChunk('assets/L1-abc.js')).toBe(true)
    expect(isFallbackChunk('assets/L4-abc.js')).toBe(true)
    expect(isFallbackChunk('assets/wordsData-abc.js')).toBe(true)
    expect(isFallbackChunk('assets/dictionaryData-abc.js')).toBe(true)
    expect(isFallbackChunk('assets/wordGlossData-abc.js')).toBe(true)
    // 通常資産は fallback ではない
    expect(isFallbackChunk('assets/index-abc.js')).toBe(false)
    expect(isFallbackChunk('assets/content-abc123.sqlite3')).toBe(false)
    expect(isFallbackChunk('assets/sqlite3-xyz.wasm')).toBe(false)
  })

  it('classify は 3値（skip/data/shell）に振り分ける（#173）', () => {
    // data：sqlite/wasm のみ
    expect(classify('assets/content-abc123.sqlite3')).toBe('data')
    expect(classify('assets/sqlite3-xyz.wasm')).toBe('data')
    // skip：fallback チャンクと除外対象
    expect(classify('assets/L1-abc.js')).toBe('skip')
    expect(classify('assets/wordsData-abc.js')).toBe('skip')
    expect(classify('sw.js')).toBe('skip')
    expect(classify('assets/index-abc.js.map')).toBe('skip')
    // shell：起動必須の小資産
    expect(classify('assets/index-abc.js')).toBe('shell')
    expect(classify('icon.svg')).toBe('shell')
    expect(classify('manifest.webmanifest')).toBe('shell')
  })

  it('buildManifest の全エントリが先頭 "/" で始まらず、index は "./"', () => {
    const rels = [
      'index.html',
      'assets/index-abc.js',
      'assets/index-abc.css',
      'icon.svg',
      'manifest.webmanifest',
      'assets/content-abc123.sqlite3',
      'assets/sqlite3-xyz.wasm',
      'assets/L1-abc.js',
      'assets/wordsData-abc.js',
      // 除外されるもの
      'sw.js',
      'precache-manifest.json',
      'assets/index-abc.js.map',
      '.DS_Store',
    ]
    const { shell, data } = buildManifest(rels)
    const all = [...shell, ...data]

    // ルート絶対パスの混入が無いこと（バグの核心）
    for (const p of all) expect(p.startsWith('/')).toBe(false)
    // index は './' に正規化される
    expect(shell).toContain('./')
    // shell/data の振り分け
    expect(shell).toContain('assets/index-abc.js')
    expect(shell).toContain('icon.svg')
    expect(shell).toContain('manifest.webmanifest')
    // data は sqlite/wasm のみ（#173）
    expect(data).toContain('assets/content-abc123.sqlite3')
    expect(data).toContain('assets/sqlite3-xyz.wasm')
    expect(data).toEqual(['assets/content-abc123.sqlite3', 'assets/sqlite3-xyz.wasm'])
    // fallback チャンクは shell/data どちらにも載らない（#173：skip）
    expect(all).not.toContain('assets/L1-abc.js')
    expect(all).not.toContain('assets/wordsData-abc.js')
    // 除外対象は含まれない
    expect(all).not.toContain('sw.js')
    expect(all).not.toContain('precache-manifest.json')
    expect(all.some((p) => p.endsWith('.map'))).toBe(false)
  })
})
