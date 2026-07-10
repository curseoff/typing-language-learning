import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, basename, sep } from 'node:path'

// #306 DDD ステレオタイプ命名規約（メタテスト）。
// domain / @tll/core の各モジュールは「どの DDD ステレオタイプか」を
// ファイル名サフィックスで判別できること（.entity / .vo / .factory / .event /
// .specification / .repository / .service）。
// 本体のリネームは coder が Green で行う（現状は未リネーム＝赤が正しい）。

// このテストファイル（src/domain/_ddd-naming.test.js）からリポジトリルートを辿る。
const HERE = dirname(fileURLToPath(import.meta.url)) // .../src/domain
const REPO_ROOT = join(HERE, '..', '..') // .../ (repo root)

// 規約対象のツリー（リポジトリルート基準）。
const TARGET_TREES = [
  join(REPO_ROOT, 'src', 'domain'),
  join(REPO_ROOT, 'packages', 'core', 'src'),
]

// 既知のステレオタイプ・サフィックス。basename がこのいずれかで終われば分類済み。
const KNOWN_SUFFIXES = [
  '.entity.js',
  '.vo.js',
  '.factory.js',
  '.event.js',
  '.specification.js',
  '.repository.js',
  '.service.js',
]

// 対象外：テスト自身（*.test.js）と barrel の index.js（公開API集約＝規約対象外）。
const isExcluded = (name) => name.endsWith('.test.js') || name === 'index.js'

// ツリー配下の非テスト .js を再帰列挙（除外を適用）。
function collectJsFiles(root) {
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.endsWith('.js')) continue
      if (isExcluded(entry)) continue
      out.push(full)
    }
  }
  walk(root)
  return out
}

const allFiles = TARGET_TREES.flatMap(collectJsFiles)

// 相対パスは OS 非依存に正規化（Windows CI でも安定する `/` 区切り）。
const toRel = (full) => relative(REPO_ROOT, full).split(sep).join('/')

describe('#306 DDD ステレオタイプ命名規約（domain / @tll/core）', () => {
  it('列挙対象の非テスト .js が1つ以上見つかる（テスト設計ミスの検出）', () => {
    // 対象ツリーに .js が皆無なら glob/パス解決の誤りなので、規約チェック前に気づく。
    expect(allFiles.length).toBeGreaterThan(0)
  })

  it('全モジュールの basename が既知のステレオタイプ・サフィックスで終わる', () => {
    const violations = allFiles
      .filter((full) => !KNOWN_SUFFIXES.some((suf) => basename(full).endsWith(suf)))
      .map(toRel)
      .sort()

    // 失敗時にどのファイルが未分類か一目で分かるよう、違反の相対パス一覧を載せる。
    expect(violations).toEqual([])
  })
})
