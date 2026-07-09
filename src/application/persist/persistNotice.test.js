// #268 Phase5a: 永続化告知ストア（setPersistNotice/getPersistNotice/subscribe）の単体テスト。
// DOM 非依存の素の状態ストア（contentFallback 相当）。購読通知・優先度・参照安定を確認する。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  setPersistNotice,
  getPersistNotice,
  subscribePersistNotice,
  resetPersistNotice,
} from './persistNotice.js'

beforeEach(() => {
  resetPersistNotice()
})

describe('persistNotice ストア', () => {
  it('初期状態は null', () => {
    expect(getPersistNotice()).toBe(null)
  })

  it('setPersistNotice で種別が変わり、購読者へ通知される', () => {
    const listener = vi.fn()
    subscribePersistNotice(listener)
    setPersistNotice('fallback')
    expect(getPersistNotice()).toBe('fallback')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('同値の再セットでは通知しない（無駄な再描画を避ける）', () => {
    setPersistNotice('restored')
    const listener = vi.fn()
    subscribePersistNotice(listener)
    setPersistNotice('restored')
    expect(listener).not.toHaveBeenCalled()
  })

  it("'restored' が立っていれば 'fallback' で上書きしない（復元を優先）", () => {
    setPersistNotice('restored')
    setPersistNotice('fallback')
    expect(getPersistNotice()).toBe('restored')
  })

  it("'fallback' の後に 'restored' は上書きできる", () => {
    setPersistNotice('fallback')
    setPersistNotice('restored')
    expect(getPersistNotice()).toBe('restored')
  })

  it('購読解除すると以後は通知されない', () => {
    const listener = vi.fn()
    const unsub = subscribePersistNotice(listener)
    unsub()
    setPersistNotice('fallback')
    expect(listener).not.toHaveBeenCalled()
  })

  it('getPersistNotice は参照安定な primitive（string/null）を返す', () => {
    expect(typeof getPersistNotice()).toBe('object') // null は object
    setPersistNotice('fallback')
    expect(typeof getPersistNotice()).toBe('string')
  })
})
