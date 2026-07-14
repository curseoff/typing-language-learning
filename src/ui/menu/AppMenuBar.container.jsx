// #286 メニューバー Phase1(PC): TOP の h1 を置き換えるメニューバーの container（配線＋DOM 副作用）。
// 能力（caps）を集めて application/appMenu の buildTopMenuVisibility で各項目の可否/理由コードを求め、
// 日本語ラベルと理由文言を添えて presenter（@tll/ui の MenuBarView）へ渡す。項目選択の実処理
// （Blob ダウンロード・ファイル選択・リロード・PWA プロンプト・About 遷移）と結果トーストはここで持つ。
// 旧 DataBackupBar のバックアップ導線をメニューへ移設したもの（ロジックは application 層を流用）。
// 注: getStorageHandle/supportsFsa/promptInstall は storage/PWA の薄い配線（ブラウザ API）で、
// UpdateToast 等と同様に ui から infrastructure を直接参照する（判定・記録ロジックではない）。
import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { MenuBarView } from '@tll/ui'
import { buildTopMenuVisibility } from '../../application/appMenu.policy.js'
import {
  humanizeImportError,
  importDatabaseBytes,
  isStorageReady,
  prepareDatabaseExport,
  subscribeStorageReady,
} from '../../application/backup.service.js'
import {
  connectExternalBackup,
  pickAndGetDirectory,
  restoreFromExternal,
} from '../../application/externalBackup.service.js'
import { getStorageHandle } from '../../infrastructure/db/initStorage.adapter.js'
import { supportsFsa } from '../../infrastructure/persist/externalBackupStore.adapter.js'
import { useInstallPrompt } from '../pwa/useInstallPrompt.js'
import { promptInstall } from '../../infrastructure/pwa/installPrompt.adapter.js'
import {
  getSaveStatus,
  subscribeSaveStatus,
} from '../../application/persist/saveStatus.store.js'
import { deriveSaveStatusBadge } from '../../application/persist/saveStatusBadge.policy.js'

// reason コード → 表示用の日本語文言（appMenu.js が返す安定コードを UI 側で写像する）。
const REASON_TEXT = {
  'need-sqlite-primary': 'SQLite 保存が有効なタブでのみ使えます',
  'need-fsa': '対応ブラウザ（Chrome 等）でのみ使えます',
  'not-installable': 'この環境では追加できません',
}
const reasonText = (code) => (code ? (REASON_TEXT[code] ?? null) : null)

// 保存状態バッジの reasonCode → 詳細文言（title/aria-label 用）。安定コードを UI 側で日本語へ写像する（#399）。
const SAVE_REASON_TEXT = {
  secondary: '他のタブで記録中のため、このタブでは保存されません',
  'no-opfs': 'この環境では保存できません（OPFS 非対応）',
  'no-worker': 'この環境では保存できません（Worker 非対応）',
  'no-locks': 'この環境では保存できません（Web Locks 非対応）',
  'forced-memory': '非保存モードで起動しています',
  'not-saved': 'このタブでは保存されません',
}

export default function AppMenuBar({ appName, onNavigateAbout, onNavigateAllRecords }) {
  const [openId, setOpenId] = useState(null)
  const [toast, setToast] = useState(null) // { msg, isError } | null
  const fileRef = useRef(null)

  // 保存基盤の起動完了を購読して再評価する（sqlite handle 準備前に初描画されても、準備後に caps を更新）。
  // local/副タブは false のまま＝従来どおり（可否は下の getStorageHandle が handle で判断）。
  useSyncExternalStore(subscribeStorageReady, isStorageReady, () => false)

  // 保存状態を購読し、警告時だけメニュー帯の右端にバッジを出す（保存中/確認中は非表示＝常時ノイズを避ける）。
  const saveStatus = useSyncExternalStore(subscribeSaveStatus, getSaveStatus)
  const saveBadge = deriveSaveStatusBadge(saveStatus)

  const installable = useInstallPrompt()
  const caps = {
    hasHandle: !!getStorageHandle(),
    supportsFsa: supportsFsa(),
    installable,
  }
  const vis = buildTopMenuVisibility(caps)

  // 成功/中立は muted、失敗は赤（--red）。生の英語エラーは humanizeImportError で日本語化。
  const say = useCallback((msg, isError = false) => setToast({ msg, isError }), [])
  const onClose = useCallback(() => setOpenId(null), [])
  const onToggle = useCallback((id) => setOpenId((prev) => (prev === id ? null : id)), [])

  const runExport = useCallback(async () => {
    const ex = await prepareDatabaseExport()
    if (!ex) {
      say('この環境ではエクスポートできません。', true)
      return
    }
    const url = URL.createObjectURL(new Blob([ex.bytes], { type: 'application/x-sqlite3' }))
    const a = document.createElement('a')
    a.href = url
    a.download = ex.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    say(`書き出しました：${ex.filename}`)
  }, [say])

  // 外部フォルダを opt-in で設定（showDirectoryPicker はこのユーザージェスチャ内で呼ぶ）→ 初回バックアップ。
  const runConnectExternal = useCallback(async () => {
    say('バックアップ先を設定中…')
    const res = await connectExternalBackup()
    if (res.connected) say(`自動バックアップを有効にしました：${res.name}`)
    else say('バックアップ先を設定できませんでした。', true)
  }, [say])

  // フォルダから復元。保存済みハンドルがあればそれで、無ければ（サイトデータ消去後）選び直してから復元する。
  const runRestoreExternal = useCallback(async () => {
    say('復元中…')
    let res = await restoreFromExternal()
    if (!res.restored && res.needsPick) {
      say('復元元のフォルダを選んでください…')
      const dir = await pickAndGetDirectory()
      if (dir) res = await restoreFromExternal(dir)
    }
    if (res.restored) {
      say('復元しました。再読み込みします…')
      setTimeout(() => window.location.reload(), 800)
    } else {
      say('フォルダから復元できませんでした。', true)
    }
  }, [say])

  const onImportFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0]
      e.target.value = '' // 同じファイルを続けて選べるようにクリア
      if (!file) return
      say('復元中…')
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        await importDatabaseBytes(bytes)
        say('復元しました。再読み込みします…')
        setTimeout(() => window.location.reload(), 800)
      } catch (err) {
        say(`復元できません：${humanizeImportError(err)}`, true)
      }
    },
    [say],
  )

  // 項目選択：メニューを閉じてから実処理へ。DOM 副作用（DL/ファイル選択/リロード）はここに集約する。
  const onSelect = useCallback(
    (itemId) => {
      onClose()
      switch (itemId) {
        case 'about':
          onNavigateAbout?.()
          break
        case 'allRecords':
          onNavigateAllRecords?.()
          break
        case 'install':
          promptInstall()
          break
        case 'export':
          runExport()
          break
        case 'import':
          fileRef.current?.click()
          break
        case 'connectExternal':
          runConnectExternal()
          break
        case 'restoreExternal':
          runRestoreExternal()
          break
        default:
          break
      }
    },
    [onClose, onNavigateAbout, onNavigateAllRecords, runExport, runConnectExternal, runRestoreExternal],
  )

  const menus = [
    {
      id: 'app',
      label: appName,
      items: [
        { id: 'about', label: 'このアプリについて', enabled: vis.help.about.enabled, reason: reasonText(vis.help.about.reason) },
        { id: 'install', label: 'アプリとして追加', icon: '＋', enabled: vis.help.install.enabled, reason: reasonText(vis.help.install.reason) },
      ],
    },
    {
      id: 'data',
      label: 'データ',
      items: [
        // 「すべての記録」は能力に依存せず常時表示（バックアップ群とは区切り線で分ける）。
        { id: 'allRecords', label: 'すべての記録', enabled: true, reason: null },
        { id: 'sep-1', separator: true },
        { id: 'export', label: 'エクスポート', icon: '💾', enabled: vis.data.export.enabled, reason: reasonText(vis.data.export.reason) },
        { id: 'import', label: '復元', icon: '↩️', enabled: vis.data.import.enabled, reason: reasonText(vis.data.import.reason) },
        { id: 'connectExternal', label: '自動バックアップ先を設定', icon: '📁', enabled: vis.data.connectExternal.enabled, reason: reasonText(vis.data.connectExternal.reason) },
        { id: 'restoreExternal', label: 'フォルダから復元', icon: '📂', enabled: vis.data.restoreExternal.enabled, reason: reasonText(vis.data.restoreExternal.reason) },
      ],
    },
  ]

  // warn のときだけバッジを描画（保存できていない＝secondary/memory）。詳細は title/aria-label に載せる。
  const saveDetail =
    (saveBadge.reasonCode && SAVE_REASON_TEXT[saveBadge.reasonCode]) ||
    'このタブでは保存されません'
  const badge =
    saveBadge.level === 'warn' ? (
      <span
        className="menu-bar__save-badge"
        role="status"
        title={saveDetail}
        aria-label={saveDetail}
      >
        <span className="menu-bar__save-badge-dot" aria-hidden="true" />
        保存されません
      </span>
    ) : null

  return (
    <>
      <MenuBarView
        appName={appName}
        menus={menus}
        openId={openId}
        onToggle={onToggle}
        onSelect={onSelect}
        onClose={onClose}
        rightSlot={badge}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".sqlite3,application/x-sqlite3"
        onChange={onImportFile}
        style={{ display: 'none' }}
      />
      {toast && (
        <div className={`menu-toast${toast.isError ? ' menu-toast--error' : ''}`} role="status" aria-live="polite">
          <span className="menu-toast__msg">{toast.msg}</span>
          <button className="menu-toast__close" type="button" onClick={() => setToast(null)} aria-label="閉じる">
            ×
          </button>
        </div>
      )}
    </>
  )
}
