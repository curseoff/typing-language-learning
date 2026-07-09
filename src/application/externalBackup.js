// #278 [#264 Phase5b] 外部（ユーザーのディスク上フォルダ）への自動バックアップ＋そこからの復元を
// application 層に集約するファサード。UI(.jsx)/main は infrastructure（FSA/IndexedDB）を直接触らず、
// ここ経由で「バックアップ先を設定」「自動バックアップ」「フォルダから復元」を行う
// （依存方向 ui/main → application → infrastructure）。判断は persist/externalBackup.js と persist/recovery.js
// の純関数に委ね、ここは handle/FSA への薄い配線＋フェイルセーフ（何が起きてもアプリを止めない）に徹する。
//
// 設計上の現実：サイトデータ消去は IndexedDB も消す＝保存したディレクトリハンドルも失われる。よって
// 「消去後の復元」は「起動→ユーザーが同じフォルダを選び直す→復元」の再許可を挟む半自動になる
// （restoreFromExternal は保存済みハンドルが無ければ選び直しへ誘導し、UI がフォルダ選択を経てから復元する）。
// backup.js（Phase4 export/import 配線）／recovery.js（Phase5a 内部復元配線）と同じく Worker/FSA への配線。
import { getStorageHandle } from '../infrastructure/db/initStorage.js'
import { computeChecksum, selectRestoreCandidate, rotateBackups } from './persist/recovery.js'
import { looksLikeSqlite } from './backup.js'
import { flushWrites } from './records.js'
import {
  buildExternalBackupName,
  toBackupEntries,
} from './persist/externalBackup.js'
import {
  supportsFsa,
  pickBackupDirectory,
  getSavedDirectory,
  ensureWritePermission,
  canWriteSilently,
  writeBackupFile,
  listBackupFiles,
  readBackupFile,
  deleteBackupFile,
} from '../infrastructure/persist/externalBackupStore.js'

// 外部バックアップの保持世代数（直近 N 世代を残し、古い世代は世代ローテで削除する）。
// 内部（Phase5a）は 3 世代だが、外部は容量に余裕があるので少し多めの 5 世代とする。
const MAX_EXTERNAL_GEN = 5

// 自動バックアップのデバウンス間隔（連続保存で write が過剰にならないよう束ねる）。
const AUTO_BACKUP_DEBOUNCE_MS = 5000

let autoBackupTimer = null

// 外部自動バックアップが使えるか（sqlite 主タブ＝書き出し可能、かつ FSA 対応）。
// local・副タブ・FSA 非対応環境では false ＝ UI は導線を出さない（既定 local は挙動不変）。
export function canUseExternalBackup() {
  return !!getStorageHandle() && supportsFsa()
}

// 現在の最新 DB バイト列と、そこから作る外部バックアップ名を用意する（内部ヘルパ）。
// 保留中の write-through を flush してから serialize＝最新状態を保証する。書き出し不能なら null。
async function prepareExternalBackup(handle, date = new Date()) {
  await flushWrites()
  const bytes = await handle.serialize()
  const name = buildExternalBackupName(date, {
    userVersion: handle.userVersion,
    checksum: computeChecksum(bytes),
  })
  return { bytes, name }
}

// フォルダへ現在の DB を1件書き出し、世代ローテで溢れた古い外部バックアップを削除する（内部ヘルパ）。
async function writeAndRotate(dir, handle) {
  const { bytes, name } = await prepareExternalBackup(handle)
  await writeBackupFile(dir, name, bytes)
  const files = await listBackupFiles(dir)
  const { remove } = rotateBackups(toBackupEntries(files), MAX_EXTERNAL_GEN)
  for (const b of remove) {
    try {
      await deleteBackupFile(dir, b.name)
    } catch (e) {
      // 1件の削除失敗で全体を止めない（次回ローテで再度掃除される）。
      console.warn('[external-backup] 古い外部バックアップの削除に失敗。', e)
    }
  }
}

// UI のボタン（ユーザージェスチャ内）から呼ぶ：フォルダを選ばせて保存し、初回バックアップを取る。
// 戻り値 { connected, name }：接続できたフォルダ名（無ければ connected:false）。失敗しても throw しない。
export async function connectExternalBackup() {
  const handle = getStorageHandle()
  if (!handle || !supportsFsa()) return { connected: false }
  try {
    const dir = await pickBackupDirectory()
    if (!dir) return { connected: false } // キャンセル or 非対応
    // 選んだ直後はユーザージェスチャ文脈なので、必要なら許可要求できる。
    const writable = await ensureWritePermission(dir)
    if (!writable) return { connected: false }
    await writeAndRotate(dir, handle)
    return { connected: true, name: dir.name }
  } catch (e) {
    console.warn('[external-backup] バックアップ先の設定に失敗。', e)
    return { connected: false }
  }
}

// 既に設定済みか（保存済みディレクトリがあり、書き出し可能か）。UI の状態表示に使う。
// 戻り値 { configured, name }。非対応・未設定・失敗では configured:false。
export async function getExternalBackupStatus() {
  if (!canUseExternalBackup()) return { configured: false }
  try {
    const dir = await getSavedDirectory()
    if (!dir) return { configured: false }
    return { configured: true, name: dir.name }
  } catch {
    return { configured: false }
  }
}

// 保存済みフォルダへ自動バックアップする（無言 write）。許可済み（プロンプト不要）のときだけ実行し、
// 失敗は握る。ユーザージェスチャの無い定期/起動時実行を想定＝canWriteSilently で分岐（要求はしない）。
// 戻り値 { backedUp }：書き出せたら true。local/未設定/権限未確定/失敗では false（アプリは止めない）。
export async function runExternalBackup() {
  const handle = getStorageHandle()
  if (!handle || !supportsFsa()) return { backedUp: false }
  try {
    const dir = await getSavedDirectory()
    if (!dir) return { backedUp: false } // 未設定 or 消去後（＝半自動：UI で選び直しへ）
    if (!(await canWriteSilently(dir))) return { backedUp: false } // 無言で書けないなら見送る
    await writeAndRotate(dir, handle)
    return { backedUp: true }
  } catch (e) {
    console.warn('[external-backup] 自動バックアップに失敗。そのまま続行します。', e)
    return { backedUp: false }
  }
}

// 自動バックアップをデバウンスして予約する（連続保存で write が過剰にならないよう束ねる）。
// main の起動時や、将来の write-through 後段から呼べる。無言 write なので許可済みのときだけ実際に走る。
export function scheduleExternalBackup(delay = AUTO_BACKUP_DEBOUNCE_MS) {
  if (!canUseExternalBackup()) return
  if (autoBackupTimer) clearTimeout(autoBackupTimer)
  autoBackupTimer = setTimeout(() => {
    autoBackupTimer = null
    void runExternalBackup()
  }, delay)
}

// フォルダから復元する。保存済みハンドルがあればそれを、無ければ（＝サイトデータ消去後）UI が選び直した
// ハンドルを使う想定で、providedDir を優先する（UI は選び直しを経てから渡す）。
// 各候補を read→looksLikeSqlite で healthy 判定→selectRestoreCandidate で直近の健全を選び、
// importDbBytes（Worker 側で本アプリDB検証のうえ一時スロット経由で本番置換）で復元する。
// 破損候補は importDbBytes が弾く（既存データは壊れない）ので、失敗したら次に新しい健全候補へフォールバック。
// 戻り値 { restored, name }：復元できたバックアップ名。復元不能なら restored:false。UI は成功後にリロードする。
export async function restoreFromExternal(providedDir = null) {
  const handle = getStorageHandle()
  if (!handle || !supportsFsa()) return { restored: false }
  try {
    const dir = providedDir || (await getSavedDirectory())
    if (!dir) return { restored: false, needsPick: true } // ハンドルが無い＝フォルダ選び直しが要る（半自動）
    if (!(await ensureWritePermission(dir))) return { restored: false }
    const files = await listBackupFiles(dir)
    const entries = toBackupEntries(files)
    // 各候補を読み、SQLite ヘッダを持つものだけ healthy とみなす（本アプリDB の厳密検証は importDbBytes に委ねる）。
    const judged = []
    for (const e of entries) {
      try {
        const bytes = await readBackupFile(dir, e.name)
        judged.push({ ...e, bytes, healthy: looksLikeSqlite(bytes) })
      } catch {
        // 読めない候補は健全でない扱いで飛ばす。
        judged.push({ ...e, healthy: false })
      }
    }
    // 直近の健全候補から順に import を試し、最初に成功したものを採用（破損は Worker が弾く＝次候補へ）。
    const pool = judged.filter((c) => c.healthy)
    let candidate = selectRestoreCandidate(pool)
    while (candidate) {
      try {
        await handle.importDbBytes(candidate.bytes)
        return { restored: true, name: candidate.name }
      } catch (e) {
        console.warn('[external-backup] 候補の復元に失敗。次の候補を試します。', e)
        // 失敗した候補を除いて次に新しい健全候補を選ぶ。
        const rest = pool.filter((c) => c.name !== candidate.name)
        pool.length = 0
        pool.push(...rest)
        candidate = selectRestoreCandidate(pool)
      }
    }
    return { restored: false }
  } catch (e) {
    console.warn('[external-backup] フォルダからの復元に失敗。', e)
    return { restored: false }
  }
}

// 復元時にユーザーへフォルダを選び直させる（サイトデータ消去後の半自動導線）。UI のボタンから呼ぶ。
// 選んだハンドルを保存しつつ返す（次回以降は自動バックアップ対象になる）。キャンセル・非対応では null。
export async function pickAndGetDirectory() {
  return pickBackupDirectory()
}
