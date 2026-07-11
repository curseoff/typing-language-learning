// 既存の Store（.store.js）を共通契約（assertStore）に載せるメタテスト。#333。
// Store は「module 可変ストア＋pub/sub」＝setPersistNotice で状態を更新→ subscribe した UI へ通知し、
// getSnapshot は参照安定な primitive を返す（useSyncExternalStore の無限ループ回避＝同一状態なら同値）。
// module スコープの可変状態を共有するため、beforeEach(reset) で各 it を分離する。
// ファイル名は .contract.test.js ＝命名メタテスト（.store.js サフィックス強制）の対象外。
import { beforeEach, describe } from 'vitest'
import { assertStore } from '../test/contracts/store.js'
import {
  setPersistNotice,
  getPersistNotice,
  subscribePersistNotice,
  resetPersistNotice,
} from './persist/persistNotice.store.js'

beforeEach(() => resetPersistNotice()) // module 可変ストアの分離（notice=null・listeners クリア）

describe('Store契約: persistNotice', () =>
  assertStore({
    subscribe: (l) => subscribePersistNotice(l),
    getSnapshot: () => getPersistNotice(),
    // 固定値。clean(null)→'fallback' で通知・再呼び出しは同値で無通知。
    mutate: () => setPersistNotice('fallback'),
  }))
