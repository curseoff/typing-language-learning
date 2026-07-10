import { describe, it, expect } from 'vitest'
// #290 Phase 2: 「プレイ1回」を Entity `TypingSession` として表す。
// VO（Phase1 の EndCondition）との対比を体現する：
//   VO      … 不変・値等価（同じ値なら等しい）。
//   Entity  … ID を持つ／状態が変わる／ライフサイクル(active→finished)／不変条件を守る／同一性で等価。
// しかも EndCondition VO を内包（Entity が VO を合成して持つ）。ID は純ドメインで作れないので注入する。
//
// 本体 src/domain/session/typingSession.js は coder が Green で作る（現状未実装＝import で undefined）。
import { startTypingSession, sessionEquals } from './typingSession.js'
// 内包する VO は Phase1 の makeEndCondition で作る（Entity は妥当な VO を合成する）。
import { makeEndCondition, isEndCondition } from './endCondition.js'

// テスト用の妥当な終了条件（十分大きく＝初期状態では終了条件未達）。
const time60 = () => makeEndCondition('time', 60)

describe('startTypingSession（Entity の生成・自己検証）', () => {
  describe('id の検証（非空文字列必須）', () => {
    it('空文字列の id は throw する', () => {
      expect(() => startTypingSession({ id: '', endCondition: time60() })).toThrow()
    })

    it('null の id は throw する', () => {
      expect(() => startTypingSession({ id: null, endCondition: time60() })).toThrow()
    })

    it('undefined の id は throw する', () => {
      expect(() => startTypingSession({ endCondition: time60() })).toThrow()
    })

    it('非文字列（数値）の id は throw する', () => {
      expect(() => startTypingSession({ id: 123, endCondition: time60() })).toThrow()
    })
  })

  describe('endCondition の検証（妥当な VO 必須＝VO の合成）', () => {
    it('endCondition が無いと throw する', () => {
      expect(() => startTypingSession({ id: 's1' })).toThrow()
    })

    it('isEndCondition を満たさない不正な終了条件は throw する', () => {
      // value が不正な生オブジェクト（makeEndCondition を通していない）＝妥当な VO ではない。
      expect(() => startTypingSession({ id: 's1', endCondition: { kind: 'time', value: 0 } })).toThrow()
    })

    it('未知 kind の終了条件は throw する', () => {
      expect(() => startTypingSession({ id: 's1', endCondition: { kind: 'bogus', value: 1 } })).toThrow()
    })
  })

  describe('初期状態', () => {
    it('id を保持する', () => {
      const s = startTypingSession({ id: 's1', endCondition: time60() })
      expect(s.id).toBe('s1')
    })

    it('status() は active で始まる', () => {
      const s = startTypingSession({ id: 's1', endCondition: time60() })
      expect(s.status()).toBe('active')
    })

    it('isFinished() は初期状態では false（進捗ゼロで終了条件未達）', () => {
      const s = startTypingSession({ id: 's1', endCondition: time60() })
      expect(s.isFinished()).toBe(false)
    })

    it('progress() は全カウンタがゼロのスナップショット', () => {
      const s = startTypingSession({ id: 's1', endCondition: time60() })
      expect(s.progress()).toEqual({
        keys: 0,
        mistakes: 0,
        items: 0,
        missedItems: 0,
        elapsedMs: 0,
      })
    })

    it('endCondition は内包した妥当な VO（isEndCondition true・凍結）', () => {
      const s = startTypingSession({ id: 's1', endCondition: time60() })
      expect(isEndCondition(s.endCondition)).toBe(true)
      expect(Object.isFrozen(s.endCondition)).toBe(true)
    })
  })
})

describe('TypingSession の可変な振る舞い（Entity の状態変化）', () => {
  it('registerHit() で keys が +1 される', () => {
    const s = startTypingSession({ id: 's1', endCondition: time60() })
    s.registerHit()
    expect(s.progress().keys).toBe(1)
    s.registerHit()
    expect(s.progress().keys).toBe(2)
  })

  it('registerMiss() で mistakes が +1 される', () => {
    const s = startTypingSession({ id: 's1', endCondition: time60() })
    s.registerMiss()
    expect(s.progress().mistakes).toBe(1)
  })

  it('advanceItem() で items が +1 される（missed 既定 false は missedItems を増やさない）', () => {
    const s = startTypingSession({ id: 's1', endCondition: time60() })
    s.advanceItem()
    expect(s.progress().items).toBe(1)
    expect(s.progress().missedItems).toBe(0)
  })

  it('advanceItem(true) で items と missedItems が両方 +1 される', () => {
    const s = startTypingSession({ id: 's1', endCondition: time60() })
    s.advanceItem(true)
    expect(s.progress().items).toBe(1)
    expect(s.progress().missedItems).toBe(1)
  })

  it('setElapsed(ms) で elapsedMs が設定される', () => {
    const s = startTypingSession({ id: 's1', endCondition: time60() })
    s.setElapsed(1234)
    expect(s.progress().elapsedMs).toBe(1234)
  })

  it('finish() で status() が finished になる', () => {
    const s = startTypingSession({ id: 's1', endCondition: time60() })
    s.finish()
    expect(s.status()).toBe('finished')
    expect(s.isFinished()).toBe(true)
  })
})

describe('ライフサイクル & 不変条件（finished 後は状態を変えない）', () => {
  it('finish() 後の registerHit() は throw する', () => {
    const s = startTypingSession({ id: 's1', endCondition: time60() })
    s.finish()
    expect(() => s.registerHit()).toThrow()
  })

  it('finish() 後の registerMiss() は throw する', () => {
    const s = startTypingSession({ id: 's1', endCondition: time60() })
    s.finish()
    expect(() => s.registerMiss()).toThrow()
  })

  it('finish() 後の advanceItem() は throw する', () => {
    const s = startTypingSession({ id: 's1', endCondition: time60() })
    s.finish()
    expect(() => s.advanceItem()).toThrow()
  })

  it('finish() 後の setElapsed() は throw する（終了後の時間更新も禁止）', () => {
    const s = startTypingSession({ id: 's1', endCondition: time60() })
    s.finish()
    expect(() => s.setElapsed(1000)).toThrow()
  })
})

describe('isFinished() は endCondition を見る（明示 finish していなくても達すれば true）', () => {
  it('time60 に setElapsed(60000) で isFinished() が true になる', () => {
    const s = startTypingSession({ id: 's1', endCondition: makeEndCondition('time', 60) })
    expect(s.isFinished()).toBe(false)
    s.setElapsed(60000)
    expect(s.isFinished()).toBe(true)
  })

  it('time60 に setElapsed(59999) では isFinished() は false（直前）', () => {
    const s = startTypingSession({ id: 's1', endCondition: makeEndCondition('time', 60) })
    s.setElapsed(59999)
    expect(s.isFinished()).toBe(false)
  })

  it('chars5 で registerHit() を5回 → isFinished() が true になる', () => {
    const s = startTypingSession({ id: 's1', endCondition: makeEndCondition('chars', 5) })
    for (let i = 0; i < 4; i++) s.registerHit()
    expect(s.isFinished()).toBe(false)
    s.registerHit()
    expect(s.isFinished()).toBe(true)
  })

  it('life1 で advanceItem(true) 1回 → isFinished() が true になる', () => {
    const s = startTypingSession({ id: 's1', endCondition: makeEndCondition('life', 1) })
    expect(s.isFinished()).toBe(false)
    s.advanceItem(true)
    expect(s.isFinished()).toBe(true)
  })

  it('endless は setElapsed が大でも isFinished() は false（明示 finish するまで）', () => {
    const s = startTypingSession({ id: 's1', endCondition: makeEndCondition('endless') })
    s.setElapsed(10 ** 9)
    expect(s.isFinished()).toBe(false)
    s.finish()
    expect(s.isFinished()).toBe(true)
  })
})

describe('progress() は凍結スナップショット（内部状態のカプセル化）', () => {
  it('返り値は凍結されている', () => {
    const s = startTypingSession({ id: 's1', endCondition: time60() })
    expect(Object.isFrozen(s.progress())).toBe(true)
  })

  it('返り値を書き換えても session 内部は不変（別スナップショット）', () => {
    const s = startTypingSession({ id: 's1', endCondition: time60() })
    const snap = s.progress()
    // 凍結のため代入は無効（strict では throw しうるので try で吸収）＝いずれにせよ内部は変わらない。
    try {
      snap.keys = 999
    } catch {
      // 凍結オブジェクトへの代入は strict モードで throw する。ここでは無視。
    }
    expect(s.progress().keys).toBe(0)
  })

  it('registerHit() 後に取り直した snapshot は前の snapshot と別物（都度新しい凍結オブジェクト）', () => {
    const s = startTypingSession({ id: 's1', endCondition: time60() })
    const before = s.progress()
    s.registerHit()
    const after = s.progress()
    expect(before.keys).toBe(0)
    expect(after.keys).toBe(1)
  })
})

describe('sessionEquals（同一性＝ID 等価・VO の値等価との決定的な違い）', () => {
  it('同じ id なら進捗が違っても等しい（実体は状態が変わっても同じもの）', () => {
    const a = startTypingSession({ id: 's1', endCondition: time60() })
    const b = startTypingSession({ id: 's1', endCondition: time60() })
    a.registerHit()
    a.advanceItem(true)
    // b は進捗ゼロのまま。ID が同じなら等しい。
    expect(sessionEquals(a, b)).toBe(true)
  })

  it('違う id なら進捗も endCondition も同一でも等しくない（値が同じでも別の実体）', () => {
    const a = startTypingSession({ id: 's1', endCondition: time60() })
    const b = startTypingSession({ id: 's2', endCondition: time60() })
    expect(sessionEquals(a, b)).toBe(false)
  })

  it('自分自身とは等しい', () => {
    const a = startTypingSession({ id: 's1', endCondition: time60() })
    expect(sessionEquals(a, a)).toBe(true)
  })

  it('一方が null なら throw せず false', () => {
    const a = startTypingSession({ id: 's1', endCondition: time60() })
    expect(sessionEquals(a, null)).toBe(false)
    expect(sessionEquals(null, a)).toBe(false)
  })

  it('両方 null / 不正なオブジェクトでも throw せず false', () => {
    expect(sessionEquals(null, null)).toBe(false)
    expect(sessionEquals({}, {})).toBe(false)
  })
})
