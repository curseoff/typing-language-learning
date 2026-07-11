// 既存の Repository（.repository.js）を共通契約（assertRepository）に載せるメタテスト。#329。
// domain Port（ranking.repository.js）を2つの backing で適用する＝
//   (1) createInMemoryRankingStore（学習/テスト用 in-memory アダプタ）
//   (2) テスト内に定義する mock store（プレーンオブジェクト backing の別アダプタ）
// 同じ契約が別 backing で成立する＝Repository が永続化の詳細を知らない（永続化無知）ことの証明。
// #323 の VO 契約・#324 の Entity 契約・#325 の Aggregate 契約と対になる（純粋・jsdom 不要）。
// ファイル名は .test.js ＝命名メタテスト（.repository.js サフィックス強制）の対象外。
import { describe } from 'vitest'
import { assertRepository } from '../test/contracts/repository.js'
import {
  createInMemoryRankingStore,
  createRankingRepository,
} from './records/ranking.repository.js'
import { makeEndCondition } from './session/endCondition.vo.js'
import { compareRecords, MAX_RECORDS } from './records/ranking.service.js'

const EC = makeEndCondition('time', 60) // time60＝keys 降順→mistakes 昇順で並ぶ
const KEY = 'both__r1'
// time60 の記録（スコア＝keys だけ変える）。
const rec = (keys) => ({ keys, mistakes: 0, date: '2026-01-01' })

// 独立な構造等価（repo 内部を再呼びせず素のロジックで判定）。
const eq = (a, b) => {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => eq(a[k], b[k]))
}
const reflectsOne = (stored, r) => stored.some((x) => eq(x, r))
// 独立比較器（compareRecords 準拠）で昇位順に並んでいるか（repo が返した順を正解にしない）。
const isSorted = (list) =>
  list.every((_, i) => i === 0 || compareRecords(EC, list[i - 1], list[i]) <= 0)

// backing を差し替えるだけの共通アダプタ。submitRecord が RMW を担い、findByKey?.entries() で読む。
const adapterFrom = (makeStore) => () => {
  const repo = createRankingRepository(makeStore())
  return {
    save: (r) => repo.submitRecord(KEY, EC, r),
    load: () => repo.findByKey(KEY, EC)?.entries() ?? [],
  }
}

// in-memory とは別バックエンド（Port の別アダプタ）。プレーンオブジェクト backing。
const makeMockStore = () => {
  const backing = {}
  return {
    load: (key) => (key in backing ? backing[key] : undefined),
    save: (key, records) => {
      backing[key] = records.map((x) => ({ ...x }))
    },
  }
}

describe('Repository契約: RankingRepository（in-memory store）', () =>
  assertRepository({
    newRepo: adapterFrom(createInMemoryRankingStore),
    keyFor: () => KEY,
    sample: (i = 0) => rec(100 + i),
    reflectsOne,
    isSorted,
    cap: MAX_RECORDS,
    worse: rec(0), // 満杯（keys 100..114）の全既存より悪い
  }))

describe('Repository契約: RankingRepository（mock store・別 backing で同契約＝永続化無知）', () =>
  assertRepository({
    newRepo: adapterFrom(makeMockStore),
    keyFor: () => KEY,
    sample: (i = 0) => rec(100 + i),
    reflectsOne,
    isSorted,
    cap: MAX_RECORDS,
    worse: rec(0),
  }))
