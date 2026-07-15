// @vitest-environment jsdom
// ICE 構成の永続化（既定 lan・set/get 往復・不正保存値→既定）と、モード→RTCIceServer 写像の単体テスト。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getIceMode, setIceMode, iceServersFor } from './iceConfig.repository.js'

describe('infrastructure/p2p/iceConfig.repository', () => {
  beforeEach(() => localStorage.clear())

  it('未設定なら既定 lan を返す', () => {
    expect(getIceMode()).toBe('lan')
  })

  it('setIceMode(stun) で stun が永続し getIceMode が stun を返す', () => {
    setIceMode('stun')
    expect(getIceMode()).toBe('stun')
  })

  it('setIceMode(lan) で lan に戻る', () => {
    setIceMode('stun')
    setIceMode('lan')
    expect(getIceMode()).toBe('lan')
  })

  it('不正な保存値は既定 lan 扱いにフォールバックする', () => {
    localStorage.setItem('versus-ice-mode', 'turbo')
    expect(getIceMode()).toBe('lan')
  })

  it('setIceMode に未知値を渡しても保存せず既存値を変えない', () => {
    setIceMode('stun')
    setIceMode('nonsense')
    expect(getIceMode()).toBe('stun')
  })

  it('getItem が例外を投げても catch して既定 lan を返す', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(getIceMode()).toBe('lan')
    spy.mockRestore()
  })

  it('setItem が例外を投げても投げ返さない', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => setIceMode('stun')).not.toThrow()
    spy.mockRestore()
  })

  it('iceServersFor(lan) は空配列（STUN なし＝同一 LAN）', () => {
    expect(iceServersFor('lan')).toEqual([])
  })

  it('iceServersFor(stun) は公開 STUN 2 冗長を返す', () => {
    expect(iceServersFor('stun')).toEqual([
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ])
  })

  it('iceServersFor は未知モードでも空配列（安全側＝lan 相当）', () => {
    expect(iceServersFor('unknown')).toEqual([])
  })
})
