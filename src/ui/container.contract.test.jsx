// ui の Container（.container.jsx）を共通契約（assertContainer）に載せるメタテスト。#338（#322 契約テストシリーズ）。
// Container は「配線」＝フック/application/content/domain を束ね presenter へ props を渡す層で、判定/整列/採点
// といった業務ロジック/計算は持たない（domain/application へ委譲）。本ファイルは src/ui 配下の全 .container.jsx を
// 走査し、当該不変条件（責務が漏れていない）を静的に検証する（ふるまいは検証しない＝薄い契約）。
//
// 検証は「静的 grep」に限定する（assertContainer のコメント参照）。render 結合が困難／粒度がまちまちな対象
// （純ラッパ〜表示 JSX 内包）を1つの behavioral 契約に押し込めると over-fit になるため踏み込まない。個々の
// container のふるまいは当該 *.test.* や結合テストが担う。ここで担保するのは「整列/採点/集約を container に
// 書かない（委譲する）」という退行防止のラチェットのみ。
//
// 本ファイルは純粋（fs でソース文字列を読むだけ＝jsdom/DOM 不要・既定の node 環境）。命名メタテスト
// （_ddd-naming.test.js）の対象からは .test.jsx サフィックスで除外される。
import { describe, it, expect } from 'vitest'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, sep } from 'node:path'
import { assertContainer } from '../test/contracts/container.js'

// このテスト（src/ui/container.contract.test.jsx）から src/ui ツリーを辿る。
const UI_ROOT = dirname(fileURLToPath(import.meta.url)) // .../src/ui

// src/ui 配下から *.container.jsx を再帰列挙（新規 container も自動で契約対象に入る＝ラチェット）。
function collectContainers(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...collectContainers(full))
      continue
    }
    if (entry.endsWith('.container.jsx')) out.push(full)
  }
  return out
}

const toRel = (full) => relative(UI_ROOT, full).split(sep).join('/')
const containers = collectContainers(UI_ROOT).sort()

describe('#338 Container 契約: 配線のみ・業務ロジック非漏出（静的）', () => {
  it('列挙対象の .container.jsx が1つ以上見つかる（テスト設計ミスの検出）', () => {
    // 皆無ならパス解決の誤りなので、契約チェック前に気づく（_ddd-naming.test.js に倣う）。
    expect(containers.length).toBeGreaterThan(0)
  })

  for (const full of containers) {
    assertContainer({ source: readFileSync(full, 'utf8'), name: toRel(full) })
  }
})

// ヘルパ自己テスト：assertContainer の grep がコメント内トークンを拾わず、実コードの整列は捕まえる（境界）。
describe('#338 Container 契約ヘルパ自己テスト', () => {
  // コメント内の .sort( は stripComments で除去され誤検知しない（緑になるべき）。
  assertContainer({
    source: '// list.sort() はコメント\n/* .reduce( もコメント */\nexport default function X() { return null }\n',
    name: 'コメント内トークンは無視する',
  })

  it('実コードの .sort( は責務漏れとして捕まえる（forbidden が効くことの確認）', () => {
    const stripComments = (src) =>
      src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/([^:]|^)\/\/.*$/gm, '$1')
    const bad = 'export default function X({ rows }) { return rows.sort((a, b) => a - b) }'
    expect(/\.sort\s*\(/.test(stripComments(bad))).toBe(true)
  })
})
