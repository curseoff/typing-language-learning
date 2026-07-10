import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'
import { resolvePersistBackend, diagnosePersistFallback } from './application/persist/backend.js'
import { initStorage } from './infrastructure/db/initStorage.adapter.js'
import { electionTransition } from './application/persist/election.js'
import { handleSecondaryMessage } from './application/persist/secondaryMessage.js'
import { createEventBus } from './application/events/eventBus.js'
import { startMultiTabPersistence } from './infrastructure/persist/multiTab.adapter.js'
import { ensurePersistentStorage } from './infrastructure/persist/persistentStorage.adapter.js'
import {
  initSqlitePersistence,
  initSecondaryPersistence,
  initMemoryPersistence,
  promoteToPrimary,
  replaceImage,
  getPersistImage,
} from './application/records.js'
import { ensureHealthyOrRestore, snapshotInternalBackup } from './application/recovery.js'
import { scheduleExternalBackup } from './application/externalBackup.js'
import { setPersistNotice } from './application/persist/persistNotice.js'
import { startContentFallbackPersistence } from './infrastructure/observability/contentFallbackStore.adapter.js'

// 永続化バックエンドを解決し、sqlite なら Web Locks で主タブ1つを選出して多タブ協調を起動する
// （#266 Phase3a：メモリ像＋write-through、#273 Phase3b：主タブ選出＋副タブ read-only＋
// BroadcastChannel 伝播＋handoff 昇格）。#274：sqlite 専用へ転換し既定は 'sqlite'、localStorage 経路は廃止。
// OPFS/Worker/Web Locks を満たさない環境は 'memory'＝非永続（メモリのみ／リロードで記録は消える）へ縮退する。
// フェイルセーフ：どこで失敗しても例外を投げず memory で render は必ず続行する（アプリを止めない）。
async function setupPersistence() {
  try {
    const params = new URLSearchParams(window.location.search)
    const desired = resolvePersistBackend({
      url: params.get('persist'),
      ls: localStorage.getItem('persist-backend'),
      env: import.meta.env.VITE_PERSIST_BACKEND,
    })
    const { backend, reason } = diagnosePersistFallback({
      desired,
      opfsOk: !!(navigator.storage && 'getDirectory' in navigator.storage),
      workerOk: typeof Worker !== 'undefined',
      locksSupported: 'locks' in navigator,
    })
    // memory へ縮退したら非永続モードを明示確立する。能力不足で非永続になった場合だけ控えめに告知し、
    // ?persist=memory 等の意図的 memory（reason='forced-memory'）では告知しない（#274）。
    if (backend !== 'sqlite') {
      initMemoryPersistence()
      if (reason !== 'forced-memory') setPersistNotice('fallback')
      return // memory はここで何もしない（OPFS/多タブ処理はしない）
    }

    // #267 Phase4: eviction 抑止のため永続ストレージを明示取得（可否はログのみ・失敗しても続行）。
    ensurePersistentStorage()

    // 主タブは initStorage→(整合性検査/自動復元)→hydrate→initSqlitePersistence、副タブは主から snapshot を受領。
    // 純ロジック（election/secondaryMessage）とファサード操作を配線へ注入し、infra 純度を保つ。
    // openStorage を包み、主として open した直後・hydrate の前に整合性検査→破損なら内部バックアップから
    // 自動復元する（#268 Phase5a）。復元は Worker 側で本番 DB を開き直すので後続 hydrate は復元後を読む。
    const { whenReady } = startMultiTabPersistence({
      electionTransition,
      handleSecondaryMessage,
      bus: createEventBus(), // イベントバス（application）は composition root で生成して注入
      openStorage: async () => {
        const handle = await initStorage() // 失敗時は null → 配線が閲覧のみで続行
        if (handle) await ensureHealthyOrRestore()
        return handle
      },
      facade: {
        initPrimary: initSqlitePersistence,
        promote: promoteToPrimary,
        initSecondary: initSecondaryPersistence,
        replaceImage,
        getImage: getPersistImage,
      },
    })
    await whenReady // 初期ロールのデータ（主=hydrate / 副=初回 snapshot or 再送打切り）が整うまで待つ

    // hydrate 済み＝健全確認済みの主タブで、健全なうちに内部バックアップを1世代取る（N 世代ローテ）。
    // 主タブ以外（副タブ）は handle を持たないため snapshotInternalBackup は no-op（挙動不変）。
    await snapshotInternalBackup()

    // #278 Phase5b: 外部フォルダを opt-in で設定済みなら、起動時に自動バックアップをデバウンス予約する
    // （無言 write は許可済みのときだけ実行し失敗は握る）。未設定・FSA 非対応・local では no-op（挙動不変）。
    scheduleExternalBackup()
  } catch (e) {
    console.warn('[persist] 永続化の初期化に失敗。memory（非永続）で続行します。', e)
  }
}

// content の SQLite→.js フォールバック発生を購読して localStorage/window へ永続化する
// observability を起動する（依存逆転：infra→content・アプリ生存期間なので解除は不要）。
startContentFallbackPersistence()

setupPersistence().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})

// Service Worker の登録と更新検知は UI 側の <UpdateToast /> が担う
// （本番ビルドのみ。dev では HMR 干渉を避けて無効）。更新を検知したらトーストで告知し、
// ユーザーが「更新」を押したタイミングで新 SW へ切り替える。詳細は
// src/infrastructure/pwa/registerSW.adapter.js / src/ui/pwa/UpdateToast.jsx を参照。
