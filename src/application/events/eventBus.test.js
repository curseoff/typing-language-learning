import { describe, it, expect, vi } from 'vitest'
// #290 Phase 7: イベントバス（同期・in-memory）。
//   発行側（publish）と購読側（subscribe）を疎結合にする＝発行側は「誰が反応するか」を知らない。
//   - subscribe(type, handler) は購読を登録し、解除用の unsubscribe を返す。
//   - publish(event) は event.type に購読中の全 handler を購読順で同期呼び出しする（該当なしは no-op）。
// 本体 src/application/events/eventBus.js は coder が Green で作る（現状未実装＝import で undefined）。
import { createEventBus } from './eventBus.service.js'

describe('createEventBus（同期 in-memory イベントバス）', () => {
  it('subscribe した type の publish で handler が event を受けて呼ばれる', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.subscribe('SessionFinished', handler)

    const event = { type: 'SessionFinished', sessionId: 's1' }
    bus.publish(event)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('type が一致しない handler は呼ばれない', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.subscribe('RecordAchieved', handler)

    bus.publish({ type: 'SessionFinished' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('同一 type の複数 handler が全て呼ばれる（購読順）', () => {
    const bus = createEventBus()
    const calls = []
    bus.subscribe('E', () => calls.push('a'))
    bus.subscribe('E', () => calls.push('b'))
    bus.subscribe('E', () => calls.push('c'))

    bus.publish({ type: 'E' })

    expect(calls).toEqual(['a', 'b', 'c'])
  })

  it('異なる type が混在しても正しく振り分けられる', () => {
    const bus = createEventBus()
    const onA = vi.fn()
    const onB = vi.fn()
    bus.subscribe('A', onA)
    bus.subscribe('B', onB)

    const evA = { type: 'A' }
    bus.publish(evA)

    expect(onA).toHaveBeenCalledTimes(1)
    expect(onA).toHaveBeenCalledWith(evA)
    expect(onB).not.toHaveBeenCalled()
  })

  it('unsubscribe を呼ぶとその handler は以後呼ばれない', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    const unsubscribe = bus.subscribe('E', handler)

    unsubscribe()
    bus.publish({ type: 'E' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('unsubscribe は当該 handler だけ解除し、他の handler は呼ばれ続ける', () => {
    const bus = createEventBus()
    const kept = vi.fn()
    const removed = vi.fn()
    bus.subscribe('E', kept)
    const off = bus.subscribe('E', removed)

    off()
    bus.publish({ type: 'E' })

    expect(removed).not.toHaveBeenCalled()
    expect(kept).toHaveBeenCalledTimes(1)
  })

  it('購読者ゼロの type を publish しても throw しない（no-op）', () => {
    const bus = createEventBus()
    expect(() => bus.publish({ type: 'Nobody' })).not.toThrow()
  })

  it('publish は同期で handler を呼ぶ（呼び出し完了後には既に反応済み）', () => {
    const bus = createEventBus()
    let seen = false
    bus.subscribe('E', () => { seen = true })

    bus.publish({ type: 'E' })

    // await 無しで直後に反応が済んでいる＝同期。
    expect(seen).toBe(true)
  })

  it('publish の戻り値は undefined（handler の戻り値に依存しない＝疎結合）', () => {
    const bus = createEventBus()
    bus.subscribe('E', () => 'ignored-return-value')

    const result = bus.publish({ type: 'E' })

    expect(result).toBeUndefined()
  })
})
