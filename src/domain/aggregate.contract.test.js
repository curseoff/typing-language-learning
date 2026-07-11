// 既存の Aggregate Root（.aggregate.js）を共通契約（assertAggregate）に載せるメタテスト。#325。
// Aggregate は Entity の同一性(key/id)等価に「集合全体の不変条件を根が常に保証」を足したもの
// ＝変更経路をルート(submit)に限定し、外部へは凍結スナップショットしか渡さず、上限などの
// 不変条件をどの操作後も保つ。#324 の Entity 契約・#323 の VO 契約と対になる。
// ファイル名は .test.js ＝命名メタテスト（.aggregate.js サフィックス強制）の対象外。
import { describe } from 'vitest'
import { assertAggregate } from '../test/contracts/aggregate.js'
import { makeRankingBoard, rankingBoardEquals } from './records/rankingBoard.aggregate.js'
import { makeEndCondition } from './session/endCondition.vo.js'

// time60 の記録（keys 降順→mistakes 昇順で並ぶ）。
const rec = (keys, mistakes = 0) => ({ keys, mistakes, date: '2026-01-01' })

// 満杯（keys 1..15＝MAX_RECORDS 件）の集約を作る make 引数を毎回新しく返す。
const fullEntries = () => {
  const entries = []
  for (let i = 1; i <= 15; i++) entries.push(rec(i))
  return entries
}

describe('Aggregate契約: RankingBoard', () =>
  assertAggregate({
    make: (a) => makeRankingBoard(a),
    equals: rankingBoardEquals,
    submit: (root, r) => root.submit(r),
    entries: (root) => root.entries(),
    sample: () => ({
      key: 'both__r1',
      endCondition: makeEndCondition('time', 60),
      entries: fullEntries(),
    }),
    worseRecord: rec(0), // keys=0 ＝満杯の全既存 keys>=1 より悪い（採用されない）
  }))
