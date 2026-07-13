// application の Policy（.policy.js の純関数）を共通契約（assertPolicy / assertPolicyEnvIndependent）
// に載せるメタテスト。#332（#322 契約テストシリーズ）。
// Policy は「純ロジック・副作用なし・決定的・環境非依存（DOM/クロック/乱数/ストレージ非参照）」。
// 各 fn の具体計算は当該 *.test.js が担い、ここでは正解値を再エンコードしない（同義反復回避）。
// 本ファイルは純粋（jsdom/sqlite 不要＝既定の node 環境）。fixture はテスト内インラインの最小データで
// 教材 *Data.js には依存しない。ファイル名は .contract.test.js ＝命名メタテスト（.policy.js 強制）の対象外。
//
// 12 .policy.js のうち、以下2種は「意図的に純粋でない」ため契約から丸ごと除外する（env grep も回さない）：
//   - seed.policy.js（makeSeed）… 冒頭コメントで宣言のとおり Math.random を意図的に使う非決定関数。
//   - segTracker.policy.js の segMark/segMiss/segPush … 引数(tr)を破壊する accumulator（非破壊契約に反する）。
//     ただし segMissedItems のみ純読み取りなので載せる（env grep も clean なので回す）。
import { describe } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assertPolicy, assertPolicyEnvIndependent } from '../test/contracts/policy.js'

import { flattenRecords, sortAllRecords } from './allRecords.policy.js'
import { buildTopMenuVisibility } from './appMenu.policy.js'
import { buildQuizSegStat } from './quizSegStat.policy.js'
import {
  resolvePersistBackend,
  chooseBackend,
  diagnosePersistFallback,
} from './persist/backend.policy.js'
import { electionTransition } from './persist/election.policy.js'
import { isStale, handleSecondaryMessage } from './persist/secondaryMessage.policy.js'
import {
  buildExternalBackupName,
  parseExternalBackupName,
  toBackupEntries,
} from './persist/externalBackup.policy.js'
import {
  buildImage,
  applySaveRecord,
  applySaveWordRecord,
  applySaveDictRecord,
  applySaveStoryRecord,
  applyRecordItemStat,
  applySaveFound,
} from './persist/memoryStore.policy.js'
import {
  evaluateIntegrity,
  computeChecksum,
  rotateBackups,
  selectRestoreCandidate,
} from './persist/recovery.policy.js'
import { segMissedItems } from './segTracker.policy.js'
import { trackKey, trackMiss, flushTracker } from './itemTracker.policy.js'

// このテストからの相対パスでソース文字列を読む（先例 src/domain/_ddd-naming.test.js）。
const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

// ───────────────────────────────────────────────────────────
// 共有 fixture（毎回新規に返す＝参照非共有。memoryStore は有効な endCondition を必須とする）。
// ───────────────────────────────────────────────────────────

// 記録レコードの最小 fixture。keys/mistakes/date は time60 ランキング整列に使われる。
// applySave* は内部で RankingBoard.submit を通すため endCondition が妥当（{kind:'time',value:60}）でなければならない。
const rec = (extra = {}) => ({
  keys: 100,
  mistakes: 1,
  date: '2026-01-01',
  endCondition: { kind: 'time', value: 60 },
  ...extra,
})

// flatten 出力形に相当する行（sortAllRecords はこの形の配列を並べ替える）。
const row = (over = {}) => ({
  kind: 'wsent',
  kindLabel: '文章',
  level: 1,
  levelLabel: '初級',
  mode: 'both',
  modeLabel: '英日',
  theme: '日常',
  speed: 300,
  accuracy: 95,
  mistakes: 2,
  keys: 120,
  seconds: 60,
  date: '2026/1/1 0:00:00',
  dateTs: 1735657200000,
  raw: {},
  ...over,
})

// ───────────────────────────────────────────────────────────
// allRecords.policy.js
// ───────────────────────────────────────────────────────────
describe('Policy契約: allRecords.policy.js', () => {
  assertPolicyEnvIndependent({ source: read('./allRecords.policy.js') })

  describe('Policy契約: allRecords.flattenRecords', () =>
    assertPolicy({
      fn: flattenRecords,
      sampleInput: () => [
        {
          records: { 'both__r1': [{ source: 'sentence', rank: 1, theme: '日常', mode: 'both', date: '2026/1/1 0:00:00' }] },
          dictRecords: { 'L1__日常__typing': [{ level: 1, theme: '日常', mode: 'typing', date: '2026/1/1 0:00:00' }] },
          wordRecords: { 'L1__日常__both': [{ level: 1, theme: '日常', mode: 'both', date: '2026/1/1 0:00:00' }] },
        },
      ],
    }))

  describe('Policy契約: allRecords.sortAllRecords', () =>
    assertPolicy({
      fn: sortAllRecords,
      sampleInput: () => [[row({ speed: 100 }), row({ speed: 300 }), row({ speed: 200 })], 'speed', 'desc'],
    }))
})

// ───────────────────────────────────────────────────────────
// appMenu.policy.js
// ───────────────────────────────────────────────────────────
describe('Policy契約: appMenu.policy.js', () => {
  assertPolicyEnvIndependent({ source: read('./appMenu.policy.js') })

  describe('Policy契約: appMenu.buildTopMenuVisibility', () =>
    assertPolicy({
      fn: buildTopMenuVisibility,
      sampleInput: () => [{ hasHandle: true, supportsFsa: true, installable: false }],
    }))
})

// ───────────────────────────────────────────────────────────
// quizSegStat.policy.js
// ───────────────────────────────────────────────────────────
describe('Policy契約: quizSegStat.policy.js', () => {
  assertPolicyEnvIndependent({ source: read('./quizSegStat.policy.js') })

  describe('Policy契約: quizSegStat.buildQuizSegStat', () =>
    assertPolicy({
      fn: buildQuizSegStat,
      sampleInput: () => [
        {
          question: { prompt: 'apple', answerDisplay: 'りんご' },
          picked: { answer: true, display: 'りんご', en: 'apple', ja: 'りんご' },
          no: 1,
          mistakes: 0,
        },
      ],
    }))
})

// ───────────────────────────────────────────────────────────
// persist/backend.policy.js
// ───────────────────────────────────────────────────────────
describe('Policy契約: persist/backend.policy.js', () => {
  assertPolicyEnvIndependent({ source: read('./persist/backend.policy.js') })

  describe('Policy契約: backend.resolvePersistBackend', () =>
    assertPolicy({
      fn: resolvePersistBackend,
      sampleInput: () => [{ url: 'memory', ls: 'sqlite', env: null }],
    }))

  describe('Policy契約: backend.chooseBackend', () =>
    assertPolicy({
      fn: chooseBackend,
      sampleInput: () => [{ desired: 'sqlite', opfsOk: true, workerOk: true, locksSupported: true }],
    }))

  describe('Policy契約: backend.diagnosePersistFallback', () =>
    assertPolicy({
      fn: diagnosePersistFallback,
      sampleInput: () => [{ desired: 'sqlite', opfsOk: false, workerOk: true, locksSupported: true }],
    }))
})

// ───────────────────────────────────────────────────────────
// persist/election.policy.js（状態遷移＝入力 state を破壊せず新 state を返す）
// ───────────────────────────────────────────────────────────
describe('Policy契約: persist/election.policy.js', () => {
  assertPolicyEnvIndependent({ source: read('./persist/election.policy.js') })

  describe('Policy契約: election.electionTransition', () =>
    assertPolicy({
      fn: electionTransition,
      sampleInput: () => [{ role: 'unknown', epoch: 0 }, { type: 'lock-granted' }],
    }))
})

// ───────────────────────────────────────────────────────────
// persist/secondaryMessage.policy.js（入力 state を破壊せず新 state を返す）
// ───────────────────────────────────────────────────────────
describe('Policy契約: persist/secondaryMessage.policy.js', () => {
  assertPolicyEnvIndependent({ source: read('./persist/secondaryMessage.policy.js') })

  describe('Policy契約: secondaryMessage.isStale', () =>
    assertPolicy({
      fn: isStale,
      sampleInput: () => [1, 2],
    }))

  describe('Policy契約: secondaryMessage.handleSecondaryMessage', () =>
    assertPolicy({
      fn: handleSecondaryMessage,
      sampleInput: () => [{ epoch: 2 }, { type: 'change', epoch: 5 }],
    }))
})

// ───────────────────────────────────────────────────────────
// persist/externalBackup.policy.js
// ───────────────────────────────────────────────────────────
const BACKUP_NAME = 'tll-backup-1700000000000-v3-abcd1234.sqlite3'
describe('Policy契約: persist/externalBackup.policy.js', () => {
  assertPolicyEnvIndependent({ source: read('./persist/externalBackup.policy.js') })

  describe('Policy契約: externalBackup.buildExternalBackupName', () =>
    assertPolicy({
      // date は入力（Date.getTime は純パース）。JSON では ISO 文字列化されるが破壊はされない。
      fn: buildExternalBackupName,
      sampleInput: () => [new Date(1700000000000), { userVersion: 3, checksum: 'abcd1234' }],
    }))

  describe('Policy契約: externalBackup.parseExternalBackupName', () =>
    assertPolicy({
      fn: parseExternalBackupName,
      sampleInput: () => [BACKUP_NAME],
    }))

  describe('Policy契約: externalBackup.toBackupEntries', () =>
    assertPolicy({
      fn: toBackupEntries,
      sampleInput: () => [[BACKUP_NAME, 'junk.txt']],
    }))
})

// ───────────────────────────────────────────────────────────
// persist/memoryStore.policy.js（applySave* は RankingBoard.submit を通す＝record は有効 EC 必須）
// ───────────────────────────────────────────────────────────
describe('Policy契約: persist/memoryStore.policy.js', () => {
  assertPolicyEnvIndependent({ source: read('./persist/memoryStore.policy.js') })

  describe('Policy契約: memoryStore.buildImage', () =>
    assertPolicy({
      fn: buildImage,
      sampleInput: () => [{ records: {}, wordRecords: {}, dictRecords: {}, itemStats: {}, storyFound: {}, storyRecords: {} }],
    }))

  describe('Policy契約: memoryStore.applySaveRecord', () =>
    assertPolicy({
      fn: applySaveRecord,
      sampleInput: () => [{}, rec({ mode: 'both', rank: 1, source: 'sentence', theme: '日常' })],
    }))

  describe('Policy契約: memoryStore.applySaveWordRecord', () =>
    assertPolicy({
      fn: applySaveWordRecord,
      sampleInput: () => [{}, rec({ level: 1, theme: '日常', mode: 'both' })],
    }))

  describe('Policy契約: memoryStore.applySaveDictRecord', () =>
    assertPolicy({
      fn: applySaveDictRecord,
      sampleInput: () => [{}, rec({ level: 1, theme: '日常', mode: 'typing' })],
    }))

  describe('Policy契約: memoryStore.applySaveStoryRecord', () =>
    assertPolicy({
      fn: applySaveStoryRecord,
      sampleInput: () => [{}, 'demo', rec()],
    }))

  describe('Policy契約: memoryStore.applyRecordItemStat', () =>
    assertPolicy({
      fn: applyRecordItemStat,
      sampleInput: () => [{}, 'w:en:reserve', { keys: 10, mistakes: 1, ms: 5000 }],
    }))

  describe('Policy契約: memoryStore.applySaveFound', () =>
    assertPolicy({
      fn: applySaveFound,
      sampleInput: () => [{}, 'demo', ['end-a', 'end-b']],
    }))
})

// ───────────────────────────────────────────────────────────
// persist/recovery.policy.js
// ───────────────────────────────────────────────────────────
describe('Policy契約: persist/recovery.policy.js', () => {
  assertPolicyEnvIndependent({ source: read('./persist/recovery.policy.js') })

  describe('Policy契約: recovery.evaluateIntegrity', () =>
    assertPolicy({
      fn: evaluateIntegrity,
      sampleInput: () => [['ok']],
    }))

  describe('Policy契約: recovery.computeChecksum', () =>
    assertPolicy({
      fn: computeChecksum,
      sampleInput: () => [Uint8Array.of(1, 2, 3, 4)],
    }))

  describe('Policy契約: recovery.rotateBackups', () =>
    assertPolicy({
      fn: rotateBackups,
      sampleInput: () => [[{ createdAt: 3 }, { createdAt: 1 }, { createdAt: 2 }], 2],
    }))

  describe('Policy契約: recovery.selectRestoreCandidate', () =>
    assertPolicy({
      fn: selectRestoreCandidate,
      sampleInput: () => [
        [
          { createdAt: 1, healthy: true },
          { createdAt: 2, healthy: false },
          { createdAt: 3, healthy: true },
        ],
      ],
    }))
})

// ───────────────────────────────────────────────────────────
// segTracker.policy.js（純読み取りの segMissedItems のみ。破壊系 segMark/segMiss/segPush は除外）
// ───────────────────────────────────────────────────────────
describe('Policy契約: segTracker.policy.js', () => {
  assertPolicyEnvIndependent({ source: read('./segTracker.policy.js') })

  describe('Policy契約: segTracker.segMissedItems', () =>
    assertPolicy({
      fn: segMissedItems,
      sampleInput: () => [{ list: [{ mistakes: 1 }, { mistakes: 0 }], start: null, mistakes: 2 }],
    }))
})

// ───────────────────────────────────────────────────────────
// itemTracker.policy.js（#355 方針A で純化：now 注入・{next,emit} 返却・非破壊・IO/クロック非参照）
// sampleInput は plain literal の tracker を毎回新規に返す（参照非共有）。純化後は非破壊・決定的。
// ───────────────────────────────────────────────────────────
const trFix = () => ({ cur: 'a', keys: 2, mistakes: 1, start: 0, last: 500 })
describe('Policy契約: itemTracker.policy.js', () => {
  // 静的 env 非依存：performance/clock/乱数/ストレージ/IO のグローバルを一切参照しない。
  assertPolicyEnvIndependent({ source: read('./itemTracker.policy.js') })

  describe('Policy契約: itemTracker.trackKey', () =>
    assertPolicy({
      fn: trackKey,
      sampleInput: () => [trFix(), 'b', 700],
    }))

  describe('Policy契約: itemTracker.trackMiss', () =>
    assertPolicy({
      fn: trackMiss,
      sampleInput: () => [trFix()],
    }))

  describe('Policy契約: itemTracker.flushTracker', () =>
    assertPolicy({
      fn: flushTracker,
      sampleInput: () => [trFix()],
    }))
})

// ───────────────────────────────────────────────────────────
// ヘルパ自己テスト：assertPolicyEnvIndependent がコメント内トークンを拾わない（stripComments の境界）。
// ───────────────────────────────────────────────────────────
describe('Policy契約ヘルパ自己テスト: assertPolicyEnvIndependent はコメント内 localStorage を無視する', () => {
  assertPolicyEnvIndependent({
    source: '// localStorage はコメント\n/* window も document もコメント */\nexport const x = 1\n',
  })
})
