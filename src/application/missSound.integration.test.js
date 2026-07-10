// @vitest-environment jsdom
// フックのミス分岐で効果音 playMiss() が呼ばれることの結合テスト（useTouch を代表に検証）。
// sound モジュールをモックし、誤打鍵で playMiss が呼ばれ、正打鍵では呼ばれないことを確認する。
// （ミュートで鳴らさない gate は sound.test.js で単体検証済み。ここは「ミスで呼ばれる」配線の確認。）
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../infrastructure/sound.adapter.js', () => ({ playMiss: vi.fn() }))

import { useTouch } from './useTouch.js'
import { playMiss } from '../infrastructure/sound.adapter.js'

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

const press = (key) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })

describe('ミス効果音の配線（useTouch）', () => {
  it('誤ったキーを打つと playMiss が呼ばれる', () => {
    const { result } = renderHook(() => useTouch({ level: 'home', onExit: vi.fn() }))
    const wrong = result.current.target === 'z' ? 'x' : 'z' // target と必ず異なる1文字
    press(wrong)
    expect(playMiss).toHaveBeenCalledTimes(1)
  })

  it('正しいキーを打つと playMiss は呼ばれない', () => {
    const { result } = renderHook(() => useTouch({ level: 'home', onExit: vi.fn() }))
    press(result.current.target)
    expect(playMiss).not.toHaveBeenCalled()
  })
})
