// 既存の Factory（.factory.js）を共通契約（assertFactory）に載せるメタテスト。#326。
// Factory は「生成手順（採番＋endCondition VO の合成）」の集約＝Entity の同一性(ID)を、外部から
// 注入された ID 生成器（nextId）から供給する。純ドメインは ID を作れないため決定性は注入器で担保する。
// #324 の Entity 契約と対になる（Factory が生み出すのは同一性を持つ Entity）。
// ファイル名は .test.js ＝命名メタテスト（.factory.js サフィックス強制）の対象外。
import { describe } from 'vitest'
import { assertFactory } from '../test/contracts/factory.js'
import { createTypingSessionFactory } from './session/typingSession.factory.js'
import { sessionEquals } from './session/typingSession.entity.js'
import { makeEndCondition } from './session/endCondition.vo.js'

describe('Factory契約: TypingSessionFactory', () =>
  assertFactory({
    createFactory: (nextId) => createTypingSessionFactory(nextId),
    start: (f, ec) => f.start(ec),
    equals: sessionEquals,
    sampleEC: () => makeEndCondition('time', 60),
    // startTypingSession が isEndCondition 不成立で throw する不正 EC（実装で確認済み）。
    invalidEC: [null, { kind: 'mystery' }, undefined],
  }))
