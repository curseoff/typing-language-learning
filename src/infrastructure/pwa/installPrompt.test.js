// @vitest-environment jsdom
// PWA インストール導線の薄い配線を単体テスト：module 評価時にトップレベル購読しているので
// 合成 beforeinstallprompt を dispatch すると canInstall() が true になる。promptInstall() は
// prompt() を呼び userChoice 後に導線を消す。appinstalled / standalone 起動では導線を出さない。
import { describe, it, expect, afterEach, vi } from 'vitest'
import { canInstall, subscribeInstall, promptInstall } from './installPrompt.adapter.js'

// 合成 beforeinstallprompt イベントを作る（preventDefault はモック、prompt()/userChoice も差し替え可能）。
function makeBIPEvent({ outcome = 'accepted' } = {}) {
  const event = new Event('beforeinstallprompt')
  event.preventDefault = vi.fn()
  event.prompt = vi.fn()
  event.userChoice = Promise.resolve({ outcome })
  return event
}

// matchMedia を一時的にモックする（jsdom は既定で未実装）。standalone 判定のテストに使う。
function mockMatchMedia(matches) {
  window.matchMedia = vi.fn().mockReturnValue({ matches })
}

afterEach(() => {
  // appinstalled を流して導線を破棄＝各テストの状態をリセットする。
  window.dispatchEvent(new Event('appinstalled'))
  delete window.matchMedia
  vi.restoreAllMocks()
})

describe('canInstall / beforeinstallprompt 捕捉', () => {
  it('初期状態では導線なし（false）', () => {
    expect(canInstall()).toBe(false)
  })

  it('beforeinstallprompt を受けると preventDefault し canInstall() が true になる', () => {
    const event = makeBIPEvent()
    window.dispatchEvent(event)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(canInstall()).toBe(true)
  })

  it('appinstalled で導線が消える（false）', () => {
    window.dispatchEvent(makeBIPEvent())
    expect(canInstall()).toBe(true)
    window.dispatchEvent(new Event('appinstalled'))
    expect(canInstall()).toBe(false)
  })

  it('standalone 起動相当では beforeinstallprompt を受けても導線を出さない', () => {
    mockMatchMedia(true)
    window.dispatchEvent(makeBIPEvent())
    expect(canInstall()).toBe(false)
  })
})

describe('subscribeInstall', () => {
  it('状態変化のたびに listener が呼ばれる', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeInstall(listener)
    window.dispatchEvent(makeBIPEvent())
    expect(listener).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('appinstalled'))
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it('解除関数を呼ぶと以降の変化で listener が呼ばれない', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeInstall(listener)
    unsubscribe()
    window.dispatchEvent(makeBIPEvent())
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('promptInstall', () => {
  it('prompt() を呼び userChoice 後に導線が消え outcome を返す', async () => {
    const event = makeBIPEvent({ outcome: 'accepted' })
    window.dispatchEvent(event)
    expect(canInstall()).toBe(true)

    const outcome = await promptInstall()
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(outcome).toBe('accepted')
    expect(canInstall()).toBe(false)
  })

  it('dismissed でも導線は消える（消費済み）', async () => {
    window.dispatchEvent(makeBIPEvent({ outcome: 'dismissed' }))
    const outcome = await promptInstall()
    expect(outcome).toBe('dismissed')
    expect(canInstall()).toBe(false)
  })

  it('導線が無いときは何もせず null を返す', async () => {
    expect(canInstall()).toBe(false)
    const outcome = await promptInstall()
    expect(outcome).toBeNull()
  })
})
