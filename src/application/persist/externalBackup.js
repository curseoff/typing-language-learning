// #278 [#264 Phase5b] FSA 外部自動バックアップ＋サイトデータ消去からの復元の純ロジック。
// すべて DOM/infra/FSA 非依存・副作用なし・入力非破壊の純関数（externalBackup.test.js で被覆＝計測対象）。
// N世代ローテ/checksum/復元候補選定は 5a の recovery.js を再利用する（ここには書かない）。
// 配線（FSA ディレクトリハンドル・IndexedDB・自動バックアップ）は
// infrastructure/persist/externalBackupStore.js と application/externalBackup.js が担い、判断はここに閉じる。

// 外部バックアップのファイル名規約。
//   tll-backup-<createdAt(epoch ms)>-v<userVersion>-<checksum>.sqlite3
// createdAt は epoch ミリ秒（10桁以上の整数）、userVersion は v 接頭辞つき整数、
// checksum は小文字16進（recovery.computeChecksum の出力＝[0-9a-f]+）。
const BACKUP_NAME_RE = /^tll-backup-(\d+)-v(\d+)-([0-9a-f]+)\.sqlite3$/

// FSA 権限判定 decidePermissionAction は domain/persist/permission.js へ移設（#274 L-2・infra→application 逆流解消）。

// 外部バックアップ名を生成する（純関数・入力非破壊）。createdAt は date.getTime()（epoch ミリ秒）。
export function buildExternalBackupName(date, meta) {
  return `tll-backup-${date.getTime()}-v${meta.userVersion}-${meta.checksum}.sqlite3`
}

// 外部バックアップ名を解析する（純関数）。規約に合えば { createdAt, userVersion, checksum } を返す。
// createdAt/userVersion は number 化、checksum は文字列のまま。規約外（別名・欠落・拡張子違い等）は null。
export function parseExternalBackupName(filename) {
  const m = BACKUP_NAME_RE.exec(filename)
  if (!m) return null
  return {
    createdAt: Number(m[1]),
    userVersion: Number(m[2]),
    checksum: m[3],
  }
}

// ファイル名配列のうち規約に合うものだけを解析し、name を保持したエントリ配列にする（純関数・入力非破壊）。
// 生成物は createdAt を持ち rotateBackups / selectRestoreCandidate へそのまま渡せる形。
export function toBackupEntries(filenames) {
  const entries = []
  for (const name of filenames) {
    const parsed = parseExternalBackupName(name)
    if (parsed) entries.push({ name, ...parsed })
  }
  return entries
}
