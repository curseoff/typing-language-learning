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
  // new で使うため通常関数（アロー関数は new 不可）。オブジェクトを返すと new はそれを返す。
  const ctor = vi.fn(function () {
    return instance
  })
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

  it('webkitAudioContext のみの環境でもコンテキストを生成する', () => {
    delete globalThis.AudioContext
    const instance = {
      state: 'running',
      destination: {},
      resume: vi.fn(() => Promise.resolve()),
      createBufferSource: vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), buffer: null })),
      decodeAudioData: vi.fn(() => Promise.resolve({})),
    }
    const ctor = vi.fn(function () {
      return instance
    })
    globalThis.webkitAudioContext = ctor
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    )
    setSoundMuted(false)
    playMiss()
    expect(ctor).toHaveBeenCalledTimes(1)
    delete globalThis.webkitAudioContext
  })

  it('バッファ読込後は BufferSource を生成して鳴らす', async () => {
    const { instance, source } = installFakeAudio()
    setSoundMuted(false)
    playMiss() // ctx 生成＋fetch/decode 起動（初回はバッファ未準備で無音）
    // fetch→arrayBuffer→decodeAudioData→missBuffer 反映のマイクロタスク連鎖を流す
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    expect(instance.decodeAudioData).toHaveBeenCalled()
    playMiss() // 今度はバッファ準備済み＝再生経路に入る
    expect(source.connect).toHaveBeenCalledWith(instance.destination)
    expect(source.start).toHaveBeenCalled()
  })

  it('suspended のコンテキストは再利用時に resume する', () => {
    const { ctor, instance } = installFakeAudio()
    setSoundMuted(false)
    playMiss() // 1回目でコンテキスト生成
    instance.state = 'suspended'
    playMiss() // 2回目は既存を再利用しつつ resume
    expect(ctor).toHaveBeenCalledTimes(1)
    expect(instance.resume).toHaveBeenCalled()
  })
})
