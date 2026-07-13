// 既存 Value Object（.vo.js）を共通契約（assertValueObject）に載せるメタテスト。#323 / #383。
// VO 契約は2層：普遍層（全 VO 共通＝不変・自己検証・非identity deep-equal）＋任意層（equals を持つ VO のみ＝
// 値等価・非等価・null 安全）。値等価を持つ VO は両層、持たない VO は普遍層のみで検証する。
// ファイル名は .test.js ＝命名メタテスト（.vo.js サフィックス強制）の対象外。
//
// 【普遍層のみで被覆する .vo.js（値等価 *Equals を持たない）】
//   - ScoreRecord（records/scoreRecord.vo.js）… VO（集約 RankingBoard の内部エントリ値）だが、ドメインの
//     操作は順序づけ（compareRecords）であって値等価ではない＝ *Equals を持たないのは妥当（scoreRecordEquals
//     は YAGNI）。#383 の2層化で普遍層（不変・自己検証・非identity deep-equal）だけで被覆する（下の
//     「VO契約(普遍層): ScoreRecord」describe＝equals/mutate を渡さない）。
//
// 【本契約の対象外の .vo.js（理由を明記・無理に契約へ載せない）】
//   - RankingBoard（records/rankingBoard.aggregate.js）… Aggregate（集約ルート）で同一性は key の Entity。
//     rankingBoardEquals は key 基準の identity 等価（entries が違っても等しい）＝値等価法則
//     （値が違えば等しくない）に載らない＝本契約の対象外。
//   - kanaTable（packages/core/src/romaji/kanaTable.vo.js）… KANA_TABLE は凍結済みの定数テーブルで
//     make*/*Equals 形のファクトリ VO ではない（KANA_TABLE 定数＋kanaOf/cellOf 関数）＝値等価契約の形に
//     載らない。#383 の2層化に合わせ、凍結（deep-freeze）と kanaOf/cellOf の契約は packages/core 側の
//     専用テスト（romaji/kanaTable.contract.test.ts）で担保する＝本ファイル（値等価契約）の対象外。
import { describe } from 'vitest'
import { assertValueObject } from '../test/contracts/valueObject.js'
import { makeEndCondition, endConditionEquals } from './session/endCondition.vo.js'
import { makeScore, scoreEquals } from './records/score.vo.js'
import { makeProgress, progressEquals } from './session/progress.vo.js'
import { makeScoreRecord } from './records/scoreRecord.vo.js'

describe('VO契約: EndCondition', () =>
  assertValueObject({
    make: (a) => makeEndCondition(a.kind, a.value), // positional 引数
    equals: endConditionEquals,
    sample: () => ({ kind: 'time', value: 60 }),
    mutate: (a) => ({ ...a, value: 30 }),
    invalid: [
      { kind: 'time', value: -1 }, // counted 系の value は正の有限数
      { kind: 'unknown', value: 1 }, // 未知 kind
    ],
  }))

describe('VO契約: Score', () =>
  assertValueObject({
    make: (a) => makeScore(a),
    equals: scoreEquals,
    sample: () => ({ keys: 90, mistakes: 10, elapsedMs: 60000 }),
    mutate: (a) => ({ ...a, keys: 91 }),
    invalid: [{ keys: -1, mistakes: 0, elapsedMs: 0 }], // keys は非負整数
  }))

describe('VO契約: Progress', () =>
  assertValueObject({
    make: (a) => makeProgress(a),
    equals: progressEquals,
    sample: () => ({ keys: 5, mistakes: 2, items: 1, missedItems: 0, elapsedMs: 1000 }),
    mutate: (a) => ({ ...a, keys: 6 }),
    invalid: [
      { keys: -1 }, // keys は非負整数
      { items: 1, missedItems: 2 }, // 不変条件 missedItems<=items 違反
    ],
  }))

// #383: 普遍層のみで assertValueObject に載せる（equals/mutate を渡さない）。
// ScoreRecord は値等価(*Equals)を持たない VO なので、任意層（値等価・非等価・null 安全）は対象外。
// 普遍層＝不変・自己検証・非identity deep-equal のみを検証する。
// ・item1: equals/mutate 未指定で assertValueObject を呼べること（現状ヘルパは equals/mutate を常時使うため赤）。
// ・item2: 非identity deep-equal 法則を普遍層が持つこと。ScoreRecord は equals を持たないため、
//   「別インスタンスが値で等しい」は構造 deep-equal（toEqual）でしか表せない＝この describe が
//   普遍層へ非identity deep-equal 法則を要求する（equals で誤魔化せない）。
describe('VO契約(普遍層): ScoreRecord', () =>
  assertValueObject({
    make: (a) => makeScoreRecord(a),
    sample: () => ({ keys: 90, mistakes: 10, elapsedMs: 60000 }),
    invalid: [
      { keys: -1, mistakes: 0, elapsedMs: 0 }, // keys は非負整数（makeScore 由来）
      { keys: 0, mistakes: 0, elapsedMs: -1 }, // elapsedMs は非負の有限数（makeScore 由来）
    ],
  }))
