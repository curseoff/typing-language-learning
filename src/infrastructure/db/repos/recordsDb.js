// マラソン記録の DB リポジトリ（現行 recordsRepository と同値な round-trip）。
// キー生成/並び/キャップはドメインを再利用（recKey/rankInsert）＝localStorage 版と同一ロジック。
import { recKey, rankInsert } from '../../../domain/records/ranking.service.js'
import { assign, ecToColumns, ecFromRow } from './_codec.js'

const COLS =
  '"mode","rank","source","theme","ec_kind","ec_value","pos",' +
  '"seed","speed","keys","mistakes","accuracy","correctCount","seconds","date"'

// 1行 → record（NULL 列はプロパティ省略）。
function rowToRecord(row) {
  const rec = {}
  assign(rec, 'mode', row.mode)
  assign(rec, 'rank', row.rank)
  assign(rec, 'source', row.source)
  assign(rec, 'theme', row.theme)
  assign(rec, 'seed', row.seed)
  assign(rec, 'speed', row.speed)
  assign(rec, 'keys', row.keys)
  assign(rec, 'mistakes', row.mistakes)
  assign(rec, 'accuracy', row.accuracy)
  assign(rec, 'correctCount', row.correctCount)
  assign(rec, 'seconds', row.seconds)
  assign(rec, 'date', row.date)
  const ec = ecFromRow(row)
  if (ec) rec.endCondition = ec
  return rec
}

// recKey→record[] のマップ（グループ内は pos 昇順＝ランキング順）。
export function loadRecordsDb(db) {
  const rows = db.selectObjects(`SELECT ${COLS} FROM "records" ORDER BY "pos","id"`)
  const out = {}
  for (const row of rows) {
    const rec = rowToRecord(row)
    const key = recKey(rec.mode, rec.rank, rec.source, rec.theme, rec.endCondition)
    ;(out[key] ||= []).push(rec)
  }
  return out
}

// 記録を1件保存し、更新後の全マップを返す（該当グループを DELETE→pos 昇順 INSERT）。
export function saveRecordDb(db, record) {
  db.transaction(() => {
    const key = recKey(record.mode, record.rank, record.source, record.theme, record.endCondition)
    const current = loadRecordsDb(db)[key] || []
    const list = rankInsert(current, record)
    const ec = ecToColumns(record.endCondition)
    db.exec({
      sql:
        'DELETE FROM "records" WHERE "mode" IS ? AND "rank" IS ? AND "source" IS ? AND ' +
        '"theme" IS ? AND "ec_kind" IS ? AND "ec_value" IS ?',
      bind: [
        record.mode ?? null,
        record.rank ?? null,
        record.source ?? null,
        record.theme ?? null,
        ec.ec_kind,
        ec.ec_value,
      ],
    })
    list.forEach((r, pos) => {
      const rec = ecToColumns(r.endCondition)
      db.exec({
        sql: `INSERT INTO "records" (${COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        bind: [
          r.mode ?? null,
          r.rank ?? null,
          r.source ?? null,
          r.theme ?? null,
          rec.ec_kind,
          rec.ec_value,
          pos,
          r.seed ?? null,
          r.speed ?? null,
          r.keys ?? null,
          r.mistakes ?? null,
          r.accuracy ?? null,
          r.correctCount ?? null,
          r.seconds ?? null,
          r.date ?? null,
        ],
      })
    })
  })
  return loadRecordsDb(db)
}
