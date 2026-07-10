// @vitest-environment jsdom
// #267 Phase4: backup.js の export/import 配線（can*/prepare/importDatabaseBytes）と
// records.flushWrites の被覆。純関数（looksLikeSqlite/buildBackupFilename/isValidUserDb）は
// backup.test.js（test-author）が実 sqlite で担保する。ここは handle への薄い配線を mock で確認する。
import { describe, it, expect, vi, beforeEach } from 'vitest'

// getStorageHandle だけ差し替える（Worker handle の有無で経路を切替えるため）。
vi.mock('../infrastructure/db/initStorage.adapter.js', () => ({
  getStorageHandle: vi.fn(),
}))
import { getStorageHandle } from '../infrastructure/db/initStorage.adapter.js'
import {
  canExportDatabase,
  canImportDatabase,
  prepareDatabaseExport,
  importDatabaseBytes,
} from './backup.js'
import { flushWrites, initSqlitePersistence, saveRecord } from './records.js'

// "SQLite format 3\0" の16バイト。
const MAGIC = [
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
]
const tick = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  getStorageHandle.mockReset()
})

describe('#267 backup 配線: can*/prepare/importDatabaseBytes と flushWrites', () => {
  it('handle 無し（local）: can* は false・prepare は null・import は未初期化で throw・flushWrites 即解決', async () => {
    getStorageHandle.mockReturnValue(null)
    expect(canExportDatabase()).toBe(false)
    expect(canImportDatabase()).toBe(false)
    expect(await prepareDatabaseExport()).toBe(null)
    // local（queue 無し）では待つものが無く即解決する。
    await expect(flushWrites()).resolves.toBeUndefined()
    await expect(importDatabaseBytes(new Uint8Array([...MAGIC]))).rejects.toThrow(/未初期化/)
  })

  it('SQLite でないバイト列は import 入口で弾く（handle に触れない）', async () => {
    const importDbBytes = vi.fn()
    getStorageHandle.mockReturnValue({ importDbBytes })
    const bad = new Uint8Array([...MAGIC])
    bad[0] = 0x00
    await expect(importDatabaseBytes(bad)).rejects.toThrow(/SQLite/)
    expect(importDbBytes).not.toHaveBeenCalled()
  })

  it('handle 有り: prepare は flush→serialize→{bytes,filename}、import は handle.importDbBytes を呼ぶ', async () => {
    const bytes = new Uint8Array([...MAGIC, 1, 2, 3])
    const serialize = vi.fn(() => Promise.resolve(bytes))
    const importDbBytes = vi.fn(() => Promise.resolve())
    getStorageHandle.mockReturnValue({ serialize, importDbBytes })

    // sqlite バックエンドを有効化＝flushWrites が queue.flush() を待つ経路を通す。
    const save = vi.fn(() => Promise.resolve())
    initSqlitePersistence({ save }, {})
    saveRecord({ mode: 'both', rank: 1, keys: 5, mistakes: 0 }) // 差分を1件積む

    const date = new Date(2026, 6, 9, 9, 22, 10)
    const ex = await prepareDatabaseExport(date)
    expect(ex.bytes).toBe(bytes)
    expect(ex.filename).toBe('typing-language-learning-20260709-092210.sqlite3')
    expect(serialize).toHaveBeenCalledTimes(1)
    await tick()
    expect(save).toHaveBeenCalledWith('records', [expect.objectContaining({ keys: 5 })])

    expect(canExportDatabase()).toBe(true)
    expect(canImportDatabase()).toBe(true)
    const ok = await importDatabaseBytes(bytes)
    expect(ok).toBe(true)
    expect(importDbBytes).toHaveBeenCalledWith(bytes)
  })

  it('serialize が失敗したら prepare は null（縮退）', async () => {
    getStorageHandle.mockReturnValue({ serialize: vi.fn(() => Promise.reject(new Error('x'))) })
    expect(await prepareDatabaseExport()).toBe(null)
  })
})
