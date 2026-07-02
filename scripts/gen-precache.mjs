// ビルド成果物（dist/）からプリキャッシュ一覧 JSON を生成する。
// 資産名はハッシュ付きで sw.js に直書きできないため、ここで一覧を吐き出し
// Service Worker が install/activate 時に読んで先読みする。
//   - shell 群 … 起動に必須の小さい資産（install で addAll → 初回からオフライン起動）
//   - data 群  … content.sqlite3 / wasm の大物（activate 後に背景先読み）
//   - skip     … fallback チャンク等（#173：precache せず、必要になれば fetch 時 SWR で補完）
// data 群は sw.js の fetch ルーティングの唯一の出所（precache-manifest.json）でもある
// （方式a：sw.js は manifest.data のメンバーシップで DATA/SHELL を振り分ける＝drift 防止）。
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, sep } from 'node:path'

const DIST = 'dist'

// dist/ 配下を再帰的に走査し、ファイルの絶対（実）パス一覧を返す。
export function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

// scope 相対パスへ正規化する。sw.js は scope ルート（本番なら /typing-language-learning/sw.js）に
// 居るので、addAll に渡す URL を相対にすれば sw.js の位置基準で解決され、
// GitHub Pages のサブパス配信でも localhost ルートでも正しく効く。
//   - ルート絶対（先頭 /）だと本番でオリジン直下（/assets/... 等）へ化けて 404 → addAll 全体 reject。
//   - index.html は './'、それ以外は先頭スラッシュ無しの相対パス（assets/xxx.js・icon.svg 等）。
export function toSitePath(rel) {
  if (rel === 'index.html') return './'
  return rel
}

// キャッシュ対象外（SW 本体・自己参照・ソースマップ・OS 生成物）。
export function isExcluded(rel) {
  const base = rel.split('/').pop()
  return base === 'sw.js' || base === 'precache-manifest.json' || rel.endsWith('.map') || base === '.DS_Store'
}

// 大物（背景先読み）判定。content.sqlite3 と wasm のみ（#173）。
// これに一致する資産だけが manifest.data に載り、sw.js の DATA ルーティング対象になる。
// rel（先頭スラッシュ無しの相対パス）で判定するため、パス先頭の資産にも当たるよう (^|/) で錨止めする。
export function isData(rel) {
  return /(^|\/)content\.sqlite3$/.test(rel) || /\.wasm$/.test(rel)
}

// fallback チャンク（#173）：SQLite/wasm のロード失敗時のみ動的 import される保険資産
// （L1〜L4 / wordsData / dictionaryData / wordGlossData、計約11MB）。正常起動時は未使用なので
// precache しない（skip）。必要になれば fetch 時に SWR で shell へオンデマンド取得される。
export function isFallbackChunk(rel) {
  return (
    /(^|\/)assets\/L[1-4]-[^/]*\.js$/.test(rel) ||
    /(^|\/)assets\/wordsData-[^/]*\.js$/.test(rel) ||
    /(^|\/)assets\/dictionaryData-[^/]*\.js$/.test(rel) ||
    /(^|\/)assets\/wordGlossData-[^/]*\.js$/.test(rel)
  )
}

// 3値分類：'skip'（precache しない）/ 'data'（背景先読み）/ 'shell'（install で先読み）。
export function classify(rel) {
  if (isExcluded(rel) || isFallbackChunk(rel)) return 'skip'
  if (isData(rel)) return 'data'
  return 'shell'
}

// 相対パス一覧（rel）から shell/data のプリキャッシュ一覧を組み立てる（skip は載せない）。
export function buildManifest(rels) {
  const shell = new Set()
  const data = new Set()
  for (const rel of rels) {
    const kind = classify(rel)
    if (kind === 'skip') continue
    const p = toSitePath(rel)
    if (kind === 'data') data.add(p)
    else shell.add(p)
  }
  return { shell: [...shell].sort(), data: [...data].sort() }
}

function main() {
  let files
  try {
    files = walk(DIST)
  } catch {
    console.error(`✖ ${DIST}/ が見つかりません。先に npm run build を実行してください。`)
    process.exit(1)
  }
  const rels = files.map((full) => relative(DIST, full).split(sep).join('/'))
  const manifest = buildManifest(rels)
  writeFileSync(join(DIST, 'precache-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`✓ precache-manifest.json 生成: shell ${manifest.shell.length}件 / data ${manifest.data.length}件`)
}

// node scripts/gen-precache.mjs で直接実行された時だけ生成する（import 時は副作用なし＝テスト可能）。
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
