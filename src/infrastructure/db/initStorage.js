// 保存基盤の初期化ラッパ（メイン側）。SQLite-WASM + OPFS SAHPool VFS を Web Worker 上で動かす。
// createSyncAccessHandle は Worker でのみ公開されるため DB 実体は Worker に置く（メイン直呼びは失敗）。
// メインは id 採番＋pending Map で postMessage の応答を突合し、単一ライター Worker に要求を送る。
//
// フェイルセーフ：open 失敗・timeout・Worker error では reject せず console.warn して null を返す
// （永続化に失敗してもアプリを止めない縮退＝呼び出し側は null を見て localStorage 等へフォールバック）。
//
// 注意（Phase1 #270）：このモジュールは main.jsx からもファサードからも呼ばない（挙動不変）。
// エクスポートを用意するだけ。実際の配線は Phase3（#266）で行う。
const OPEN_TIMEOUT_MS = 10000

let initPromise = null
let worker = null
let handle = null // 非 null＝open 済みハンドル
let reqId = 0
const pending = new Map() // id -> { resolve, reject }

// 起動済みの保存基盤ハンドルを返す。未初期化・失敗時は null。
export function getStorageHandle() {
  return handle
}

function onMessage(e) {
  const { id, type } = e.data
  if (id == null || !pending.has(id)) return
  const { resolve, reject } = pending.get(id)
  pending.delete(id)
  if (type === 'error') reject(new Error(e.data.message))
  else resolve(e.data)
}

function rejectAllPending(err) {
  for (const { reject } of pending.values()) reject(err)
  pending.clear()
}

// Worker へ要求を送り、対応する応答（同一 id）を待つ。
function call(type, payload, transfer) {
  const id = ++reqId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    worker.postMessage({ id, type, ...payload }, transfer || [])
  })
}

async function doInit() {
  worker = new Worker(new URL('./sqliteWorker.js', import.meta.url), { type: 'module' })
  worker.addEventListener('message', onMessage)
  worker.addEventListener('error', (ev) => {
    // Worker 読み込み/実行エラーは待機中の要求（主に open）を失敗させフォールバックへ。
    rejectAllPending(new Error(`worker error: ${ev.message || 'unknown'}`))
  })

  const opened = call('open', {})
  const timeout = new Promise((_, rej) =>
    setTimeout(() => rej(new Error('storage open timeout')), OPEN_TIMEOUT_MS),
  )
  const res = await Promise.race([opened, timeout])

  handle = {
    worker,
    userVersion: res.userVersion,
    // 汎用 exec：Worker で SQL を実行し行を返す（Phase3 の hydration/write-through で使う）。
    exec: (sql, bind) => call('exec', { sql, bind }).then((r) => r.rows),
    // 起動時に全リポを1回で読み、メモリ像（素マップ群）を受け取る（#266 Phase3a）。
    hydrate: () => call('hydrate', {}).then((r) => r.image),
    // repo 別に1件保存（write-through）。write-queue から fire-and-forget で呼ぶ。
    save: (repo, args) => call('save', { repo, args }),
    // DB 全体を Uint8Array で吐き出す（バックアップ用）。
    serialize: () => call('serialize', {}).then((r) => new Uint8Array(r.buffer)),
    // .sqlite3 のバイト列で本番 DB を置き換える（復元）。Worker 側で本アプリDBの検証のうえ
    // 一時スロット経由で置換する（不正ファイルは既存を壊さず弾く）。UI は成功後にリロードする。
    importDbBytes: (bytes) => {
      const copy = bytes.slice() // 正確な長さの独立バッファにして転送（呼び出し側の配列は温存）
      return call('import', { buffer: copy.buffer }, [copy.buffer])
    },
    // #268 Phase5a: 起動時の整合性検査（quick_check の生結果を返す。判定は application/persist/recovery）。
    integrityCheck: () => call('integrityCheck', {}).then((r) => r.result),
    // 本番 DB を内部OPFSバックアップへ複製し、メタ（name/createdAt/userVersion/checksum）を受け取る。
    backupNow: () => call('backupNow', {}).then((r) => r.backup),
    // 内部バックアップ一覧（{name,createdAt,userVersion,checksum,healthy}[]）。
    listBackups: () => call('listBackups', {}).then((r) => r.backups),
    // 指定した内部バックアップで本番を置換し、開き直した版数を受け取る（自動復元）。
    restoreBackup: (name) => call('restoreBackup', { name }).then((r) => r.userVersion),
    // 世代ローテで溢れた古い内部バックアップを削除する。
    deleteBackup: (name) => call('deleteBackup', { name }),
    close: () => call('close', {}),
  }
  return handle
}

// 保存基盤を初期化する（冪等：同一 Promise を返す）。
// 失敗しても reject せず、console.warn して null を返す（アプリを壊さない縮退）。
export function initStorage() {
  if (initPromise) return initPromise
  initPromise = doInit().catch((e) => {
    console.warn('[storage] SQLite/OPFS 初期化に失敗。永続化なしで続行します。', e)
    if (worker) {
      try {
        worker.terminate()
      } catch {
        // 破棄失敗は無視（フォールバックには影響しない）。
      }
      worker = null
    }
    handle = null
    return null
  })
  return initPromise
}
