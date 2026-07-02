// NDJSON 正準ソースの共通ユーティリティ。
// canon（キー出力順の安定化）を content-extract・各パイプライン（add-words/merge-*/gen-gloss）で共有し、
// 生成物 .js は content-build が再生成する。
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

// キー出力順（可読性・安定 diff）。未知キーは末尾にアルファベット順。
const ORDER = ['en', 'word', 'def', 'ja', 'kana', 'freq', 'level', 'theme', 'jaWords']
export function canon(o) {
  const keys = Object.keys(o)
  const ordered = [...ORDER.filter((k) => k in o), ...keys.filter((k) => !ORDER.includes(k)).sort()]
  const r = {}
  for (const k of ordered) r[k] = o[k]
  return r
}

export function deepEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (a && b && typeof a === 'object') {
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    if (ak.length !== bk.length) return false
    return ak.every((k) => deepEqual(a[k], b[k]))
  }
  return false
}

// NDJSON を読み、レコード配列を返す（url は URL）。
export function readNdjson(url) {
  return readFileSync(url, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
}

// レコード配列を canon 化して NDJSON へ書き出す（url は URL）。
export function writeNdjson(url, records) {
  writeFileSync(url, records.map((r) => JSON.stringify(canon(r))).join('\n') + '\n')
}

// 正準ソース更新後にアプリ用の生成物 .js を作り直す（content-build を実行）。
// パスはこのファイル（scripts/lib/）基準で解決する。
export function runContentBuild() {
  execFileSync('node', [new URL('../content-build.mjs', import.meta.url).pathname], {
    stdio: 'inherit',
  })
}
