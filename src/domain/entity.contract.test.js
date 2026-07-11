// 既存 Entity（.entity.js）を共通契約（assertEntity）に載せるメタテスト。#324。
// Entity は同一性(id)等価＝id が一致すれば他フィールドが違っても等しい。VO の値等価とは相互排他
// （本契約の「同 id・他フィールド別なら等しい」は VO では必ず落ちる）。#323 の VO 契約と対になる。
// ファイル名は .test.js ＝命名メタテスト（.entity.js サフィックス強制）の対象外。
import { describe } from 'vitest'
import { assertEntity } from '../test/contracts/entity.js'
import { startTypingSession, sessionEquals } from './session/typingSession.entity.js'
import { makeEndCondition } from './session/endCondition.vo.js'
import { makeItemStat, itemStatEquals } from './records/itemStat.entity.js'

describe('Entity契約: TypingSession', () =>
  assertEntity({
    make: (a) => startTypingSession(a),
    equals: sessionEquals,
    withId: (id, o) => ({
      id,
      endCondition: makeEndCondition(o?.differ ? 'chars' : 'time', o?.differ ? 600 : 60),
    }),
    evolve: (s) => {
      s.registerHit() // 可変メソッドで状態遷移（id 不変）
      return s
    },
    invalid: [
      { id: '', endCondition: makeEndCondition('time', 60) }, // 空 id
      { id: 'X' }, // endCondition 欠落
    ],
  }))

describe('Entity契約: ItemStat', () =>
  assertEntity({
    make: (a) => makeItemStat(a),
    equals: itemStatEquals,
    withId: (id, o) => ({
      id,
      count: o?.differ ? 9 : 0,
      keys: o?.differ ? 5 : 0,
      mistakes: 0,
      ms: 0,
    }),
    evolve: (e) => e.recordAttempt({ keys: 1, mistakes: 0, ms: 10 }), // 新インスタンス・同 id
    invalid: [
      { id: '' }, // 空 id
      { id: 'X', count: -1 }, // 不変条件違反（負）
      { id: 'X', keys: 1.5 }, // 不変条件違反（非整数）
    ],
  }))
