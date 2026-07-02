// #171 回帰防止：precache-manifest は scope 相対パスで出力する。
// 本番は GitHub Pages のサブパス配信（base: './'）なので、ルート絶対（先頭 /）だと
// sw.js の addAll がオリジン直下へ解決され 404 → install の shell 先読みが丸ごと reject する。
// よって全エントリが先頭 '/' で始まらず、index は './' であることを固定する。
import { describe, it, expect } from 'vitest'
import { toSitePath, isData, buildManifest } from '../../../scripts/gen-precache.mjs'

describe('gen-precache: scope 相対パス化（#171）', () => {
  it('index.html は "./"、それ以外は先頭スラッシュ無しの相対', () => {
    expect(toSitePath('index.html')).toBe('./')
    expect(toSitePath('assets/index-abc123.js')).toBe('assets/index-abc123.js')
    expect(toSitePath('icon.svg')).toBe('icon.svg')
    expect(toSitePath('content.sqlite3')).toBe('content.sqlite3')
  })

  it('相対パスでも data 群（大物）を正しく判定する', () => {
    expect(isData('content.sqlite3')).toBe(true)
    expect(isData('assets/sqlite3-xyz.wasm')).toBe(true)
    expect(isData('assets/L1-abc.js')).toBe(true)
    expect(isData('assets/wordsData-abc.js')).toBe(true)
    expect(isData('assets/dictionaryData-abc.js')).toBe(true)
    expect(isData('assets/wordGlossData-abc.js')).toBe(true)
    // shell 側（小資産）は data ではない
    expect(isData('assets/index-abc.js')).toBe(false)
    expect(isData('icon.svg')).toBe(false)
    expect(isData('manifest.webmanifest')).toBe(false)
  })

  it('buildManifest の全エントリが先頭 "/" で始まらず、index は "./"', () => {
    const rels = [
      'index.html',
      'assets/index-abc.js',
      'assets/index-abc.css',
      'icon.svg',
      'manifest.webmanifest',
      'content.sqlite3',
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
    expect(data).toContain('content.sqlite3')
    expect(data).toContain('assets/sqlite3-xyz.wasm')
    expect(data).toContain('assets/L1-abc.js')
    expect(data).toContain('assets/wordsData-abc.js')
    // 除外対象は含まれない
    expect(all).not.toContain('sw.js')
    expect(all).not.toContain('precache-manifest.json')
    expect(all.some((p) => p.endsWith('.map'))).toBe(false)
  })
})
