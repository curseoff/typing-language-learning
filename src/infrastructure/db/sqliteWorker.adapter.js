// Web Worker：SQLite-WASM + OPFS SAHPool VFS を Worker 内で動かす（単一ライター）。
// createSyncAccessHandle は Worker でのみ公開されるため、DB 実体（user.sqlite3）はここに置く
// （メインスレッド直呼びは「Missing required OPFS APIs」で失敗する）。COOP/COEP は不要。
// メインは postMessage 経由でのみアクセスし、この 1 Worker が全書き込みを直列化する＝単一ライター。
// 教材読み取り専用の contentDb.js とは別系統（あちらは read-only、こちらは書き込み用）。
//
// メッセージ規約：
//   in  { id, type:'open' }                → open+migrate → out { id, type:'opened', userVersion }
//   in  { id, type:'exec', sql, bind }     → 実行し行を返す → out { id, type:'result', rows }
//   in  { id, type:'serialize' }           → DB 全体を吐き出す → out { id, type:'serialized', buffer }（転送）
//   in  { id, type:'close' }               → db.close() → out { id, type:'closed' }
//   in  { id, type:'hydrate' }             → 全リポを読む → out { id, type:'hydrated', image }（#266 起動時展開）
//   in  { id, type:'save', repo, args }    → repo 別に1件保存 → out { id, type:'saved', repo }（#266 write-through）
//   in  { id, type:'import', buffer }      → 検証後に本番 DB を置換 → out { id, type:'imported' }（#267 Phase4 復元）
//   in  { id, type:'integrityCheck' }      → 本番 DB を quick_check → out { id, type:'integrity', result }（#268 Phase5a）
//   in  { id, type:'backupNow' }           → 本番を内部OPFSバックアップへ複製 → out { id, type:'backedUp', backup }（#268）
//   in  { id, type:'listBackups' }         → 内部バックアップ一覧 → out { id, type:'backups', backups }（#268）
//   in  { id, type:'restoreBackup', name } → 指定内部バックアップで本番を置換 → out { id, type:'restored' }（#268）
//   in  { id, type:'deleteBackup', name }  → 指定内部バックアップを削除 → out { id, type:'deleted' }（#268 世代ローテ）
//   失敗時は out { id, type:'error', message }
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { migrations } from './migrations.migration.js'
import { runMigrations } from './runMigrations.adapter.js'
import { loadRecordsDb, saveRecordDb, replaceRecordsGroupDb } from './repos/records.repository.js'
import {
  loadWordRecordsDb,
  saveWordRecordDb,
  replaceWordRecordsGroupDb,
} from './repos/words.repository.js'
import {
  loadDictRecordsDb,
  saveDictRecordDb,
  replaceDictRecordsGroupDb,
} from './repos/dict.repository.js'
import { loadItemStatsDb, recordItemStatDb } from './repos/itemStats.repository.js'
import {
  loadAllStoryRecordsDb,
  saveStoryRecordDb,
  replaceStoryRecordsGroupDb,
  loadFoundDb,
  saveFoundDb,
} from './repos/story.repository.js'

// 先頭スラッシュ必須：SAHPool の importDb は名前を verbatim 格納するが、OpfsSAHPoolDb の
// open は VFS が '/name' へ正規化する。スラッシュ無しだと importDb と open で別ファイル扱いになり
// 取り込んだ DB を空として掴む（#267 復元不能バグ）。open/importDb/unlink を '/' 付きで統一する。
const DB_FILE = '/user.sqlite3'
const TMP_FILE = '/import-check.sqlite3' // 復元検証用の一時ファイル（本番とは別スロット）
const VFS_NAME = 'opfs-sahpool-tll-user'

// #268 Phase5a: 内部OPFSバックアップ。命名規約 '/backup-<createdAt>-v<userVersion>-<checksum>.sqlite3'
// にメタ（作成時刻・版数・チェックサム）を埋め、listBackups は名前をパースして返す（別テーブル不要）。
// 先頭スラッシュは #267 の教訓に従い open/importDb/unlink/exportFile で統一（スラッシュ無しは別ファイル扱い）。
const BACKUP_PREFIX = '/backup-'
const BACKUP_SUFFIX = '.sqlite3'
const BACKUP_NAME_RE = /^\/backup-(\d+)-v(\d+)-([0-9a-f]+)\.sqlite3$/
// SAHPool は固定スロット数。本番 + import-check + 数世代のバックアップ + 健全判定の一時 open 分を確保。
const MIN_CAPACITY = 12

// 本アプリのユーザーDBが備えるべきテーブル（applySchema/migrations で作られる7つ）。
// application/backup.js の EXPECTED_TABLES と対応（Worker は application を import できないため再掲）。
const EXPECTED_TABLES = [
  'records',
  'word_records',
  'dict_records',
  'item_stats',
  'story_endings',
  'story_records',
  'meta',
]

let db = null
let sqlite3 = null
let poolUtil = null // SAHPool ユーティリティ（importDb/unlink で復元に使う）

// SAHPool VFS を導入し DB を open、マイグレーションを適用して最終版数を返す。
async function open() {
  sqlite3 = await sqlite3InitModule()
  poolUtil = await sqlite3.installOpfsSAHPoolVfs({ name: VFS_NAME })
  // 内部バックアップ用のスロットを確保（本番+検証+数世代分）。既に足りていれば no-op。
  try {
    if (poolUtil.getCapacity() < MIN_CAPACITY) await poolUtil.reserveMinimumCapacity(MIN_CAPACITY)
  } catch {
    // 容量確保に失敗してもバックアップ以外は動く（フェイルセーフ）。
  }
  db = new poolUtil.OpfsSAHPoolDb(DB_FILE)
  // DB は selectValue/transaction/exec を持つので runMigrations にそのまま渡せる。
  return runMigrations(db, migrations)
}

// #268 Phase5a: バイト列→決定的な16進チェックサム（FNV-1a 32bit・8桁小文字16進）。
// application/persist/recovery.js の computeChecksum と同一アルゴリズム（Worker は application を
// import できないため EXPECTED_TABLES/isValidUserDb と同様に再掲）。命名規約のメタに埋める。
function checksumOf(bytes) {
  let hash = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i]
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// PRAGMA quick_check の結果が健全（'ok'）か。application/persist/recovery.js の evaluateIntegrity
// と同義（単一 'ok'）。Worker 内の健全判定用に再掲（本番・各バックアップの integrity 判定で使う）。
function isIntegrityOk(result) {
  return typeof result === 'string' && result.trim() === 'ok'
}

// 本番 DB の整合性検査。quick_check は integrity_check の軽量版（インデックス照合を省く）で起動時向き。
// quick_check が非ok文字列を返す前に SQLITE_CORRUPT（malformed database schema 等）を throw する重度/
// スキーマ破損では、例外を握って「破損＝非ok文字列」に正規化して返す（evaluateIntegrity(false) 経路で
// 自動復元を発火させるため。ここで throw を素通しすると application 側が破損を検知できず安全網が外れる）。
function quickCheck(d) {
  try {
    return d.selectValue('PRAGMA quick_check')
  } catch (e) {
    return String((e && e.message) || e) || 'malformed'
  }
}

// 本番 DB を内部OPFSバックアップへ複製する。serialize→命名規約でメタを埋めて importDb で別スロットへ。
// 返すメタ（name/createdAt/userVersion/checksum）は application 側の世代ローテ判断に使う。
function backupNow() {
  const bytes = sqlite3.capi.sqlite3_js_db_export(db.pointer)
  const userVersion = db.selectValue('PRAGMA user_version') ?? 0
  const checksum = checksumOf(bytes)
  const createdAt = Date.now()
  const name = `${BACKUP_PREFIX}${createdAt}-v${userVersion}-${checksum}${BACKUP_SUFFIX}`
  poolUtil.importDb(name, bytes)
  return { name, createdAt, userVersion, checksum }
}

// 内部バックアップ一覧。命名規約からメタ（createdAt/userVersion/checksum）をパースし、各DBを開いて
// quick_check で healthy を判定する（破損したバックアップは selectRestoreCandidate でスキップされる）。
function listBackups() {
  const names = poolUtil.getFileNames().filter((n) => BACKUP_NAME_RE.test(n))
  return names.map((name) => {
    const [, createdAt, userVersion, checksum] = BACKUP_NAME_RE.exec(name)
    let healthy = false
    try {
      const bk = new poolUtil.OpfsSAHPoolDb(name)
      try {
        healthy = isIntegrityOk(quickCheck(bk))
      } finally {
        bk.close()
      }
    } catch {
      healthy = false // 開けない/検査で例外＝破損扱い
    }
    return { name, createdAt: Number(createdAt), userVersion: Number(userVersion), checksum, healthy }
  })
}

// 指定した内部バックアップのバイト列で本番 DB を置き換える（自動復元）。Phase4 の import と同じく
// 一時スロット経由で本アプリDBの構成を検証してから本番へ反映する（不正なら既存を壊さず throw）。
// import は db を閉じるので、起動時の自動復元でリロード無しに続行できるよう開き直して版数を返す。
function restoreBackup(name) {
  const bytes = poolUtil.exportFile(name)
  importDbBytes(bytes) // 検証→本番置換（db を閉じる）
  db = new poolUtil.OpfsSAHPoolDb(DB_FILE)
  return runMigrations(db, migrations)
}

// 取り込んだ DB が本アプリのユーザーDBとして妥当か（user_version>=2 かつ 期待テーブル全在）。
function isValidUserDb(d) {
  const ver = d.selectValue('PRAGMA user_version') ?? 0
  if (ver < 2) return false
  const names = d
    .selectObjects("SELECT name FROM sqlite_master WHERE type='table'")
    .map((r) => r.name)
  return EXPECTED_TABLES.every((t) => names.includes(t))
}

// .sqlite3 のバイト列で本番 DB を丸ごと置き換える（復元）。
// まず一時スロットへ取り込み（importDb が SQLite ヘッダ/ページを検証）、本アプリDBの
// テーブル構成まで確認してから本番を上書きする＝不正ファイルで既存データを壊さない。
// 置換後は db を閉じたまま（以降の save は詰まる）＝メイン側のリロードで開き直して読む。
function importDbBytes(bytes) {
  poolUtil.importDb(TMP_FILE, bytes) // ヘッダ/ページ検証つき。一時スロットにのみ書く
  let ok = false
  const tmp = new poolUtil.OpfsSAHPoolDb(TMP_FILE)
  try {
    ok = isValidUserDb(tmp)
  } finally {
    tmp.close()
  }
  if (!ok) {
    poolUtil.unlink(TMP_FILE)
    throw new Error('このアプリのバックアップではありません（DBの構成が一致しません）')
  }
  if (db) {
    db.close()
    db = null
  }
  poolUtil.importDb(DB_FILE, bytes) // 検証済みなので本番へ反映
  poolUtil.unlink(TMP_FILE)
}

// 汎用 exec：SELECT なら行（オブジェクト配列）を返す。書き込み系は空配列。
// Phase3 の hydration（全読み込み）/ write-through（差分書き込み）で使う口。
function exec(sql, bind) {
  const rows = []
  db.exec({ sql, bind: bind || [], rowMode: 'object', resultRows: rows })
  return rows
}

// 起動時のメモリ像を1回で組み立てる（全リポを読む）。素マップだけを返す（構造化複製可能）。
// storyFound は story_endings の全 story_id を拾い、発見順を保つ loadFoundDb で個別復元する。
function hydrate() {
  const storyFound = {}
  const foundRows = db.selectObjects('SELECT DISTINCT "story_id" FROM "story_endings"')
  for (const { story_id } of foundRows) storyFound[story_id] = loadFoundDb(db, story_id)
  return {
    records: loadRecordsDb(db),
    wordRecords: loadWordRecordsDb(db),
    dictRecords: loadDictRecordsDb(db),
    itemStats: loadItemStatsDb(db),
    storyFound,
    storyRecords: loadAllStoryRecordsDb(db),
  }
}

// repo 別に1件保存（write-through）。戻り値はメイン側で使わない（メモリ像が正）。
// *Group は #451 の1件削除：メイン側が更新済みメモリ像の残り配列を送り、DB のグループを置き換える。
function save(repo, args) {
  if (repo === 'records') saveRecordDb(db, ...args)
  else if (repo === 'word') saveWordRecordDb(db, ...args)
  else if (repo === 'dict') saveDictRecordDb(db, ...args)
  else if (repo === 'item') recordItemStatDb(db, ...args)
  else if (repo === 'story') saveStoryRecordDb(db, ...args)
  else if (repo === 'found') saveFoundDb(db, ...args)
  else if (repo === 'recordsGroup') replaceRecordsGroupDb(db, ...args)
  else if (repo === 'wordGroup') replaceWordRecordsGroupDb(db, ...args)
  else if (repo === 'dictGroup') replaceDictRecordsGroupDb(db, ...args)
  else if (repo === 'storyGroup') replaceStoryRecordsGroupDb(db, ...args)
  else throw new Error(`unknown repo: ${repo}`)
}

self.onmessage = async (e) => {
  const { id, type } = e.data
  try {
    if (type === 'open') {
      const userVersion = await open()
      self.postMessage({ id, type: 'opened', userVersion })
    } else if (type === 'exec') {
      const rows = exec(e.data.sql, e.data.bind)
      self.postMessage({ id, type: 'result', rows })
    } else if (type === 'hydrate') {
      self.postMessage({ id, type: 'hydrated', image: hydrate() })
    } else if (type === 'save') {
      save(e.data.repo, e.data.args)
      self.postMessage({ id, type: 'saved', repo: e.data.repo })
    } else if (type === 'serialize') {
      const bytes = sqlite3.capi.sqlite3_js_db_export(db.pointer)
      self.postMessage({ id, type: 'serialized', buffer: bytes.buffer }, [bytes.buffer])
    } else if (type === 'import') {
      importDbBytes(new Uint8Array(e.data.buffer))
      self.postMessage({ id, type: 'imported' })
    } else if (type === 'integrityCheck') {
      self.postMessage({ id, type: 'integrity', result: quickCheck(db) })
    } else if (type === 'backupNow') {
      self.postMessage({ id, type: 'backedUp', backup: backupNow() })
    } else if (type === 'listBackups') {
      self.postMessage({ id, type: 'backups', backups: listBackups() })
    } else if (type === 'restoreBackup') {
      const userVersion = restoreBackup(e.data.name)
      self.postMessage({ id, type: 'restored', userVersion })
    } else if (type === 'deleteBackup') {
      poolUtil.unlink(e.data.name)
      self.postMessage({ id, type: 'deleted' })
    } else if (type === 'close') {
      if (db) {
        db.close()
        db = null
      }
      self.postMessage({ id, type: 'closed' })
    }
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String((err && err.message) || err) })
  }
}
