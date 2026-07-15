import { describe, it, expect } from 'vitest'
// #426 対戦基盤スライス1：対戦の状態機械 transition(state, event) → newState。
// 本体 src/domain/versus/matchState.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：React/DOM/Date/performance/乱数 非依存・副作用なし・決定的・入力非破壊。
import { transition } from './matchState.service.js'

// 列挙値（phase）。
const PHASES = ['waiting', 'connecting', 'countdown', 'running', 'finished']

describe('transition（#426・対戦の状態機械）', () => {
  describe('正常遷移一覧', () => {
    it('waiting + connectStarted → connecting', () => {
      expect(transition({ phase: 'waiting' }, { type: 'connectStarted' }).phase).toBe('connecting')
    })

    it('connecting + allConnected → countdown', () => {
      expect(transition({ phase: 'connecting' }, { type: 'allConnected' }).phase).toBe('countdown')
    })

    it('countdown + raceStarted → running', () => {
      expect(transition({ phase: 'countdown' }, { type: 'raceStarted' }).phase).toBe('running')
    })

    it('running + allFinished → finished', () => {
      expect(transition({ phase: 'running' }, { type: 'allFinished' }).phase).toBe('finished')
    })
  })

  describe('aborted は任意 phase から finished（reason 伝播）', () => {
    it.each(PHASES.filter((p) => p !== 'finished'))('%s + aborted → finished', (phase) => {
      expect(transition({ phase }, { type: 'aborted' }).phase).toBe('finished')
    })

    it('event.reason があれば state.reason に載せる', () => {
      const next = transition({ phase: 'running' }, { type: 'aborted', reason: 'peer-disconnected' })
      expect(next.phase).toBe('finished')
      expect(next.reason).toBe('peer-disconnected')
    })

    it('event.reason が無ければ reason は載らない（undefined）', () => {
      const next = transition({ phase: 'running' }, { type: 'aborted' })
      expect(next.phase).toBe('finished')
      expect(next.reason).toBeUndefined()
    })
  })

  describe('端ケース：未定義遷移・未知 event は現状維持（不変・throwしない）', () => {
    it('waiting + allFinished（未定義）は waiting のまま', () => {
      expect(transition({ phase: 'waiting' }, { type: 'allFinished' }).phase).toBe('waiting')
    })

    it('connecting + raceStarted（未定義）は connecting のまま', () => {
      expect(transition({ phase: 'connecting' }, { type: 'raceStarted' }).phase).toBe('connecting')
    })

    it('countdown + connectStarted（未定義）は countdown のまま', () => {
      expect(transition({ phase: 'countdown' }, { type: 'connectStarted' }).phase).toBe('countdown')
    })

    it('running + allConnected（未定義）は running のまま', () => {
      expect(transition({ phase: 'running' }, { type: 'allConnected' }).phase).toBe('running')
    })

    it('未知の event.type は現状維持', () => {
      expect(transition({ phase: 'countdown' }, { type: 'unknownEvent' }).phase).toBe('countdown')
    })

    it('未定義遷移でも throw しない', () => {
      expect(() => transition({ phase: 'waiting' }, { type: 'raceStarted' })).not.toThrow()
    })
  })

  describe('finished は終端', () => {
    it('finished + allConnected は finished のまま', () => {
      expect(transition({ phase: 'finished' }, { type: 'allConnected' }).phase).toBe('finished')
    })

    it('finished + aborted も finished のまま', () => {
      expect(transition({ phase: 'finished' }, { type: 'aborted' }).phase).toBe('finished')
    })
  })

  describe('純粋性：入力オブジェクト非破壊・返り値 phase は列挙値のみ', () => {
    it('元の state オブジェクトを破壊しない（新オブジェクト返却）', () => {
      const state = { phase: 'waiting' }
      const next = transition(state, { type: 'connectStarted' })
      expect(state.phase).toBe('waiting') // 元は不変
      expect(next).not.toBe(state) // 別オブジェクト
    })

    it('元の event オブジェクトを破壊しない', () => {
      const event = { type: 'aborted', reason: 'timeout' }
      transition({ phase: 'running' }, event)
      expect(event).toEqual({ type: 'aborted', reason: 'timeout' })
    })

    it('返り値 phase は列挙値のいずれか', () => {
      const cases = [
        [{ phase: 'waiting' }, { type: 'connectStarted' }],
        [{ phase: 'connecting' }, { type: 'allConnected' }],
        [{ phase: 'countdown' }, { type: 'raceStarted' }],
        [{ phase: 'running' }, { type: 'allFinished' }],
        [{ phase: 'waiting' }, { type: 'aborted' }],
        [{ phase: 'running' }, { type: 'unknownEvent' }],
      ]
      for (const [state, event] of cases) {
        expect(PHASES).toContain(transition(state, event).phase)
      }
    })

    it('同一入力からは何度呼んでも等価な結果（決定的）', () => {
      const a = transition({ phase: 'countdown' }, { type: 'raceStarted' })
      const b = transition({ phase: 'countdown' }, { type: 'raceStarted' })
      expect(a).toEqual(b)
    })
  })
})
