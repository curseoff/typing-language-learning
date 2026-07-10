import { describe, it, expect } from 'vitest'
// #290 Phase 7: Domain Event。「起きた事実」を不変のイベント値（Value Object 的）で表す。
//   - イベントは payload を注入して作る純ドメイン（Date/乱数を内部で生成しない）。
//   - 生成物は Object.freeze で不変＝「起きた事実」は後から書き換わらない。
//   - 事実の同定に必要な必須情報（sessionId / key）が欠ければ throw。
// 本体 src/domain/events/recordEvents.event.js は coder が Green で作る（現状未実装＝import で undefined）。
import {
  sessionFinishedEvent,
  recordAchievedEvent,
  recordsChangedEvent,
  isDomainEvent,
} from './recordEvents.event.js'

// 時刻は payload の既存値を使う（イベント内で Date を作らない）方針の確認用サンプル。
const sampleRecord = () => ({ date: '2026-07-09T00:00:00.000Z', speed: 120, miss: 3 })

describe('sessionFinishedEvent（セッション完了という事実のイベント値）', () => {
  it("type は 'SessionFinished' 固定", () => {
    const ev = sessionFinishedEvent({ sessionId: 's1', record: sampleRecord() })
    expect(ev.type).toBe('SessionFinished')
  })

  it('注入した sessionId と record を保持する', () => {
    const record = sampleRecord()
    const ev = sessionFinishedEvent({ sessionId: 's1', record })
    expect(ev.sessionId).toBe('s1')
    expect(ev.record).toEqual(record)
  })

  it('返り値は凍結され不変である（Object.isFrozen が true）', () => {
    const ev = sessionFinishedEvent({ sessionId: 's1', record: sampleRecord() })
    expect(Object.isFrozen(ev)).toBe(true)
  })

  it('凍結ゆえプロパティを書き換えても変化しない（事実は不変）', () => {
    const ev = sessionFinishedEvent({ sessionId: 's1', record: sampleRecord() })
    // strict mode でない環境でも黙って無視される想定。値が変わらないことを固定する。
    try { ev.sessionId = 's2' } catch { /* 例外でも許容 */ }
    expect(ev.sessionId).toBe('s1')
  })

  it('sessionId が欠けると throw する（事実の同定に必要）', () => {
    expect(() => sessionFinishedEvent({ record: sampleRecord() })).toThrow()
  })

  it('sessionId が空文字でも throw する', () => {
    expect(() => sessionFinishedEvent({ sessionId: '', record: sampleRecord() })).toThrow()
  })
})

describe('recordAchievedEvent（記録更新という事実のイベント値）', () => {
  it("type は 'RecordAchieved' 固定", () => {
    const ev = recordAchievedEvent({ key: 'L1__すべて__en', record: sampleRecord() })
    expect(ev.type).toBe('RecordAchieved')
  })

  it('注入した key と record を保持する', () => {
    const record = sampleRecord()
    const ev = recordAchievedEvent({ key: 'L1__すべて__en', record })
    expect(ev.key).toBe('L1__すべて__en')
    expect(ev.record).toEqual(record)
  })

  it('返り値は凍結され不変である（Object.isFrozen が true）', () => {
    const ev = recordAchievedEvent({ key: 'L1__すべて__en', record: sampleRecord() })
    expect(Object.isFrozen(ev)).toBe(true)
  })

  it('凍結ゆえプロパティを書き換えても変化しない', () => {
    const ev = recordAchievedEvent({ key: 'k1', record: sampleRecord() })
    try { ev.key = 'k2' } catch { /* 例外でも許容 */ }
    expect(ev.key).toBe('k1')
  })

  it('key が欠けると throw する', () => {
    expect(() => recordAchievedEvent({ record: sampleRecord() })).toThrow()
  })

  it('key が空文字でも throw する', () => {
    expect(() => recordAchievedEvent({ key: '', record: sampleRecord() })).toThrow()
  })
})

describe('recordsChangedEvent（永続データが変わったという事実のイベント値・多タブ同期用）', () => {
  it("type は 'RecordsChanged' 固定", () => {
    const ev = recordsChangedEvent({ epoch: 5 })
    expect(ev.type).toBe('RecordsChanged')
  })

  it('注入した epoch（変更世代）を保持する', () => {
    const ev = recordsChangedEvent({ epoch: 42 })
    expect(ev.epoch).toBe(42)
  })

  it('epoch: 0 は有効（throw せず・境界）', () => {
    const ev = recordsChangedEvent({ epoch: 0 })
    expect(ev.epoch).toBe(0)
    expect(ev.type).toBe('RecordsChanged')
  })

  it('返り値は凍結され不変である（Object.isFrozen が true）', () => {
    const ev = recordsChangedEvent({ epoch: 5 })
    expect(Object.isFrozen(ev)).toBe(true)
  })

  it('凍結ゆえプロパティを書き換えても変化しない（事実は不変）', () => {
    const ev = recordsChangedEvent({ epoch: 5 })
    try { ev.epoch = 99 } catch { /* 例外でも許容 */ }
    expect(ev.epoch).toBe(5)
  })

  it('epoch が欠ける（undefined）と throw する（変更世代の同定に必要）', () => {
    expect(() => recordsChangedEvent({})).toThrow()
  })

  it('epoch が null でも throw する', () => {
    expect(() => recordsChangedEvent({ epoch: null })).toThrow()
  })

  it('返り値は isDomainEvent が true（type を文字列で持つ）', () => {
    expect(isDomainEvent(recordsChangedEvent({ epoch: 0 }))).toBe(true)
  })
})

describe('isDomainEvent（イベント値の判定・throw しない）', () => {
  it('type（文字列）を持つイベント値は true', () => {
    expect(isDomainEvent(sessionFinishedEvent({ sessionId: 's1', record: sampleRecord() }))).toBe(true)
    expect(isDomainEvent(recordAchievedEvent({ key: 'k1', record: sampleRecord() }))).toBe(true)
  })

  it('type を文字列で持つ素のオブジェクトも true（値としてのイベント）', () => {
    expect(isDomainEvent({ type: 'Anything' })).toBe(true)
  })

  it('type が文字列でないオブジェクトは false', () => {
    expect(isDomainEvent({ type: 123 })).toBe(false)
    expect(isDomainEvent({ notType: 'x' })).toBe(false)
  })

  it('null / undefined / プリミティブは false（throw せず）', () => {
    expect(isDomainEvent(null)).toBe(false)
    expect(isDomainEvent(undefined)).toBe(false)
    expect(isDomainEvent('SessionFinished')).toBe(false)
    expect(isDomainEvent(42)).toBe(false)
  })
})
