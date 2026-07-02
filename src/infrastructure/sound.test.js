// @vitest-environment jsdom
// 効果音再生のミュートゲート単体テスト。純粋な shouldPlayMiss と、playMiss がミュート時に
// AudioContext へ一切触れない（＝実再生に入らない）ことを検証する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { shouldPlayMiss, playMiss, _resetForTest } from './sound.js'
import { setSoundMuted } from './soundSettingsRepository.js'

// AudioContext のスパイ生成器。コンストラクタ呼び出し回数で「実再生に入ったか」を観測する。
function installFakeAudio() {
  const source = { connect: vi.fn(), start: vi.fn(), buffer: null }
  const instance = {
    state: 'running',
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createBufferSource: vi.fn(() => source),
    decodeAudioData: vi.fn(() => Promise.resolve({})),
  }
  const ctor = vi.fn(() => instance)
  globalThis.AudioContext = ctor
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
  )
  return { ctor, instance, source }
}

describe('infrastructure/sound', () => {
  beforeEach(() => {
    localStorage.clear()
    _resetForTest()
  })
  afterEach(() => {
    delete globalThis.AudioContext
    delete globalThis.fetch
    vi.restoreAllMocks()
  })

  it('shouldPlayMiss はミュートで false・非ミュートで true', () => {
    expect(shouldPlayMiss(false)).toBe(true)
    expect(shouldPlayMiss(true)).toBe(false)
  })

  it('ミュート時は AudioContext に触れない（実再生に入らない）', () => {
    const { ctor } = installFakeAudio()
    setSoundMuted(true)
    playMiss()
    expect(ctor).not.toHaveBeenCalled()
  })

  it('非ミュート時は AudioContext を生成する（再生経路に入る）', () => {
    const { ctor } = installFakeAudio()
    setSoundMuted(false)
    playMiss()
    expect(ctor).toHaveBeenCalledTimes(1)
  })

  it('AudioContext 非対応環境でも例外を投げない（ベストエフォート）', () => {
    delete globalThis.AudioContext
    setSoundMuted(false)
    expect(() => playMiss()).not.toThrow()
  })
})
