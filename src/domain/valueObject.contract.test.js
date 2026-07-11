// 既存 Value Object（.vo.js）を共通契約（assertValueObject）に載せるメタテスト。#323。
// 値等価（*Equals）を持つ VO を、不変・値等価・非等価・null 安全・自己検証の共通4法則で検証する。
// ファイル名は .test.js ＝命名メタテスト（.vo.js サフィックス強制）の対象外。
//
// 【本 Issue で対象外の .vo.js（理由を明記・無理に契約へ載せない）】
//   - ScoreRecord（records/scoreRecord.vo.js）… VO（集約 RankingBoard の内部エントリ値）だが、ドメインの
//     操作は順序づけ（compareRecords）であって値等価ではない＝ *Equals を持たないのは妥当（scoreRecordEquals
//     は YAGNI）。不変・自己検証は満たすので、将来 VO 契約を「普遍層(不変+自己検証+非identity等価) ＋
//     任意層(値等価)」の2層に分ければ普遍層で被覆できる。本 Issue の“値等価”契約には載せない。
//   - RankingBoard（records/rankingBoard.aggregate.js）… Aggregate（集約ルート）で同一性は key の Entity。
//     rankingBoardEquals は key 基準の identity 等価（entries が違っても等しい）＝値等価法則
//     （値が違えば等しくない）に載らない＝本契約の対象外。
//   - kanaTable（packages/core/src/romaji/kanaTable.vo.js）… KANA_TABLE は凍結済みの定数テーブルで
//     make*/*Equals 形のファクトリ VO ではない（KANA_TABLE 定数＋kanaOf/cellOf 関数）＝値等価契約の形に
//     載らない。凍結の検証は別途（不変データの deep-freeze チェック）で担保するのが妥当＝本契約の対象外。
import { describe } from 'vitest'
import { assertValueObject } from '../test/contracts/valueObject.js'
import { makeEndCondition, endConditionEquals } from './session/endCondition.vo.js'
import { makeScore, scoreEquals } from './records/score.vo.js'
import { makeProgress, progressEquals } from './session/progress.vo.js'

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
