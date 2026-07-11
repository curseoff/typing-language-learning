// 既存の Application Service（application の .service.js）を共通契約（assertApplicationService）に
// 載せるメタテスト。#331（#322 契約テストシリーズ）。
// Application Service は「ユースケースの薄い調停」＝業務ルール（判定・計算・整列・上限）を自分で持たず、
//   Domain Service（sessionToRecord）・Domain（recKey）・Repository（submitRecord）・
//   Domain Event（sessionFinishedEvent/recordAchievedEvent）へ決められた順序で委譲し、
//   その結果をそのまま返す。依存（repository/bus）は注入で受け取り、in-memory の stub で完結する。
// ファイル名は .test.js ＝命名メタテスト（.service.js サフィックス強制）の対象外。
//
// 本 Issue の scope：この契約に構造的に当てはまるのは recordFinishedSession のみ（薄い調停・独自計算しない・
//   依存注入）。他は範囲外：records.service.js＝module 状態ファサード、recovery/externalBackup/backup＝
//   async infra、eventBus/writeQueue＝pub-sub/queue 機構で、単体の「調停」契約には載らない。
import { describe } from 'vitest'
import { assertApplicationService } from '../test/contracts/applicationService.js'
import { recordFinishedSession } from './records/recordFinishedSession.service.js'
import { startTypingSession } from '../domain/session/typingSession.entity.js'
import { makeEndCondition } from '../domain/session/endCondition.vo.js'
import { sessionToRecord } from '../domain/records/sessionResult.service.js'
import { recKey } from '../domain/records/ranking.service.js'

// 描画スコープで固定する session/meta（makeDeps は毎回新規だが session/meta は不変で共有してよい）。
// 数打鍵した active な TypingSession を作る（sessionToRecord は progress() を読むだけ）。
function makeSession() {
  const s = startTypingSession({ id: 's-1', endCondition: makeEndCondition('time', 60) })
  s.registerHit()
  s.registerHit()
  s.registerHit()
  s.registerMiss()
  s.setElapsed(30000)
  return s
}
const session = makeSession()
const meta = { mode: 'both', rank: '1', source: 'sentence' }

// 識別可能な番兵 board（usecase が加工せず素通しすることを === で検証するための一意オブジェクト）。
function makeDepsWith(sentinel) {
  return {
    board: sentinel,
    bus: {
      published: [],
      publish(e) {
        this.published.push(e)
      },
    },
    repository: {
      submitted: [],
      submitRecord(key, ec, record) {
        this.submitted.push({ key, ec, record })
        return sentinel
      },
    },
  }
}

describe('ApplicationService契約: recordFinishedSession', () =>
  assertApplicationService({
    makeDeps: () => makeDepsWith({ SENTINEL_BOARD: 'A' }),
    makeDepsB: () => makeDepsWith({ SENTINEL_BOARD: 'B' }),
    invoke: (deps) =>
      recordFinishedSession({ session, meta, repository: deps.repository, bus: deps.bus }),
    // 委譲先を独立に再計算（usecase 内部を写経しない）。
    oracles: () => ({
      record: sessionToRecord(session, meta),
      key: recKey(meta.mode, meta.rank, meta.source, meta.theme, session.endCondition),
    }),
    expectedEventTypes: ['SessionFinished', 'RecordAchieved'],
  }))
