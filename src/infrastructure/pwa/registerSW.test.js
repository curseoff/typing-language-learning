// @vitest-environment jsdom
// registerSW の回帰防止：登録の起点が React effect 内なので、既に load 済み
// （document.readyState === 'complete'）でも SW 登録が走ること（#169 の回帰対策）。
// dev（PROD でない）では登録しないこと。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { registerServiceWorker } from './registerSW.js'

const stubServiceWorker = () => {
  const register = vi.fn().mockResolvedValue({
    waiting: null,
    installing: null,
    addEventListener: vi.fn(),
  })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register, controller: null, addEventListener: vi.fn() },
  })
  return register
}

describe('registerServiceWorker（load 済みでも登録する）', () => {
  beforeEach(() => {
    // jsdom は既定で complete。念のため明示する。
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    delete navigator.serviceWorker
  })

  it('本番かつ readyState=complete なら load を待たず即 register する', () => {
    vi.stubEnv('PROD', true)
    const register = stubServiceWorker()
    registerServiceWorker({ onUpdate: () => {} })
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('dev（PROD でない）では register しない', () => {
    vi.stubEnv('PROD', false)
    const register = stubServiceWorker()
    registerServiceWorker({ onUpdate: () => {} })
    expect(register).not.toHaveBeenCalled()
  })
})
