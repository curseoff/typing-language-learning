// @vitest-environment jsdom
// registerSW の回帰防止：
//  - 登録の起点が React effect 内なので、既に load 済み（readyState==='complete'）でも登録が走る（#169）。
//  - dev（PROD でない）では登録しない。
//  - controllerchange は「ユーザーが更新を押した後」だけ reload する。初回 claim では reload しない
//    （初回訪問で一瞬リロードしないため／check:pwa のコンテキスト破壊回避）。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { registerServiceWorker } from './registerSW.adapter.js'

// マイクロタスク/タイマーを掃き出す（register の await 後の配線を待つ）。
const flush = () => new Promise((r) => setTimeout(r, 0))

// navigator.serviceWorker をスタブし、controllerchange ハンドラを捕捉できるようにする。
const setup = ({ controller = null, waiting = null } = {}) => {
  let controllerChange
  const registration = { waiting, installing: null, addEventListener: vi.fn() }
  const register = vi.fn().mockResolvedValue(registration)
  const sw = {
    register,
    controller,
    addEventListener: vi.fn((type, cb) => {
      if (type === 'controllerchange') controllerChange = cb
    }),
  }
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: sw })
  return { register, registration, fireControllerChange: () => controllerChange?.() }
}

const stubReload = () => {
  const reload = vi.fn()
  Object.defineProperty(window, 'location', { configurable: true, value: { reload } })
  return reload
}

describe('registerServiceWorker', () => {
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
    const { register } = setup()
    registerServiceWorker({ onUpdate: () => {} })
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('dev（PROD でない）では register しない', () => {
    vi.stubEnv('PROD', false)
    const { register } = setup()
    registerServiceWorker({ onUpdate: () => {} })
    expect(register).not.toHaveBeenCalled()
  })

  it('初回 claim 相当：未起点の controllerchange では reload しない', async () => {
    vi.stubEnv('PROD', true)
    const reload = stubReload()
    const { fireControllerChange } = setup({ controller: null, waiting: null })
    registerServiceWorker({ onUpdate: () => {} })
    await flush() // register の await 後に controllerchange リスナが張られる
    fireControllerChange() // 初回 claim（null→active）を模す
    expect(reload).not.toHaveBeenCalled()
  })

  it('更新押下後の controllerchange は一度だけ reload する', async () => {
    vi.stubEnv('PROD', true)
    const reload = stubReload()
    const waiting = { postMessage: vi.fn() }
    let applyUpdate
    // controller あり＋waiting あり＝「既に更新待ち」経路で onUpdate(applyUpdate) が渡される
    const { fireControllerChange } = setup({ controller: {}, waiting })
    registerServiceWorker({ onUpdate: (fn) => { applyUpdate = fn } })
    await flush()
    expect(typeof applyUpdate).toBe('function')

    applyUpdate() // 「更新」押下＝ユーザー起点フラグを立てて skipWaiting 送信
    expect(waiting.postMessage).toHaveBeenCalledWith('SKIP_WAITING')

    fireControllerChange()
    fireControllerChange() // 二度目は多重防止で無視
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
