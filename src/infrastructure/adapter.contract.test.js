// infrastructure の Adapter（.adapter.js）を共通契約（assertAdapter）に載せるメタテスト。#334（#322 契約テストシリーズ）。
// Adapter は「内側 Port を外部技術で実装する ACL」。ここで検証するのは静的/結合の2契約のみ：
//   (A) Port 形状の適合、(D) 失敗の契約（browser 不在で throw せず既定値へ縮退）。
// 実挙動（OPFS/SW/2タブ/Worker protocol）は pwa-verifier の実ブラウザ検証が担う＝ここでは扱わない。
//
// 全件 node 既定環境で走らせる（`@vitest-environment jsdom` を付けない）。理由：bare node は
// window/navigator/AudioContext 等が不在＝「browser 不在＝失敗経路そのもの」なので、縮退（fail-safe）を
// 直接検証できる。jsdom を被せると window が生えて縮退経路を踏めなくなる。
//
// ファイル名は .contract.test.js ＝命名メタテスト（.adapter.js 強制）の対象外。
//
// 除外：db/sqliteWorker.adapter.js は import しない（top-level に self.onmessage を持ち export 0・
//   Worker protocol は node で import 不能＝pwa-verifier 領分）。
// ACL の「型を内へ漏らさない」静的 grep は省略：漏れは grep で確実に判定できず、initStorage は
//   意図的に生 Worker（handle.worker）を公開する設計のため（誤検知を避ける）。
import { describe, it, expect, afterEach } from 'vitest'
import { assertAdapter } from '../test/contracts/adapter.js'

import * as initStorage from './db/initStorage.adapter.js'
import * as runMigrations from './db/runMigrations.adapter.js'
import * as contentFallbackStore from './observability/contentFallbackStore.adapter.js'
import * as externalBackupStore from './persist/externalBackupStore.adapter.js'
import * as multiTab from './persist/multiTab.adapter.js'
import * as persistentStorage from './persist/persistentStorage.adapter.js'
import * as installPrompt from './pwa/installPrompt.adapter.js'
import * as onlineStatus from './pwa/onlineStatus.adapter.js'
import * as registerSW from './pwa/registerSW.adapter.js'
import * as sound from './sound.adapter.js'

// ───────────────────────────────────────────────────────────
// db/initStorage.adapter.js
//   ※ initStorage() は Worker 必須なので failsSafe に入れない（呼ばない）。読み取り系のみ縮退検証。
// ───────────────────────────────────────────────────────────
describe('Adapter契約: db/initStorage.adapter.js', () =>
  assertAdapter({
    module: initStorage,
    port: ['getStorageHandle', 'isStorageReady', 'subscribeStorageReady', 'initStorage'],
    failsSafe: [
      { name: 'getStorageHandle', call: (m) => m.getStorageHandle(), returns: null },
      { name: 'isStorageReady', call: (m) => m.isStorageReady(), returns: false },
      {
        name: 'subscribeStorageReady',
        call: (m) => m.subscribeStorageReady(() => {}),
        returns: expect.any(Function),
      },
    ],
  }))

// ───────────────────────────────────────────────────────────
// db/runMigrations.adapter.js（純ロジック配線・db 抽象を注入する＝縮退の失敗経路を持たない）
// ───────────────────────────────────────────────────────────
describe('Adapter契約: db/runMigrations.adapter.js', () =>
  assertAdapter({ module: runMigrations, port: ['runMigrations'], failsSafe: [] }))

// ───────────────────────────────────────────────────────────
// observability/contentFallbackStore.adapter.js（購読して unsubscribe を返す）
//   ※ 共有 listener を汚さないよう、生成した unsubscribe は afterEach で必ず解除する。
// ───────────────────────────────────────────────────────────
describe('Adapter契約: observability/contentFallbackStore.adapter.js', () => {
  const cleanups = []
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.()
  })
  assertAdapter({
    module: contentFallbackStore,
    port: ['startContentFallbackPersistence'],
    failsSafe: [
      {
        name: 'startContentFallbackPersistence',
        call: (m) => {
          const un = m.startContentFallbackPersistence()
          cleanups.push(un)
          return un
        },
        returns: expect.any(Function),
      },
    ],
  })
})

// ───────────────────────────────────────────────────────────
// persist/externalBackupStore.adapter.js
//   ※ write/list/read/delete は handle 前提で throw する設計＝failsSafe に入れない（縮退契約の対象外）。
// ───────────────────────────────────────────────────────────
describe('Adapter契約: persist/externalBackupStore.adapter.js', () =>
  assertAdapter({
    module: externalBackupStore,
    port: [
      'supportsFsa',
      'pickBackupDirectory',
      'getSavedDirectory',
      'ensureWritePermission',
      'canWriteSilently',
      'writeBackupFile',
      'listBackupFiles',
      'readBackupFile',
      'deleteBackupFile',
    ],
    failsSafe: [
      { name: 'supportsFsa', call: (m) => m.supportsFsa(), returns: false },
      { name: 'getSavedDirectory', call: (m) => m.getSavedDirectory(), resolves: null },
      { name: 'canWriteSilently', call: (m) => m.canWriteSilently(null), resolves: false },
      { name: 'ensureWritePermission', call: (m) => m.ensureWritePermission(null), resolves: false },
    ],
  }))

// ───────────────────────────────────────────────────────────
// persist/multiTab.adapter.js（startMultiTabPersistence は window/BroadcastChannel 依存で throw＝
//   縮退契約の対象外。Port 形状のみ検証。実挙動は pwa-verifier）
// ───────────────────────────────────────────────────────────
describe('Adapter契約: persist/multiTab.adapter.js', () =>
  assertAdapter({ module: multiTab, port: ['startMultiTabPersistence'], failsSafe: [] }))

// ───────────────────────────────────────────────────────────
// persist/persistentStorage.adapter.js
// ───────────────────────────────────────────────────────────
describe('Adapter契約: persist/persistentStorage.adapter.js', () =>
  assertAdapter({
    module: persistentStorage,
    port: ['ensurePersistentStorage'],
    failsSafe: [
      { name: 'ensurePersistentStorage', call: (m) => m.ensurePersistentStorage(), resolves: false },
    ],
  }))

// ───────────────────────────────────────────────────────────
// pwa/installPrompt.adapter.js
// ───────────────────────────────────────────────────────────
describe('Adapter契約: pwa/installPrompt.adapter.js', () =>
  assertAdapter({
    module: installPrompt,
    port: ['canInstall', 'subscribeInstall', 'promptInstall'],
    failsSafe: [
      { name: 'canInstall', call: (m) => m.canInstall(), returns: false },
      {
        name: 'subscribeInstall',
        call: (m) => m.subscribeInstall(() => {}),
        returns: expect.any(Function),
      },
      { name: 'promptInstall', call: (m) => m.promptInstall(), resolves: null },
    ],
  }))

// ───────────────────────────────────────────────────────────
// pwa/onlineStatus.adapter.js（isOnline は判定不能なら true＝安全側）
// ───────────────────────────────────────────────────────────
describe('Adapter契約: pwa/onlineStatus.adapter.js', () =>
  assertAdapter({
    module: onlineStatus,
    port: ['isOnline', 'subscribeOnline'],
    failsSafe: [
      { name: 'isOnline', call: (m) => m.isOnline(), returns: true },
      {
        name: 'subscribeOnline',
        call: (m) => m.subscribeOnline(() => {}),
        returns: expect.any(Function),
      },
    ],
  }))

// ───────────────────────────────────────────────────────────
// pwa/registerSW.adapter.js
//   ※ 非PROD/SW 不在では no-op＝undefined を返す。ヘルパの returns:undefined は「throw しない」だけに
//     縮退するため、ここでは strict に undefined を検証する専用 it を足す（Port 形状は assertAdapter）。
// ───────────────────────────────────────────────────────────
describe('Adapter契約: pwa/registerSW.adapter.js', () => {
  assertAdapter({ module: registerSW, port: ['registerServiceWorker'], failsSafe: [] })
  it('失敗の契約（非PROD/SW 不在）: registerServiceWorker は throw せず undefined を返す（no-op）', () => {
    let out
    expect(() => {
      out = registerSW.registerServiceWorker({ onUpdate() {} })
    }).not.toThrow()
    expect(out).toBeUndefined()
  })
})

// ───────────────────────────────────────────────────────────
// sound.adapter.js（_resetForTest はテスト専用＝Port から除外。playMiss は AudioContext 無しで no-op）
// ───────────────────────────────────────────────────────────
describe('Adapter契約: sound.adapter.js', () =>
  assertAdapter({
    module: sound,
    port: ['shouldPlayMiss', 'playMiss'],
    // playMiss は returns/resolves を持たない（no-op）＝「throw しない」ことだけを契約する。
    failsSafe: [{ name: 'playMiss', call: (m) => m.playMiss() }],
  }))

// ───────────────────────────────────────────────────────────
// ヘルパ自己テスト：assertAdapter が「準拠するダミー module」を通す（3分岐＝sync return/async resolve/
//   function 戻り＝subscribe をすべて緑にできることを示す）。policy.contract.test.js 末尾の流儀。
// ───────────────────────────────────────────────────────────
const fakeAdapter = {
  syncDefault: () => false,
  asyncDefault: async () => null,
  subscribeLike: () => () => {},
}
describe('Adapter契約ヘルパ自己テスト: 準拠するダミー module を通す', () =>
  assertAdapter({
    module: fakeAdapter,
    port: ['syncDefault', 'asyncDefault', 'subscribeLike'],
    failsSafe: [
      { name: 'syncDefault', call: (m) => m.syncDefault(), returns: false },
      { name: 'asyncDefault', call: (m) => m.asyncDefault(), resolves: null },
      { name: 'subscribeLike', call: (m) => m.subscribeLike(), returns: expect.any(Function) },
    ],
  }))
