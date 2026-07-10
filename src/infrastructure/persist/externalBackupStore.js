// #278 [#264 Phase5b] File System Access（FSA）で「ユーザーのディスク上フォルダ」へ外部バックアップする
// ためのブラウザ API 配線（infrastructure）。application/externalBackup.js だけがここを import する
// （依存方向 application → infrastructure）。FSA・IndexedDB は jsdom/node で単体計測できない＝
// db/initStorage.js と同種のブラウザ API エントリ配線として計測除外（判断は persist/externalBackup.js の純関数）。
//
// 選んだディレクトリハンドル（FileSystemDirectoryHandle）は構造化複製可なので IndexedDB に永続化する。
// ただしサイトデータ消去は IndexedDB も消す＝消去後はハンドルが失われ、ユーザーが同じフォルダを選び直す
// 「再許可を挟む半自動」になる（完全自動にはならない）。この前提で呼び出し側（application）が UX を組む。
//
// フェイルセーフ：FSA 非対応（showDirectoryPicker 無し）・権限拒否・IO 失敗ではいずれも例外を投げず／
// 呼び出し側でフェイルセーフできる形（null・false・throw を握る）にして、アプリを止めない。
import { decidePermissionAction } from '../../domain/persist/permission.service.js'

// ディレクトリハンドルを保存する IndexedDB（DB 名／ストア名／固定キー）。
const IDB_NAME = 'tll-external-backup'
const IDB_STORE = 'handles'
const DIR_KEY = 'external-backup-dir'

// FSA が使える環境か（ディレクトリピッカーがあるか）。
export function supportsFsa() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

// 素の IndexedDB を Promise でラップして開く（idb ライブラリは入れない）。
function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// IndexedDB の1件 get/put を Promise 化する薄いヘルパ。
function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}
function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ユーザーにバックアップ先フォルダを選ばせ、ハンドルを IndexedDB に保存して返す（要ユーザージェスチャ）。
// FSA 非対応・キャンセル・保存失敗では null（呼び出し側はアプリを止めない）。
export async function pickBackupDirectory() {
  if (!supportsFsa()) return null
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
    try {
      const db = await openIdb()
      await idbPut(db, DIR_KEY, handle)
      db.close()
    } catch (e) {
      // ハンドルの永続化に失敗しても、今回のセッション分のハンドルは使えるので返す。
      console.warn('[external-backup] ディレクトリハンドルの保存に失敗（今回分のみ有効）。', e)
    }
    return handle
  } catch {
    // ユーザーキャンセル（AbortError）等はフェイルセーフに null。
    return null
  }
}

// 保存済みのディレクトリハンドルを IndexedDB から取り出す。無ければ／消去後／失敗なら null。
export async function getSavedDirectory() {
  if (!supportsFsa()) return null
  try {
    const db = await openIdb()
    const handle = await idbGet(db, DIR_KEY)
    db.close()
    return handle ?? null
  } catch (e) {
    console.warn('[external-backup] 保存済みディレクトリの取得に失敗。', e)
    return null
  }
}

// ハンドルへ readwrite で書ける状態か確かめ、必要なら許可を要求する（要ユーザージェスチャ）。
// query の結果を decidePermissionAction で 'write'|'request'|'skip' に落とし、'request' のときだけ
// requestPermission する。戻り値は「最終的に書けるか」（boolean）。失敗・拒否・非対応では false。
export async function ensureWritePermission(handle) {
  if (!handle) return false
  try {
    const action = decidePermissionAction(await handle.queryPermission({ mode: 'readwrite' }))
    if (action === 'write') return true
    if (action === 'skip') return false
    // 'request'：ユーザージェスチャ内で呼ばれた前提で許可を求める。
    const granted = await handle.requestPermission({ mode: 'readwrite' })
    return granted === 'granted'
  } catch (e) {
    console.warn('[external-backup] 書き込み許可の確認に失敗。', e)
    return false
  }
}

// 現在ハンドルが「無言で（プロンプト無しで）書けるか」だけを判定する（要求はしない）。
// 自動バックアップ（ユーザージェスチャの無い定期実行）が無言 write してよいかの分岐に使う。
export async function canWriteSilently(handle) {
  if (!handle) return false
  try {
    return decidePermissionAction(await handle.queryPermission({ mode: 'readwrite' })) === 'write'
  } catch {
    return false
  }
}

// ハンドル配下に name のファイルを作り／上書きして bytes を書き込む。失敗は呼び出し側へ throw。
export async function writeBackupFile(handle, name, bytes) {
  const fileHandle = await handle.getFileHandle(name, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(bytes)
  await writable.close()
}

// ハンドル配下のファイル名一覧を返す（ディレクトリは除外）。失敗は throw（呼び出し側で握る）。
export async function listBackupFiles(handle) {
  const names = []
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind === 'file') names.push(name)
  }
  return names
}

// ハンドル配下の name ファイルを読み Uint8Array で返す。失敗は throw。
export async function readBackupFile(handle, name) {
  const fileHandle = await handle.getFileHandle(name)
  const file = await fileHandle.getFile()
  return new Uint8Array(await file.arrayBuffer())
}

// ハンドル配下の name ファイルを削除する（世代ローテで溢れた古い外部バックアップの掃除）。失敗は throw。
export async function deleteBackupFile(handle, name) {
  await handle.removeEntry(name)
}
