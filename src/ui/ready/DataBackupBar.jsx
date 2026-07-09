// #267 [#264 Phase4] データのエクスポート／インポート（復元）導線（Ready ページのバックアップバー）。
// エクスポート：SQLite の DB を .sqlite3 ファイルとしてダウンロード。
// インポート：選んだ .sqlite3 で DB を丸ごと置き換え、成功したらリロードして読み直す。
// バイト列の入出力・検証は application/backup 経由（ui → application → infrastructure）。
// DOM 操作（Blob ダウンロード・ファイル選択・リロード）だけ UI で行う。
// sqlite 経路（主タブ）以外では canExport/canImport が false ＝バー自体を出さない（既定 local は非表示）。
import { useEffect, useRef, useState } from 'react'
import {
  canExportDatabase,
  canImportDatabase,
  humanizeImportError,
  importDatabaseBytes,
  prepareDatabaseExport,
} from '../../application/backup.js'
import {
  canUseExternalBackup,
  connectExternalBackup,
  getExternalBackupStatus,
  restoreFromExternal,
  pickAndGetDirectory,
} from '../../application/externalBackup.js'

export default function DataBackupBar() {
  const [msg, setMsg] = useState('')
  const [isError, setIsError] = useState(false) // メッセージが失敗告知か（色分け用）
  const [busy, setBusy] = useState(false)
  const [extName, setExtName] = useState(null) // 外部自動バックアップ先フォルダ名（未設定は null）
  const fileRef = useRef(null)
  // 成功/中立は muted、失敗は赤で伝える（--red）。生の英語エラーは humanizeImportError で日本語化。
  const say = (text, error = false) => {
    setMsg(text)
    setIsError(error)
  }

  // sqlite 主タブでのみ機能する。それ以外（local/副タブ/未対応環境）は導線を出さない。
  const canExport = canExportDatabase()
  const canImport = canImportDatabase()
  // #278 Phase5b: 外部自動バックアップは FSA 対応の sqlite 主タブでのみ。local・非対応は導線を出さない。
  const canExternal = canUseExternalBackup()

  // 設定済みなら外部バックアップ先フォルダ名を状態表示する（async 取得＝effect 内で同期 setState しない）。
  useEffect(() => {
    if (!canExternal) return
    let alive = true
    getExternalBackupStatus().then((s) => {
      if (alive && s.configured) setExtName(s.name)
    })
    return () => {
      alive = false
    }
  }, [canExternal])

  if (!canExport && !canImport && !canExternal) return null

  const onExport = async () => {
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
  }

  // 外部フォルダを opt-in で設定（showDirectoryPicker はこのユーザージェスチャ内で呼ぶ）→ 初回バックアップ。
  const onConnectExternal = async () => {
    setBusy(true)
    say('バックアップ先を設定中…')
    const res = await connectExternalBackup()
    setBusy(false)
    if (res.connected) {
      setExtName(res.name)
      say(`自動バックアップを有効にしました：${res.name}`)
    } else {
      say('バックアップ先を設定できませんでした。', true)
    }
  }

  // フォルダから復元。保存済みハンドルがあればそれで、無ければ（サイトデータ消去後）選び直してから復元する。
  const onRestoreExternal = async () => {
    setBusy(true)
    say('復元中…')
    let res = await restoreFromExternal()
    // ハンドルが失われている（消去後）＝フォルダを選び直してから再度復元（再許可を挟む半自動）。
    if (!res.restored && res.needsPick) {
      say('復元元のフォルダを選んでください…')
      const dir = await pickAndGetDirectory()
      if (dir) res = await restoreFromExternal(dir)
    }
    if (res.restored) {
      say('復元しました。再読み込みします…')
      setTimeout(() => window.location.reload(), 800)
    } else {
      setBusy(false)
      say('フォルダから復元できませんでした。', true)
    }
  }

  const onImportFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 同じファイルを続けて選べるようにクリア
    if (!file) return
    setBusy(true)
    say('復元中…')
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      await importDatabaseBytes(bytes)
      say('復元しました。再読み込みします…')
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      setBusy(false)
      say(`復元できません：${humanizeImportError(err)}`, true)
    }
  }

  return (
    <section className="data-backup" aria-label="学習データのバックアップ">
      <span className="data-backup-title">学習データのバックアップ</span>
      <button
        type="button"
        className="data-backup-btn"
        onClick={onExport}
        disabled={!canExport || busy}
        title="学習データ（記録・統計）を1つの .sqlite3 ファイルに書き出します"
      >
        💾 エクスポート
      </button>
      <button
        type="button"
        className="data-backup-btn"
        onClick={() => fileRef.current?.click()}
        disabled={!canImport || busy}
        title="バックアップした .sqlite3 を読み込んでデータを復元します（現在のデータは置き換わります）"
      >
        ↩️ 復元
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".sqlite3,application/x-sqlite3"
        onChange={onImportFile}
        style={{ display: 'none' }}
      />
      {canExternal && (
        <>
          <button
            type="button"
            className="data-backup-btn"
            onClick={onConnectExternal}
            disabled={busy}
            title="学習データを自動で書き出すフォルダを設定します（以後、起動時に自動でバックアップします）"
          >
            📁 {extName ? '自動バックアップ先を変更' : '自動バックアップ先を設定'}
          </button>
          <button
            type="button"
            className="data-backup-btn"
            onClick={onRestoreExternal}
            disabled={busy}
            title="自動バックアップ先のフォルダから復元します（現在のデータは置き換わります）"
          >
            📂 フォルダから復元
          </button>
          {extName && (
            <span className="data-backup-status">自動バックアップ: 有効（{extName}）</span>
          )}
        </>
      )}
      {msg && (
        <span className={`data-backup-msg${isError ? ' data-backup-msg--error' : ''}`}>{msg}</span>
      )}
    </section>
  )
}
