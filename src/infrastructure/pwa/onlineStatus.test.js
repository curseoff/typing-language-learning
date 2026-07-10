// @vitest-environment jsdom
// オンライン検知の薄い配線を単体テスト：isOnline は navigator.onLine に従い、
// onLine が boolean でなければ true（安全側）。subscribeOnline は online/offline を
// 購読し、解除関数で両リスナを外す。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { isOnline, subscribeOnline } from './onlineStatus.adapter.js'

// navigator.onLine を一時的に上書きする（jsdom では既定 true・configurable）。
function setOnLine(value) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

afterEach(() => {
  setOnLine(true) // 既定に戻す
  vi.restoreAllMocks()
})

describe('isOnline', () => {
  it('navigator.onLine が true なら true', () => {
    setOnLine(true)
    expect(isOnline()).toBe(true)
  })

  it('navigator.onLine が false なら false', () => {
    setOnLine(false)
    expect(isOnline()).toBe(false)
  })

  it('navigator.onLine が boolean でないときは true（安全側デフォルト）', () => {
    setOnLine(undefined)
    expect(isOnline()).toBe(true)
  })
})

describe('subscribeOnline', () => {
  it('online/offline イベントで listener が呼ばれる', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeOnline(listener)

    window.dispatchEvent(new Event('offline'))
    expect(listener).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('online'))
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
  })

  it('解除関数を呼ぶと以降のイベントで listener が呼ばれない', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeOnline(listener)
    unsubscribe()

    window.dispatchEvent(new Event('offline'))
    window.dispatchEvent(new Event('online'))
    expect(listener).not.toHaveBeenCalled()
  })

  it('解除関数は online/offline 両方のリスナを外す', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const unsubscribe = subscribeOnline(() => {})
    unsubscribe()
    expect(remove).toHaveBeenCalledWith('online', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('offline', expect.any(Function))
  })
})
