// ビルド成果物（dist/）からプリキャッシュ一覧 JSON を生成する。
// 資産名はハッシュ付きで sw.js に直書きできないため、ここで一覧を吐き出し
// Service Worker が install/activate 時に読んで先読みする。
//   - shell 群 … 起動に必須の小さい資産（install で addAll → 初回からオフライン起動）
//   - data 群  … content.sqlite3 / wasm / 語彙データ等の大物（activate 後に背景先読み）
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const DIST = 'dist'

// dist/ 配下を再帰的に走査し、ファイルの相対パス（posix 区切り）一覧を返す。
function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

let files
try {
  files = walk(DIST)
} catch {
  console.error(`✖ ${DIST}/ が見つかりません。先に npm run build を実行してください。`)
  process.exit(1)
}

// サイト絶対パス（先頭スラッシュ付き）へ。index.html は "/" に正規化する。
function toSitePath(full) {
  const rel = relative(DIST, full).split(sep).join('/')
  if (rel === 'index.html') return '/'
  return `/${rel}`
}

// キャッシュ対象外（SW 本体・自己参照・ソースマップ・OS 生成物）。
function isExcluded(rel) {
  const base = rel.split('/').pop()
  return base === 'sw.js' || base === 'precache-manifest.json' || rel.endsWith('.map') || base === '.DS_Store'
}

// 大物（背景先読み）判定。ここに該当しないキャッシュ可能資産は shell とする。
function isData(p) {
  return (
    /\/content\.sqlite3$/.test(p) ||
    /\.wasm$/.test(p) ||
    /\/assets\/L[1-4]-[^/]*\.js$/.test(p) ||
    /\/assets\/wordsData-[^/]*\.js$/.test(p) ||
    /\/assets\/dictionaryData-[^/]*\.js$/.test(p) ||
    /\/assets\/wordGlossData-[^/]*\.js$/.test(p)
  )
}

const shell = new Set()
const data = new Set()
for (const full of files) {
  const rel = relative(DIST, full).split(sep).join('/')
  if (isExcluded(rel)) continue
  const p = toSitePath(full)
  if (isData(p)) data.add(p)
  else shell.add(p)
}

const manifest = {
  shell: [...shell].sort(),
  data: [...data].sort(),
}
writeFileSync(join(DIST, 'precache-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`✓ precache-manifest.json 生成: shell ${manifest.shell.length}件 / data ${manifest.data.length}件`)
