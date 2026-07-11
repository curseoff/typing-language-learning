// 既存の Domain Event（.event.js）を共通契約（assertDomainEvent）に載せるメタテスト。#327。
// Domain Event は「起きた事実」を不変の値で表す＝type を過去形で持ち、payload は外から注入して
// 受け取る（時刻/id を内部生成しない＝決定的）。生成物は Object.freeze で後から書き換わらない。
// #323 の VO 契約と同系の値法則を、イベントの「事実性」に合わせて確認する。
// ファイル名は .test.js ＝命名メタテスト（.event.js サフィックス強制）の対象外。
import { describe } from 'vitest'
import { assertDomainEvent } from '../test/contracts/domainEvent.js'
import {
  sessionFinishedEvent,
  recordAchievedEvent,
  recordsChangedEvent,
} from './events/recordEvents.event.js'

describe('DomainEvent契約: SessionFinished', () =>
  assertDomainEvent({
    makeEvent: (p) => sessionFinishedEvent(p),
    samplePayload: () => ({ sessionId: 's1', record: { keys: 100 } }),
    expectedType: 'SessionFinished',
    invalidPayload: [{ record: {} }], // sessionId 欠落で throw
  }))

describe('DomainEvent契約: RecordAchieved', () =>
  assertDomainEvent({
    makeEvent: (p) => recordAchievedEvent(p),
    samplePayload: () => ({ key: 'both__r1', record: { keys: 100 } }),
    expectedType: 'RecordAchieved',
    invalidPayload: [{ record: {} }], // key 欠落で throw
  }))

describe('DomainEvent契約: RecordsChanged', () =>
  assertDomainEvent({
    makeEvent: (p) => recordsChangedEvent(p),
    samplePayload: () => ({ epoch: 5 }),
    expectedType: 'RecordsChanged',
    invalidPayload: [{}], // epoch 欠落（null/undefined）で throw。0 は妥当
  }))
