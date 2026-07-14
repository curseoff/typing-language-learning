// #399 保存状態バッジ: 保存状態ストア（getSaveStatus/setSaveStatus/subscribe）の単体テスト。
// persistNotice.store と同型の参照安定ストア（DOM/infra 非依存）。
// coder が後で Green にする src/application/persist/saveStatus.store.js を対象にする。
// state = { role: 'primary'|'secondary'|'memory'|'unknown', reason: string|null }
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSaveStatus,
  setSaveStatus,
  subscribeSaveStatus,
  resetSaveStatus,
} from './saveStatus.store.js'

beforeEach(() => {
  resetSaveStatus()
})

describe('saveStatus ストア', () => {
  it('初期状態は { role:"unknown", reason:null }', () => {
    expect(getSaveStatus()).toEqual({ role: 'unknown', reason: null })
  })

  it('setSaveStatus で状態が反映され、購読者へ1回通知される', () => {
    const listener = vi.fn()
    subscribeSaveStatus(listener)
    setSaveStatus({ role: 'memory', reason: 'no-opfs' })
    expect(getSaveStatus()).toEqual({ role: 'memory', reason: 'no-opfs' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reason 省略時は reason:null になる', () => {
    setSaveStatus({ role: 'primary' })
    expect(getSaveStatus()).toEqual({ role: 'primary', reason: null })
  })

  it('同値の再セットでは通知せず、get の参照も変わらない（useSyncExternalStore 用）', () => {
    setSaveStatus({ role: 'memory', reason: 'no-opfs' })
    const before = getSaveStatus()
    const listener = vi.fn()
    subscribeSaveStatus(listener)
    setSaveStatus({ role: 'memory', reason: 'no-opfs' })
    expect(listener).not.toHaveBeenCalled()
    expect(getSaveStatus()).toBe(before) // 同一参照
  })

  it('reason 省略の同値再セットも no-op（role 一致・reason は null 同士）', () => {
    setSaveStatus({ role: 'primary' })
    const before = getSaveStatus()
    const listener = vi.fn()
    subscribeSaveStatus(listener)
    setSaveStatus({ role: 'primary' })
    expect(listener).not.toHaveBeenCalled()
    expect(getSaveStatus()).toBe(before)
  })

  it('変化時は get の参照が新しくなる（新オブジェクト）', () => {
    const before = getSaveStatus()
    setSaveStatus({ role: 'secondary' })
    const after = getSaveStatus()
    expect(after).not.toBe(before)
    expect(after).toEqual({ role: 'secondary', reason: null })
  })

  it('role が同じでも reason が変われば通知され、参照が変わる', () => {
    setSaveStatus({ role: 'memory', reason: 'no-opfs' })
    const before = getSaveStatus()
    const listener = vi.fn()
    subscribeSaveStatus(listener)
    setSaveStatus({ role: 'memory', reason: 'no-worker' })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getSaveStatus()).not.toBe(before)
    expect(getSaveStatus()).toEqual({ role: 'memory', reason: 'no-worker' })
  })

  it('購読解除すると以後は通知されない', () => {
    const listener = vi.fn()
    const unsub = subscribeSaveStatus(listener)
    unsub()
    setSaveStatus({ role: 'secondary' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('resetSaveStatus で初期値に戻る', () => {
    setSaveStatus({ role: 'memory', reason: 'no-opfs' })
    resetSaveStatus()
    expect(getSaveStatus()).toEqual({ role: 'unknown', reason: null })
  })
})
