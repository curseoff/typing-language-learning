import { describe, it, expect } from 'vitest'
// #273 Phase3b: 副タブの BroadcastChannel 受信判断（純関数・DOM/infra 非依存）。
// coder が後で Green にする src/application/persist/secondaryMessage.js を対象にする。
// state = { epoch: number }（副が把握している最新 epoch）
// 戻り値 = { nextState, effect } / effect ∈ 'request-snapshot'|'replace-image'|'ignore'
import { isStale, handleSecondaryMessage } from './secondaryMessage.js'

describe('isStale（古いエポックのメッセージ棄却判定）', () => {
  it('msgEpoch が myEpoch より小さければ stale=true', () => {
    expect(isStale(1, 2)).toBe(true)
  })

  it('msgEpoch と myEpoch が同値なら stale=false', () => {
    expect(isStale(2, 2)).toBe(false)
  })

  it('msgEpoch が myEpoch より大きければ stale=false', () => {
    expect(isStale(3, 2)).toBe(false)
  })

  // 仕様固定: エポック不明は stale 扱い（安全側＝棄却）。
  it('msgEpoch が null なら stale=true（不明は棄却）', () => {
    expect(isStale(null, 2)).toBe(true)
  })

  it('msgEpoch が undefined なら stale=true（不明は棄却）', () => {
    expect(isStale(undefined, 2)).toBe(true)
  })
})

describe('handleSecondaryMessage（副タブ受信の effect と epoch 更新・純関数）', () => {
  describe('primary-changed（新主の告知）', () => {
    it('新しい epoch の告知で snapshot を要求し epoch を max へ更新する', () => {
      expect(
        handleSecondaryMessage({ epoch: 2 }, { type: 'primary-changed', epoch: 4 }),
      ).toEqual({ nextState: { epoch: 4 }, effect: 'request-snapshot' })
    })

    it('自分より古い epoch の告知でも snapshot を要求し epoch は max で据え置く', () => {
      // 主交代の告知は常に snapshot 再取得の契機。epoch は下げない（max）。
      expect(
        handleSecondaryMessage({ epoch: 5 }, { type: 'primary-changed', epoch: 3 }),
      ).toEqual({ nextState: { epoch: 5 }, effect: 'request-snapshot' })
    })
  })

  describe('snapshot（像の受領）', () => {
    it('新しい/同値の epoch なら像を差し替え epoch を snapshot の値へ更新する', () => {
      expect(
        handleSecondaryMessage({ epoch: 2 }, { type: 'snapshot', epoch: 4, image: { a: 1 } }),
      ).toEqual({ nextState: { epoch: 4 }, effect: 'replace-image' })
    })

    it('同値 epoch の snapshot でも像を差し替える（stale ではない）', () => {
      expect(
        handleSecondaryMessage({ epoch: 3 }, { type: 'snapshot', epoch: 3, image: {} }),
      ).toEqual({ nextState: { epoch: 3 }, effect: 'replace-image' })
    })

    it('stale な snapshot（epoch < state.epoch）は ignore し epoch を据え置く', () => {
      expect(
        handleSecondaryMessage({ epoch: 5 }, { type: 'snapshot', epoch: 3, image: {} }),
      ).toEqual({ nextState: { epoch: 5 }, effect: 'ignore' })
    })
  })

  describe('change（主タブの変更通知）', () => {
    it('新しい epoch の変更通知で snapshot を要求し epoch を max へ更新する', () => {
      expect(handleSecondaryMessage({ epoch: 2 }, { type: 'change', epoch: 4 })).toEqual({
        nextState: { epoch: 4 },
        effect: 'request-snapshot',
      })
    })

    it('同値 epoch の変更通知でも snapshot を要求する（stale ではない）', () => {
      expect(handleSecondaryMessage({ epoch: 4 }, { type: 'change', epoch: 4 })).toEqual({
        nextState: { epoch: 4 },
        effect: 'request-snapshot',
      })
    })

    it('stale な変更通知（epoch < state.epoch）は ignore し epoch を据え置く', () => {
      expect(handleSecondaryMessage({ epoch: 5 }, { type: 'change', epoch: 3 })).toEqual({
        nextState: { epoch: 5 },
        effect: 'ignore',
      })
    })
  })

  describe('未知 type / 不変条件', () => {
    it('未知 type は ignore し state を据え置く', () => {
      expect(handleSecondaryMessage({ epoch: 3 }, { type: 'bogus', epoch: 9 })).toEqual({
        nextState: { epoch: 3 },
        effect: 'ignore',
      })
    })

    it('effect は必ず 3 値のいずれか（request-snapshot / replace-image / ignore）', () => {
      const allowed = ['request-snapshot', 'replace-image', 'ignore']
      const msgs = [
        { type: 'primary-changed', epoch: 4 },
        { type: 'snapshot', epoch: 4, image: {} },
        { type: 'snapshot', epoch: 1, image: {} },
        { type: 'change', epoch: 4 },
        { type: 'change', epoch: 1 },
        { type: 'bogus', epoch: 4 },
      ]
      for (const m of msgs) {
        const { effect } = handleSecondaryMessage({ epoch: 3 }, m)
        expect(allowed).toContain(effect)
      }
    })

    it('入力 state を破壊しない（新オブジェクトを返す）', () => {
      const state = { epoch: 2 }
      const { nextState } = handleSecondaryMessage(state, { type: 'change', epoch: 4 })
      expect(state).toEqual({ epoch: 2 }) // 元は不変
      expect(nextState).not.toBe(state) // 別インスタンス
    })
  })
})
