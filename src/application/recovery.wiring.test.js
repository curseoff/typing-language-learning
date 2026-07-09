// @vitest-environment jsdom
// #268 Phase5a: recovery.js facade（ensureHealthyOrRestore/snapshotInternalBackup）の配線被覆。
// 判断の純関数（evaluateIntegrity/selectRestoreCandidate/rotateBackups）は recovery.test.js（test-author）
// が担保する。ここは handle への薄い配線＋フェイルセーフ＋告知連携を mock で確認する（backup.wiring と同様）。
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./../infrastructure/db/initStorage.js', () => ({
  getStorageHandle: vi.fn(),
}))
import { getStorageHandle } from '../infrastructure/db/initStorage.js'
import { ensureHealthyOrRestore, snapshotInternalBackup } from './recovery.js'
import { getPersistNotice, resetPersistNotice } from './persist/persistNotice.js'

beforeEach(() => {
  getStorageHandle.mockReset()
  resetPersistNotice()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('ensureHealthyOrRestore（起動時 integrity→自動復元の配線）', () => {
  it('handle 無し（local）は何もせず {restored:false}・告知なし', async () => {
    getStorageHandle.mockReturnValue(null)
    expect(await ensureHealthyOrRestore()).toEqual({ restored: false })
    expect(getPersistNotice()).toBe(null)
  })

  it("健全（'ok'）なら復元せず {restored:false}・listBackups を呼ばない", async () => {
    const listBackups = vi.fn()
    getStorageHandle.mockReturnValue({
      integrityCheck: vi.fn(() => Promise.resolve('ok')),
      listBackups,
    })
    expect(await ensureHealthyOrRestore()).toEqual({ restored: false })
    expect(listBackups).not.toHaveBeenCalled()
    expect(getPersistNotice()).toBe(null)
  })

  it('破損なら直近の健全バックアップで復元し、告知 restored を立てる', async () => {
    const restoreBackup = vi.fn(() => Promise.resolve(2))
    getStorageHandle.mockReturnValue({
      integrityCheck: vi.fn(() => Promise.resolve('*** in database main ***')),
      listBackups: vi.fn(() =>
        Promise.resolve([
          { name: '/backup-30.sqlite3', createdAt: 30, healthy: false },
          { name: '/backup-20.sqlite3', createdAt: 20, healthy: true },
          { name: '/backup-10.sqlite3', createdAt: 10, healthy: true },
        ]),
      ),
      restoreBackup,
    })
    expect(await ensureHealthyOrRestore()).toEqual({ restored: true })
    // 新しい破損はスキップし createdAt 20 の健全を選ぶ。
    expect(restoreBackup).toHaveBeenCalledWith('/backup-20.sqlite3')
    expect(getPersistNotice()).toBe('restored')
  })

  it('破損だが健全バックアップが無ければ復元断念（unrecoverable）・告知なし', async () => {
    const restoreBackup = vi.fn()
    getStorageHandle.mockReturnValue({
      integrityCheck: vi.fn(() => Promise.resolve('error')),
      listBackups: vi.fn(() =>
        Promise.resolve([{ name: '/backup-30.sqlite3', createdAt: 30, healthy: false }]),
      ),
      restoreBackup,
    })
    expect(await ensureHealthyOrRestore()).toEqual({ restored: false, unrecoverable: true })
    expect(restoreBackup).not.toHaveBeenCalled()
    expect(getPersistNotice()).toBe(null)
  })

  it('integrityCheck が例外（重度/スキーマ破損）でも健全バックアップがあれば復元し restored 告知', async () => {
    // quick_check が非ok文字列を返す前に SQLITE_CORRUPT を throw する worst-case でも安全網を外さない。
    const restoreBackup = vi.fn(() => Promise.resolve(2))
    getStorageHandle.mockReturnValue({
      integrityCheck: vi.fn(() => Promise.reject(new Error('malformed database schema'))),
      listBackups: vi.fn(() =>
        Promise.resolve([
          { name: '/backup-20.sqlite3', createdAt: 20, healthy: true },
          { name: '/backup-10.sqlite3', createdAt: 10, healthy: true },
        ]),
      ),
      restoreBackup,
    })
    expect(await ensureHealthyOrRestore()).toEqual({ restored: true })
    expect(restoreBackup).toHaveBeenCalledWith('/backup-20.sqlite3')
    expect(getPersistNotice()).toBe('restored')
  })

  it('integrityCheck が例外・かつ復元先が無ければ止めず {restored:false}（フェイルセーフ）', async () => {
    // 検査で例外・listBackups も呼べない/失敗する場合は最悪 local 縮退でアプリを止めない。
    getStorageHandle.mockReturnValue({
      integrityCheck: vi.fn(() => Promise.reject(new Error('worker down'))),
    })
    expect(await ensureHealthyOrRestore()).toEqual({ restored: false })
    expect(getPersistNotice()).toBe(null)
  })
})

describe('snapshotInternalBackup（健全スナップショット＋N世代ローテの配線）', () => {
  it('handle 無し（副タブ/local）は何もしない', async () => {
    getStorageHandle.mockReturnValue(null)
    await expect(snapshotInternalBackup()).resolves.toBeUndefined()
  })

  it('backupNow 後に一覧を取り、maxGen を超えた古い世代を deleteBackup する', async () => {
    const deleteBackup = vi.fn(() => Promise.resolve())
    getStorageHandle.mockReturnValue({
      backupNow: vi.fn(() => Promise.resolve({ name: '/backup-40.sqlite3', createdAt: 40 })),
      listBackups: vi.fn(() =>
        Promise.resolve([
          { name: '/backup-40.sqlite3', createdAt: 40 },
          { name: '/backup-30.sqlite3', createdAt: 30 },
          { name: '/backup-20.sqlite3', createdAt: 20 },
          { name: '/backup-10.sqlite3', createdAt: 10 },
        ]),
      ),
      deleteBackup,
    })
    await snapshotInternalBackup(2) // 直近2世代のみ残す
    // 古い側 20,10 を削除（新しい 40,30 は残す）。
    expect(deleteBackup).toHaveBeenCalledWith('/backup-20.sqlite3')
    expect(deleteBackup).toHaveBeenCalledWith('/backup-10.sqlite3')
    expect(deleteBackup).toHaveBeenCalledTimes(2)
  })

  it('backupNow が例外でも止めない（フェイルセーフ）', async () => {
    getStorageHandle.mockReturnValue({
      backupNow: vi.fn(() => Promise.reject(new Error('no space'))),
    })
    await expect(snapshotInternalBackup()).resolves.toBeUndefined()
  })
})
