import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, basename, sep } from 'node:path'

// #306 / #308 DDD ステレオタイプ命名規約（メタテスト）。
// 各層のモジュールは「どの DDD ステレオタイプか」をファイル名サフィックスで
// 判別できること。層ごとに「対象ツリー・拡張子・許可サフィックス・追加除外」を
// 定義し、層別に判定する（1つの共通集合にせず層違いの誤サフィックスも検出）。
// 本体のリネームは coder が Green で行う（未リネーム＝赤が正しい）。

// このテストファイル（src/domain/_ddd-naming.test.js）からリポジトリルートを辿る。
const HERE = dirname(fileURLToPath(import.meta.url)) // .../src/domain
const REPO_ROOT = join(HERE, '..', '..') // .../ (repo root)

// DDD ステレオタイプ（#306 で確定した domain/core 用の集合）。
const DDD_SUFFIXES = [
  'entity',
  'vo',
  'factory',
  'event',
  'specification',
  'repository',
  'service',
]

// 規約対象ツリーの定義。tree はリポジトリルート基準の相対パス。
// ext は対象拡張子（例 ['.js']）、suffixes は許可するステレオタイプ名、
// extraExclude はそのツリー固有の追加除外（basename 判定関数）。
const TREES = [
  {
    tree: 'src/domain',
    ext: ['.js'],
    suffixes: DDD_SUFFIXES,
  },
  {
    tree: 'packages/core/src',
    ext: ['.js'],
    suffixes: DDD_SUFFIXES,
  },
  {
    tree: 'src/infrastructure',
    ext: ['.js'],
    suffixes: ['repository', 'adapter', 'migration', 'schema', 'mapper'],
  },
]

// 全ツリー共通の先行除外：テスト自身と barrel（公開 API 集約＝規約対象外）。
const isCommonExcluded = (name) =>
  /\.test\.(js|jsx|ts|tsx)$/.test(name) || name === 'index.js' || name === 'index.ts'

// 相対パスは OS 非依存に正規化（Windows CI でも安定する `/` 区切り）。
const toRel = (full) => relative(REPO_ROOT, full).split(sep).join('/')

// ツリー配下から、対象拡張子に一致し除外に当たらないファイルを再帰列挙。
function collectFiles({ tree, ext, extraExclude }) {
  const root = join(REPO_ROOT, tree)
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (!ext.some((e) => entry.endsWith(e))) continue
      if (isCommonExcluded(entry)) continue
      if (extraExclude && extraExclude(entry)) continue
      out.push(full)
    }
  }
  walk(root)
  return out
}

// basename が「許可サフィックス × 対象拡張子」のいずれかで終われば分類済み。
function isClassified(full, { ext, suffixes }) {
  const name = basename(full)
  return suffixes.some((suf) => ext.some((e) => name.endsWith(`.${suf}${e}`)))
}

describe('#306/#308 DDD ステレオタイプ命名規約（層別）', () => {
  for (const def of TREES) {
    describe(def.tree, () => {
      const files = collectFiles(def)

      it('列挙対象の非除外ファイルが1つ以上見つかる（テスト設計ミスの検出）', () => {
        // 対象ツリーにファイルが皆無なら glob/パス解決の誤りなので、規約チェック前に気づく。
        expect(files.length).toBeGreaterThan(0)
      })

      it('全モジュールの basename が許可ステレオタイプ・サフィックスで終わる', () => {
        const violations = files
          .filter((full) => !isClassified(full, def))
          .map(toRel)
          .sort()

        // 失敗時にどのファイルがどのツリーで未分類か一目で分かるよう相対パス一覧を載せる。
        expect(violations).toEqual([])
      })
    })
  }
})
