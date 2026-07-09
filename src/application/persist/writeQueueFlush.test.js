import { describe, it, expect, vi } from 'vitest'
// #267 Phase4: write-queue に足した flush()（保留分を drain して完了を待つ）の被覆。
// FIFO 直列・fire-and-forget 本体は writeQueue.test.js（test-author）が担保済み。ここは flush のみ。
import { createWriteQueue } from './writeQueue.js'

const tick = () => new Promise((r) => setTimeout(r, 0))

function deferred() {
  let resolve
  const promise = new Promise((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('createWriteQueue.flush（保留分の drain 完了を待つ）', () => {
  it('空・非実行なら即解決する', async () => {
    const q = createWriteQueue(() => Promise.resolve())
    q.setReady(true)
    await expect(q.flush()).resolves.toBeUndefined()
  })

  it('実行中の op が settle し、キューが空になってから解決する', async () => {
    const defs = []
    const exec = vi.fn(() => {
      const d = deferred()
      defs.push(d)
      return d.promise
    })
    const q = createWriteQueue(exec)
    q.setReady(true)
    q.enqueue('a')
    q.enqueue('b')
    await tick()

    let done = false
    const p = q.flush().then(() => {
      done = true
    })
    await tick()
    expect(done).toBe(false) // a 実行中・b 保留 → まだ

    defs[0].resolve()
    await tick()
    expect(done).toBe(false) // b 実行中 → まだ

    defs[1].resolve()
    await p
    expect(done).toBe(true)
  })

  it('not-ready で溜めた保留分は setReady(true) の消化後に解決する', async () => {
    const exec = vi.fn(() => Promise.resolve())
    const q = createWriteQueue(exec)
    q.enqueue('a') // not-ready で保留（drain されない）

    let done = false
    q.flush().then(() => {
      done = true
    })
    await tick()
    expect(done).toBe(false)

    q.setReady(true)
    await tick()
    expect(done).toBe(true)
    expect(exec).toHaveBeenCalledTimes(1)
  })
})
