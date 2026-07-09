// #267 [#264 Phase4] データのエクスポート／インポート（復元）導線（Ready ページのバックアップバー）。
// エクスポート：SQLite の DB を .sqlite3 ファイルとしてダウンロード。
// インポート：選んだ .sqlite3 で DB を丸ごと置き換え、成功したらリロードして読み直す。
// バイト列の入出力・検証は application/backup 経由（ui → application → infrastructure）。
// DOM 操作（Blob ダウンロード・ファイル選択・リロード）だけ UI で行う。
// sqlite 経路（主タブ）以外では canExport/canImport が false ＝バー自体を出さない（既定 local は非表示）。
import { useRef, useState } from 'react'
import {
  canExportDatabase,
  canImportDatabase,
  humanizeImportError,
  importDatabaseBytes,
  prepareDatabaseExport,
} from '../../application/backup.js'

export default function DataBackupBar() {
  const [msg, setMsg] = useState('')
  const [isError, setIsError] = useState(false) // メッセージが失敗告知か（色分け用）
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  // 成功/中立は muted、失敗は赤で伝える（--red）。生の英語エラーは humanizeImportError で日本語化。
  const say = (text, error = false) => {
    setMsg(text)
    setIsError(error)
  }

  // sqlite 主タブでのみ機能する。それ以外（local/副タブ/未対応環境）は導線を出さない。
  const canExport = canExportDatabase()
  const canImport = canImportDatabase()
  if (!canExport && !canImport) return null

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
      {msg && (
        <span className={`data-backup-msg${isError ? ' data-backup-msg--error' : ''}`}>{msg}</span>
      )}
    </section>
  )
}
