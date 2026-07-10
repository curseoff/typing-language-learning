// #267 [#264 Phase4] 耐久＝export/import(.sqlite3) を application 層に集約するファサード。
// UI(.jsx) は infrastructure を直接触らず、ここ経由で DB を書き出し／復元する
// （依存方向 ui → application → infrastructure）。DOM 操作（Blob ダウンロード・file 選択・
// リロード）は UI 層（AppMenuBar のデータメニュー）が行い、ここはバイト列の入出力と入口検証だけを担う。
//
// 純関数（looksLikeSqlite / buildBackupFilename / isValidUserDb）は計測対象（backup.test.js で被覆）。
// export/import 配線（can*/prepare/importDatabaseBytes）は Worker/handle への薄い配線。
import { getStorageHandle } from '../infrastructure/db/initStorage.adapter.js'
import { flushWrites } from './records.js'

// #269 Phase6: 保存基盤の起動完了を UI が購読するための再エクスポート（ui → application 経由で infra に触らせない）。
// AppMenuBar（データメニュー）が起動前に初描画されても、起動完了通知で導線可否（can*）を再評価し項目の一瞬のちらつきを防ぐ。
export { isStorageReady, subscribeStorageReady } from '../infrastructure/db/initStorage.adapter.js'

// SQLite ファイルの先頭16バイトのマジック "SQLite format 3\0"。
const SQLITE_MAGIC = [
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
]

// 本アプリのユーザーDBが備えるべきテーブル（Phase2 の applySchema で作られる7つ）。
const EXPECTED_TABLES = [
  'records',
  'word_records',
  'dict_records',
  'item_stats',
  'story_endings',
  'story_records',
  'meta',
]

// バイト列が SQLite データベースファイルらしいか（純粋関数・入口ガード）。
// null / 長さ<16 / 先頭16バイトがマジックと1バイトでも異なれば false。
export function looksLikeSqlite(bytes) {
  if (!bytes || bytes.length < SQLITE_MAGIC.length) return false
  return SQLITE_MAGIC.every((b, i) => bytes[i] === b)
}

// バックアップのファイル名を作る（純粋関数）。例: typing-language-learning-20260709-092210.sqlite3
// 月は getMonth()+1、月/日/時/分/秒は2桁ゼロ埋め。
export function buildBackupFilename(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  const stamp =
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  return `typing-language-learning-${stamp}.sqlite3`
}

// 取り込んだ DB が本アプリのユーザーDBとして妥当か（純粋関数）。
// user_version>=2 かつ 期待テーブルが sqlite_master に全て在れば true。
// db は sqlite-wasm の DB（selectValue/selectObjects を持つ）。
export function isValidUserDb(db) {
  const ver = db.selectValue('PRAGMA user_version') ?? 0
  if (ver < 2) return false
  const names = db
    .selectObjects("SELECT name FROM sqlite_master WHERE type='table'")
    .map((r) => r.name)
  return EXPECTED_TABLES.every((t) => names.includes(t))
}

// エクスポート可能か（SQLite/OPFS が主タブとして起動済みか）。
// handle は主タブでのみ非 null（local 経路・副タブ・未対応環境では null）。
export function canExportDatabase() {
  return !!getStorageHandle()
}

// インポート（復元）可能か。エクスポートと同条件（単一ライター＝主タブのみ）。
export function canImportDatabase() {
  return !!getStorageHandle()
}

// エクスポート用のバイト列とファイル名を用意する（非同期）。DOM 操作は UI 層に委ねる。
// 保留中の write-through を flush してから serialize＝最新状態を保証する。
// エクスポート不能（local/副タブ/失敗）なら null。
export async function prepareDatabaseExport(date = new Date()) {
  const handle = getStorageHandle()
  if (!handle) return null
  try {
    await flushWrites() // 未反映の差分を Worker へ流し切ってから吐き出す
    const bytes = await handle.serialize()
    return { bytes, filename: buildBackupFilename(date) }
  } catch {
    return null
  }
}

// 復元失敗時のエラーを利用者向けの日本語に丸める（純関数）。
// Worker/入口が投げる文言は既に日本語なのでそのまま通す。SQLite-WASM の生コード
// （SQLITE_NOTADB / file is not a database / malformed 等）だけ分かりやすい日本語へ変換する。
// UI（AppMenuBar のデータメニュー）が catch 節で表示前に通す（生の英語コードを画面に出さない）。
export function humanizeImportError(err) {
  const msg = String((err && err.message) || err || '')
  // 既に日本語（ひらがな/カタカナ/漢字）を含むメッセージは丸めず尊重する。
  if (/[ぁ-んァ-ヶー一-龠]/.test(msg)) return msg
  if (/NOTADB|not a database/i.test(msg)) {
    return 'SQLite のデータベースではありません。バックアップした .sqlite3 を選んでください'
  }
  if (/malformed|corrupt/i.test(msg)) {
    return 'ファイルが壊れているため復元できませんでした'
  }
  return 'データを復元できませんでした。別のバックアップでお試しください'
}

// アップロードされた .sqlite3 のバイト列で DB を丸ごと置き換える（復元）。
// まず入口でヘッダを弾き、Worker 側で本アプリDBの検証のうえ本番を置換する
// （不正ファイルは一時スロットで弾き、既存データを壊さない）。成功時は true。
// UI は成功後にリロードして読み直すこと。
export async function importDatabaseBytes(bytes) {
  if (!looksLikeSqlite(bytes)) {
    throw new Error('SQLite ファイルではありません（.sqlite3 を選んでください）')
  }
  const handle = getStorageHandle()
  if (!handle) throw new Error('保存基盤が未初期化です')
  await handle.importDbBytes(bytes)
  return true
}
