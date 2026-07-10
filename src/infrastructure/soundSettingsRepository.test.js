// @vitest-environment jsdom
// 効果音ミュート設定の永続化（既定オン・get/set・破損ガード・購読通知）の単体テスト。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isSoundMuted, setSoundMuted, subscribeSoundMuted } from './soundSettings.repository.js'

describe('infrastructure/soundSettingsRepository', () => {
  beforeEach(() => localStorage.clear())

  it('未設定なら false（既定オン＝鳴らす）を返す', () => {
    expect(isSoundMuted()).toBe(false)
  })

  it('setSoundMuted(true) で true が永続し isSoundMuted が true を返す', () => {
    setSoundMuted(true)
    expect(isSoundMuted()).toBe(true)
  })

  it('setSoundMuted(false) で false に戻る', () => {
    setSoundMuted(true)
    setSoundMuted(false)
    expect(isSoundMuted()).toBe(false)
  })

  it("'true' 以外の保存値は false 扱い（既定オン）", () => {
    localStorage.setItem('sound-muted-v1', 'yes')
    expect(isSoundMuted()).toBe(false)
  })

  it('getItem が例外を投げても catch して false を返す', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(isSoundMuted()).toBe(false)
    spy.mockRestore()
  })

  it('setItem が例外を投げても投げ返さず購読者へ通知する', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    const listener = vi.fn()
    const unsub = subscribeSoundMuted(listener)
    expect(() => setSoundMuted(true)).not.toThrow()
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
    spy.mockRestore()
  })

  it('subscribeSoundMuted は変更のたび通知し、解除後は呼ばれない', () => {
    const listener = vi.fn()
    const unsub = subscribeSoundMuted(listener)
    setSoundMuted(true)
    setSoundMuted(false)
    expect(listener).toHaveBeenCalledTimes(2)
    unsub()
    setSoundMuted(true)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
