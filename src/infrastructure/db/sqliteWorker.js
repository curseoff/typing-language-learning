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
//   失敗時は out { id, type:'error', message }
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { migrations } from './migrations.js'
import { runMigrations } from './runMigrations.js'
import { loadRecordsDb, saveRecordDb } from './repos/recordsDb.js'
import { loadWordRecordsDb, saveWordRecordDb } from './repos/wordsDb.js'
import { loadDictRecordsDb, saveDictRecordDb } from './repos/dictDb.js'
import { loadItemStatsDb, recordItemStatDb } from './repos/itemStatsDb.js'
import {
  loadAllStoryRecordsDb,
  saveStoryRecordDb,
  loadFoundDb,
  saveFoundDb,
} from './repos/storyDb.js'

const DB_FILE = 'user.sqlite3'
const VFS_NAME = 'opfs-sahpool-tll-user'

let db = null
let sqlite3 = null

// SAHPool VFS を導入し DB を open、マイグレーションを適用して最終版数を返す。
async function open() {
  sqlite3 = await sqlite3InitModule()
  const poolUtil = await sqlite3.installOpfsSAHPoolVfs({ name: VFS_NAME })
  db = new poolUtil.OpfsSAHPoolDb(DB_FILE)
  // DB は selectValue/transaction/exec を持つので runMigrations にそのまま渡せる。
  return runMigrations(db, migrations)
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
function save(repo, args) {
  if (repo === 'records') saveRecordDb(db, ...args)
  else if (repo === 'word') saveWordRecordDb(db, ...args)
  else if (repo === 'dict') saveDictRecordDb(db, ...args)
  else if (repo === 'item') recordItemStatDb(db, ...args)
  else if (repo === 'story') saveStoryRecordDb(db, ...args)
  else if (repo === 'found') saveFoundDb(db, ...args)
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
