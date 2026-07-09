import { describe, it, expect, vi } from 'vitest'
// #266 Phase3a: write-through 用の FIFO 直列キュー（純ロジック・注入 exec）。
// coder が後で Green にする src/application/persist/writeQueue.js を対象にする。
import { createWriteQueue } from './writeQueue.js'

// マクロタスク境界まで待ってマイクロタスク（.then 連鎖）を吐き切らせる。
const tick = () => new Promise((r) => setTimeout(r, 0))

// 手動で resolve/reject できる Promise。
function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('createWriteQueue（FIFO 直列・fire-and-forget・失敗継続・ready-gate）', () => {
  it('enqueue した順に exec を1本ずつ直列実行する（a→b→c）', async () => {
    const calls = []
    const defs = []
    const exec = vi.fn((op) => {
      calls.push(op)
      const d = deferred()
      defs.push(d)
      return d.promise
    })
    const q = createWriteQueue(exec)
    q.setReady(true)

    q.enqueue('a')
    q.enqueue('b')
    q.enqueue('c')
    await tick()

    // 直列: a だけが走り、b/c は a が settle するまで開始しない。
    expect(calls).toEqual(['a'])

    defs[0].resolve()
    await tick()
    expect(calls).toEqual(['a', 'b'])

    defs[1].resolve()
    await tick()
    expect(calls).toEqual(['a', 'b', 'c'])
  })

  it('前の exec が settle するまで次の exec を呼ばない（直列の待機）', async () => {
    const calls = []
    const first = deferred()
    const exec = vi.fn((op) => {
      calls.push(op)
      return op === 'a' ? first.promise : Promise.resolve()
    })
    const q = createWriteQueue(exec)
    q.setReady(true)

    q.enqueue('a')
    q.enqueue('b')
    await tick()
    expect(calls).toEqual(['a']) // a 未解決の間 b は保留

    first.resolve()
    await tick()
    expect(calls).toEqual(['a', 'b'])
  })

  it('enqueue は同期に返る（fire-and-forget＝Promise を返さない）', () => {
    const exec = vi.fn(() => new Promise(() => {})) // 永遠に未解決でも
    const q = createWriteQueue(exec)
    q.setReady(true)
    expect(q.enqueue('a')).toBeUndefined()
  })

  it('exec が reject しても後続 op を止めない（失敗を握りつぶして次へ）', async () => {
    const calls = []
    const exec = vi.fn((op) => {
      calls.push(op)
      return op === 'a' ? Promise.reject(new Error('boom')) : Promise.resolve()
    })
    const q = createWriteQueue(exec)
    q.setReady(true)

    q.enqueue('a')
    q.enqueue('b')
    await tick()

    expect(calls).toEqual(['a', 'b'])
  })

  it('not-ready の間は enqueue しても exec を呼ばない（保留）', async () => {
    const exec = vi.fn(() => Promise.resolve())
    const q = createWriteQueue(exec)
    q.setReady(false)

    q.enqueue('a')
    q.enqueue('b')
    await tick()

    expect(exec).not.toHaveBeenCalled()
  })

  it('setReady(true) で保留分を FIFO 順にドレインする', async () => {
    const calls = []
    const exec = vi.fn((op) => {
      calls.push(op)
      return Promise.resolve()
    })
    const q = createWriteQueue(exec)
    q.setReady(false)

    q.enqueue('a')
    q.enqueue('b')
    q.enqueue('c')
    await tick()
    expect(calls).toEqual([]) // まだ保留

    q.setReady(true)
    await tick()
    expect(calls).toEqual(['a', 'b', 'c']) // 保留分を投入順に実行
  })
})
