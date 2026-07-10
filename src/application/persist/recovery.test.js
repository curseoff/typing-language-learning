import { describe, it, expect } from 'vitest'
// #268 Phase5a: 起動時 integrity_check→内部バックアップから自動復元の判断ロジック（純関数）。
// coder が後で Green にする src/application/persist/recovery.js を対象にする。
// すべて DOM/infra 非依存・副作用なし・入力非破壊の純関数。
//
// 仕様固定（曖昧点をここで1つに決める）:
// - evaluateIntegrity: 健全は「文字列 'ok'（前後空白は trim して許容）」または「単一要素配列 ['ok']」のみ。
//   複数行の配列・他文言・空・null/undefined は破損(false)。
//   ※ [{ integrity_check: 'ok' }] のようなオブジェクト行形式は本テストの固定仕様に含めない
//     （coder が追加対応しても本テストは通る。ここでは縛らない）。
// - computeChecksum: 期待値は「関係」で固定（決定性・差分で不一致・順序依存）し、特定アルゴリズムに縛らない。
//   16進文字列（大小問わず）であることのみ形式として要求する。
// - rotateBackups: createdAt 降順の安定ソートで先頭 maxGen 件を keep（新しい順で返す）。
//   同 createdAt の tie は入力順を保つ（安定）。remove は keep 以外。
// - selectRestoreCandidate: healthy な中で createdAt 最新を返す。無ければ null。
import {
  evaluateIntegrity,
  computeChecksum,
  rotateBackups,
  selectRestoreCandidate,
} from './recovery.policy.js'

describe('evaluateIntegrity（integrity_check 結果→健全/破損の純判定）', () => {
  describe('健全（true）', () => {
    it("結果が文字列 'ok' なら健全(true)", () => {
      expect(evaluateIntegrity('ok')).toBe(true)
    })

    it("前後に空白/改行のある 'ok' も trim して健全(true)", () => {
      expect(evaluateIntegrity('  ok\n')).toBe(true)
    })

    it("単一要素配列 ['ok'] も健全(true)", () => {
      expect(evaluateIntegrity(['ok'])).toBe(true)
    })

    it("単一要素配列の要素に空白がある ['  ok  '] も trim して健全(true)", () => {
      expect(evaluateIntegrity(['  ok  '])).toBe(true)
    })
  })

  describe('破損（false）', () => {
    it('エラー文言の文字列は破損(false)', () => {
      expect(evaluateIntegrity('*** in database main ***\nPage 3 is never used')).toBe(false)
    })

    it("'ok' 以外の文字列は破損(false)", () => {
      expect(evaluateIntegrity('error')).toBe(false)
    })

    it('空文字列は破損(false)', () => {
      expect(evaluateIntegrity('')).toBe(false)
    })

    it('複数行の配列（1行目が ok でも）は破損(false)', () => {
      expect(evaluateIntegrity(['ok', 'row 2 error'])).toBe(false)
    })

    it("要素が 'ok' でない単一要素配列は破損(false)", () => {
      expect(evaluateIntegrity(['error'])).toBe(false)
    })

    it('空配列は破損(false)', () => {
      expect(evaluateIntegrity([])).toBe(false)
    })

    it('null は破損(false)', () => {
      expect(evaluateIntegrity(null)).toBe(false)
    })

    it('undefined は破損(false)', () => {
      expect(evaluateIntegrity(undefined)).toBe(false)
    })
  })

  it('必ず boolean を返す（真偽値以外を返さない）', () => {
    for (const input of ['ok', ' ok ', ['ok'], 'error', '', [], null, undefined, ['a', 'b']]) {
      expect(typeof evaluateIntegrity(input)).toBe('boolean')
    }
  })
})

describe('computeChecksum（バイト列→決定的な16進チェックサム・純関数）', () => {
  it('同じバイト列なら2回呼んでも同じ値（決定性）', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    expect(computeChecksum(bytes)).toBe(computeChecksum(new Uint8Array([1, 2, 3, 4, 5])))
  })

  it('1バイトでも違えば別値になる（[1,2,3] と [1,2,4]）', () => {
    expect(computeChecksum(new Uint8Array([1, 2, 3]))).not.toBe(
      computeChecksum(new Uint8Array([1, 2, 4])),
    )
  })

  it('並び順が違えば別値になる（[1,2] と [2,1]）', () => {
    expect(computeChecksum(new Uint8Array([1, 2]))).not.toBe(
      computeChecksum(new Uint8Array([2, 1])),
    )
  })

  it('長さが違えば別値になる（[1,2,3] と [1,2,3,0]）', () => {
    expect(computeChecksum(new Uint8Array([1, 2, 3]))).not.toBe(
      computeChecksum(new Uint8Array([1, 2, 3, 0])),
    )
  })

  it('空配列でも定義された16進文字列を返す', () => {
    const sum = computeChecksum(new Uint8Array([]))
    expect(typeof sum).toBe('string')
    expect(sum.length).toBeGreaterThan(0)
    expect(sum).toMatch(/^[0-9a-f]+$/i)
  })

  it('空配列のチェックサムも決定的（2回呼んで一致）', () => {
    expect(computeChecksum(new Uint8Array([]))).toBe(computeChecksum(new Uint8Array([])))
  })

  it('返り値は16進文字列（[0-9a-f]）である', () => {
    expect(computeChecksum(new Uint8Array([10, 20, 30, 255, 0]))).toMatch(/^[0-9a-f]+$/i)
  })

  it('入力の Uint8Array を破壊しない', () => {
    const bytes = new Uint8Array([9, 8, 7])
    computeChecksum(bytes)
    expect(Array.from(bytes)).toEqual([9, 8, 7])
  })
})

describe('rotateBackups（内部バックアップの N 世代ローテ・純関数）', () => {
  it('createdAt 降順で新しい方から maxGen 件を keep、残りを remove する', () => {
    const backups = [
      { createdAt: 10, id: 'a' },
      { createdAt: 30, id: 'c' },
      { createdAt: 20, id: 'b' },
      { createdAt: 40, id: 'd' },
    ]
    const { keep, remove } = rotateBackups(backups, 2)
    // keep は新しい順（降順）で返す
    expect(keep).toEqual([
      { createdAt: 40, id: 'd' },
      { createdAt: 30, id: 'c' },
    ])
    // remove は keep 以外（古い側）
    expect(remove.map((b) => b.id).sort()).toEqual(['a', 'b'])
  })

  it('件数 ≤ maxGen なら remove は空・全件 keep（順不同入力を降順で返す）', () => {
    const backups = [
      { createdAt: 20, id: 'b' },
      { createdAt: 10, id: 'a' },
    ]
    const { keep, remove } = rotateBackups(backups, 5)
    expect(remove).toEqual([])
    expect(keep).toEqual([
      { createdAt: 20, id: 'b' },
      { createdAt: 10, id: 'a' },
    ])
  })

  it('件数 = maxGen なら remove は空・全件 keep', () => {
    const backups = [
      { createdAt: 1, id: 'a' },
      { createdAt: 2, id: 'b' },
      { createdAt: 3, id: 'c' },
    ]
    const { keep, remove } = rotateBackups(backups, 3)
    expect(remove).toEqual([])
    expect(keep.map((b) => b.id)).toEqual(['c', 'b', 'a'])
  })

  it('maxGen=1 なら最新のみ keep・他は全て remove', () => {
    const backups = [
      { createdAt: 5, id: 'e' },
      { createdAt: 1, id: 'a' },
      { createdAt: 3, id: 'c' },
    ]
    const { keep, remove } = rotateBackups(backups, 1)
    expect(keep).toEqual([{ createdAt: 5, id: 'e' }])
    expect(remove.map((b) => b.id).sort()).toEqual(['a', 'c'])
  })

  it('空配列なら keep も remove も空', () => {
    expect(rotateBackups([], 3)).toEqual({ keep: [], remove: [] })
  })

  it('同 createdAt の tie は入力順を保つ（安定・境界で keep 側に入る方を固定）', () => {
    // createdAt 2 が2件（A,B の入力順）→ 降順安定ソートで A,B、次に C(1)。
    const backups = [
      { createdAt: 2, id: 'A' },
      { createdAt: 2, id: 'B' },
      { createdAt: 1, id: 'C' },
    ]
    const { keep, remove } = rotateBackups(backups, 2)
    expect(keep).toEqual([
      { createdAt: 2, id: 'A' },
      { createdAt: 2, id: 'B' },
    ])
    expect(remove).toEqual([{ createdAt: 1, id: 'C' }])
  })

  it('入力配列と要素を破壊しない', () => {
    const backups = [
      { createdAt: 2, id: 'b' },
      { createdAt: 1, id: 'a' },
      { createdAt: 3, id: 'c' },
    ]
    const snapshot = JSON.parse(JSON.stringify(backups))
    rotateBackups(backups, 1)
    expect(backups).toEqual(snapshot)
  })
})

describe('selectRestoreCandidate（復元候補＝直近の健全バックアップ選定・純関数）', () => {
  it('healthy な中で createdAt 最新を返す', () => {
    const backups = [
      { createdAt: 10, healthy: true, id: 'a' },
      { createdAt: 30, healthy: true, id: 'c' },
      { createdAt: 20, healthy: true, id: 'b' },
    ]
    expect(selectRestoreCandidate(backups)).toEqual({ createdAt: 30, healthy: true, id: 'c' })
  })

  it('最新が unhealthy・より古いものが healthy なら、古い healthy を返す（破損はスキップ）', () => {
    const backups = [
      { createdAt: 30, healthy: false, id: 'newest-broken' },
      { createdAt: 20, healthy: true, id: 'older-ok' },
      { createdAt: 10, healthy: true, id: 'oldest-ok' },
    ]
    expect(selectRestoreCandidate(backups)).toEqual({
      createdAt: 20,
      healthy: true,
      id: 'older-ok',
    })
  })

  it('healthy が1つも無ければ null を返す', () => {
    const backups = [
      { createdAt: 30, healthy: false, id: 'a' },
      { createdAt: 20, healthy: false, id: 'b' },
    ]
    expect(selectRestoreCandidate(backups)).toBe(null)
  })

  it('空配列なら null を返す', () => {
    expect(selectRestoreCandidate([])).toBe(null)
  })

  it('healthy が1件だけならそれを返す', () => {
    const backups = [
      { createdAt: 30, healthy: false, id: 'a' },
      { createdAt: 10, healthy: true, id: 'only-ok' },
      { createdAt: 20, healthy: false, id: 'b' },
    ]
    expect(selectRestoreCandidate(backups)).toEqual({ createdAt: 10, healthy: true, id: 'only-ok' })
  })

  it('入力配列と要素を破壊しない', () => {
    const backups = [
      { createdAt: 30, healthy: false, id: 'a' },
      { createdAt: 20, healthy: true, id: 'b' },
    ]
    const snapshot = JSON.parse(JSON.stringify(backups))
    selectRestoreCandidate(backups)
    expect(backups).toEqual(snapshot)
  })
})
