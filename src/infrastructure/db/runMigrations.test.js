// 版付きマイグレーションランナー（PRAGMA user_version 基準・前方のみ・各Tx適用）の単体テスト。
// OPFS/Worker には依存せず、db 抽象（selectValue/transaction/exec の3メソッド）をフェイクで注入して純ロジックだけ検証する。
import { describe, it, expect, vi } from 'vitest'
import { runMigrations } from './runMigrations.adapter.js'

// --- フェイク db -------------------------------------------------------------
// 実 sqlite-wasm oo1 DB と同じ3メソッド（selectValue/transaction/exec）を最小実装する。
// - userVersion: COMMIT 済みの現在版
// - execLog: COMMIT 済みの exec 記録（{ sql, tx } ＝どのトランザクション内で実行されたか）
// - transaction: 実行前スナップショットを取り、fn が throw したら ROLLBACK して再throw、正常なら COMMIT
function createFakeDb(initialVersion = 0) {
  let userVersion = initialVersion
  const execLog = [] // { sql, tx }
  let txCounter = 0
  let currentTx = null // 現在のトランザクション番号（外なら null）

  const db = {
    selectValue(sql) {
      if (/PRAGMA\s+user_version/i.test(sql)) return userVersion
      throw new Error('想定外の selectValue: ' + sql)
    },
    exec(sql) {
      execLog.push({ sql, tx: currentTx })
      const m = /^PRAGMA\s+user_version\s*=\s*(\d+)/i.exec(String(sql).trim())
      if (m) userVersion = Number(m[1])
    },
    transaction(fn) {
      const snapVersion = userVersion
      const snapLen = execLog.length
      txCounter += 1
      const prevTx = currentTx
      currentTx = txCounter
      try {
        return fn(db)
      } catch (e) {
        // ROLLBACK: このトランザクション中の副作用（版・execLog）を破棄
        userVersion = snapVersion
        execLog.length = snapLen
        throw e
      } finally {
        currentTx = prevTx
      }
    },
  }

  return {
    db,
    execLog,
    txCount: () => txCounter,
    version: () => userVersion,
  }
}

describe('infrastructure/db/runMigrations', () => {
  it('fresh: 現在版0で [1,2] を昇順に適用し最終版2にする', () => {
    const fake = createFakeDb(0)
    const up1 = vi.fn((db) => db.exec('CREATE TABLE t1 (id)'))
    const up2 = vi.fn((db) => db.exec('CREATE TABLE t2 (id)'))

    const result = runMigrations(fake.db, [
      { version: 1, up: up1 },
      { version: 2, up: up2 },
    ])

    expect(up1).toHaveBeenCalledTimes(1)
    expect(up2).toHaveBeenCalledTimes(1)
    // up(1) → up(2) の順
    expect(up1.mock.invocationCallOrder[0]).toBeLessThan(up2.mock.invocationCallOrder[0])
    expect(fake.version()).toBe(2)
    expect(result).toBe(2)
  })

  it('partial: 現在版1で [1,2] を渡すと up(1) は呼ばれず up(2) のみ適用（前方のみ）', () => {
    const fake = createFakeDb(1)
    const up1 = vi.fn((db) => db.exec('CREATE TABLE t1 (id)'))
    const up2 = vi.fn((db) => db.exec('CREATE TABLE t2 (id)'))

    const result = runMigrations(fake.db, [
      { version: 1, up: up1 },
      { version: 2, up: up2 },
    ])

    expect(up1).not.toHaveBeenCalled()
    expect(up2).toHaveBeenCalledTimes(1)
    expect(fake.version()).toBe(2)
    expect(result).toBe(2)
  })

  it('idempotent: 現在版2で [1,2] を再実行しても up は呼ばれず版2のまま（no-op）', () => {
    const fake = createFakeDb(2)
    const up1 = vi.fn()
    const up2 = vi.fn()

    const result = runMigrations(fake.db, [
      { version: 1, up: up1 },
      { version: 2, up: up2 },
    ])

    expect(up1).not.toHaveBeenCalled()
    expect(up2).not.toHaveBeenCalled()
    expect(fake.version()).toBe(2)
    expect(result).toBe(2)
    // 適用ゼロ＝トランザクションも張らない
    expect(fake.txCount()).toBe(0)
  })

  it('version ≤ 現在版は決して適用しない（forward-only の不変条件）', () => {
    const fake = createFakeDb(5)
    const up3 = vi.fn()
    const up5 = vi.fn()

    runMigrations(fake.db, [
      { version: 3, up: up3 },
      { version: 5, up: up5 },
    ])

    expect(up3).not.toHaveBeenCalled()
    expect(up5).not.toHaveBeenCalled()
    expect(fake.version()).toBe(5)
  })

  it('各マイグレーションは個別トランザクション（適用数だけ transaction が呼ばれる）', () => {
    const fake = createFakeDb(0)
    const up1 = vi.fn((db) => db.exec('CREATE TABLE t1 (id)'))
    const up2 = vi.fn((db) => db.exec('CREATE TABLE t2 (id)'))

    runMigrations(fake.db, [
      { version: 1, up: up1 },
      { version: 2, up: up2 },
    ])

    // fresh で2件適用 → transaction 2回
    expect(fake.txCount()).toBe(2)
  })

  it('各 up の DDL と対応する PRAGMA user_version=N が同一トランザクション内で起きる', () => {
    const fake = createFakeDb(0)
    const up1 = vi.fn((db) => db.exec('CREATE TABLE t1 (id)'))
    const up2 = vi.fn((db) => db.exec('CREATE TABLE t2 (id)'))

    runMigrations(fake.db, [
      { version: 1, up: up1 },
      { version: 2, up: up2 },
    ])

    const ddl1 = fake.execLog.find((e) => e.sql === 'CREATE TABLE t1 (id)')
    const pragma1 = fake.execLog.find((e) => /PRAGMA\s+user_version\s*=\s*1\b/i.test(e.sql))
    const ddl2 = fake.execLog.find((e) => e.sql === 'CREATE TABLE t2 (id)')
    const pragma2 = fake.execLog.find((e) => /PRAGMA\s+user_version\s*=\s*2\b/i.test(e.sql))

    // それぞれトランザクション内（tx が null でない）で実行される
    expect(ddl1.tx).not.toBeNull()
    expect(pragma1.tx).not.toBeNull()
    // 版1の DDL と版1の PRAGMA は同一トランザクション
    expect(ddl1.tx).toBe(pragma1.tx)
    // 版2も同様、かつ版1とは別トランザクション
    expect(ddl2.tx).toBe(pragma2.tx)
    expect(ddl1.tx).not.toBe(ddl2.tx)
  })

  it('失敗は ROLLBACK し以降を中断する: up(2) が throw → 版1は残り版2の副作用は消え up(3) は試行されない', () => {
    const fake = createFakeDb(0)
    const up1 = vi.fn((db) => db.exec('CREATE TABLE t1 (id)'))
    const up2 = vi.fn((db) => {
      db.exec('CREATE TABLE t2 (id)') // 途中まで副作用を出してから失敗
      throw new Error('up2 boom')
    })
    const up3 = vi.fn((db) => db.exec('CREATE TABLE t3 (id)'))

    expect(() =>
      runMigrations(fake.db, [
        { version: 1, up: up1 },
        { version: 2, up: up2 },
        { version: 3, up: up3 },
      ]),
    ).toThrow('up2 boom')

    // up(1) は COMMIT 済み
    expect(up1).toHaveBeenCalledTimes(1)
    expect(up2).toHaveBeenCalledTimes(1)
    // up(3) は試行されない
    expect(up3).not.toHaveBeenCalled()
    // 版は1のまま（2は反映されない）
    expect(fake.version()).toBe(1)
    // 版1の DDL は残る
    expect(fake.execLog.some((e) => e.sql === 'CREATE TABLE t1 (id)')).toBe(true)
    // 版2の DDL は ROLLBACK で消える
    expect(fake.execLog.some((e) => e.sql === 'CREATE TABLE t2 (id)')).toBe(false)
    // 版2の PRAGMA も設定されない
    expect(fake.execLog.some((e) => /PRAGMA\s+user_version\s*=\s*2\b/i.test(e.sql))).toBe(false)
  })

  it('順不同入力 [2,1] でも昇順（1→2）に整列して適用する', () => {
    const fake = createFakeDb(0)
    const up1 = vi.fn((db) => db.exec('CREATE TABLE t1 (id)'))
    const up2 = vi.fn((db) => db.exec('CREATE TABLE t2 (id)'))

    const result = runMigrations(fake.db, [
      { version: 2, up: up2 },
      { version: 1, up: up1 },
    ])

    // up(1) が up(2) より先
    expect(up1.mock.invocationCallOrder[0]).toBeLessThan(up2.mock.invocationCallOrder[0])
    expect(fake.version()).toBe(2)
    expect(result).toBe(2)
  })

  it('返り値は適用後の最終版数（適用なしなら現在版）を返す', () => {
    // 適用あり
    const fresh = createFakeDb(0)
    expect(
      runMigrations(fresh.db, [
        { version: 1, up: () => {} },
        { version: 2, up: () => {} },
      ]),
    ).toBe(2)

    // 適用なし（現在版がすべてより先）
    const done = createFakeDb(2)
    expect(
      runMigrations(done.db, [
        { version: 1, up: () => {} },
        { version: 2, up: () => {} },
      ]),
    ).toBe(2)

    // migrations 空でも現在版を返す
    const empty = createFakeDb(3)
    expect(runMigrations(empty.db, [])).toBe(3)
  })
})
