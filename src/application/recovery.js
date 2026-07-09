// #268 [#264 Phase5a] 起動時の整合性検査→内部OPFSバックアップからの自動復元、および健全スナップショット取得を
// application 層に集約するファサード。UI/main は infrastructure（Worker handle）を直接触らず、ここ経由で
// 「壊れていないか確かめ、壊れていたら直近の健全バックアップへ戻す」「健全なうちに1世代バックアップを取る」を行う
// （依存方向 ui/main → application → infrastructure）。判断は persist/recovery.js の純関数に委ね、ここは
// handle への薄い配線＋フェイルセーフ（何が起きてもアプリを止めず local 相当へ縮退）に徹する。
// backup.js（Phase4 の export/import 配線）と同じく Worker への配線＝計測対象（recovery.wiring.test.js で被覆）。
import { getStorageHandle } from '../infrastructure/db/initStorage.js'
import { evaluateIntegrity, selectRestoreCandidate, rotateBackups } from './persist/recovery.js'
import { setPersistNotice } from './persist/persistNotice.js'

// 内部バックアップの保持世代数（直近 N 世代を残し、古い世代は世代ローテで削除する）。
const MAX_BACKUP_GEN = 3

// 起動時に本番 DB の整合性を検査し、破損していたら直近の健全な内部バックアップへ自動復元する。
// 戻り値 { restored }：復元したら true（告知 'restored' も立てる）。健全 or 復元不能でもアプリは止めない。
// handle が無い（local/未初期化）なら何もしない＝既定 local の挙動不変。
export async function ensureHealthyOrRestore() {
  const handle = getStorageHandle()
  if (!handle) return { restored: false }
  // 整合性検査は「健全と確認できたときだけ」復元を見送る。quick_check が非ok文字列を返すより前に
  // SQLITE_CORRUPT（malformed database schema 等）を throw する重度/スキーマ破損こそ最も復元が要る場面
  // なので、検査が例外/reject でも握り潰さず「破損とみなして」復元を試みる（安全網を外さない）。
  let healthy = false
  try {
    healthy = evaluateIntegrity(await handle.integrityCheck())
  } catch (e) {
    console.warn('[persist] 整合性検査に失敗。破損とみなし自動復元を試みます。', e)
    healthy = false
  }
  if (healthy) return { restored: false } // 健全＝何もしない
  // 破損（非ok or 検査例外）：健全な内部バックアップの中から直近を選び、本番を置換する（新しい破損はスキップ）。
  // 復元自体が失敗して初めて {restored:false}＝「検査で例外が出たら何もしない」は廃止（各ステップはフェイルセーフ）。
  try {
    const backups = await handle.listBackups()
    const candidate = selectRestoreCandidate(backups)
    if (!candidate) return { restored: false, unrecoverable: true } // 健全な控えが無い＝復元断念（空DBで続行）
    await handle.restoreBackup(candidate.name)
    setPersistNotice('restored')
    return { restored: true }
  } catch (e) {
    console.warn('[persist] 自動復元に失敗。そのまま続行します。', e)
    return { restored: false }
  }
}

// 健全なうちに本番 DB の内部バックアップを1世代取り、溢れた古い世代を削除する（N 世代ローテ）。
// hydrate 後（＝健全確認済み）に呼ぶ。handle が無い（副タブ/local）なら何もしない。失敗しても止めない。
export async function snapshotInternalBackup(maxGen = MAX_BACKUP_GEN) {
  const handle = getStorageHandle()
  if (!handle) return
  try {
    await handle.backupNow()
    const backups = await handle.listBackups()
    const { remove } = rotateBackups(backups, maxGen)
    for (const b of remove) await handle.deleteBackup(b.name)
  } catch (e) {
    console.warn('[persist] 内部バックアップの取得に失敗。そのまま続行します。', e)
  }
}
