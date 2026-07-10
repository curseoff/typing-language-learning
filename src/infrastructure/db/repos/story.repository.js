// 物語の永続化（発見エンド＋記録ランキング）の DB リポジトリ（現行 storyRepository と同値）。
// story 記録は endCondition を持たない場合が基本（＝ec_kind/ec_value は nullable）。持つ場合は列化する。
// キー/並び/キャップはドメイン・storyRecKey を再利用（rankInsert）。
import { rankInsert } from '../../../domain/records/ranking.service.js'
import { storyRecKey } from '../../../domain/records/recordKeys.service.js'
import { assign, ecToColumns, ecFromRow, jsonToColumn, jsonFromColumn } from './_codec.mapper.js'

const COLS =
  '"story_id","ec_kind","ec_value","pos","mode","source","ending","endLabel",' +
  '"speed","keys","mistakes","accuracy","seconds","date","seg_stats","choices"'

function rowToRecord(row) {
  const rec = {}
  assign(rec, 'storyId', row.story_id)
  assign(rec, 'mode', row.mode)
  assign(rec, 'source', row.source)
  assign(rec, 'ending', row.ending)
  assign(rec, 'endLabel', row.endLabel)
  assign(rec, 'speed', row.speed)
  assign(rec, 'keys', row.keys)
  assign(rec, 'mistakes', row.mistakes)
  assign(rec, 'accuracy', row.accuracy)
  assign(rec, 'seconds', row.seconds)
  assign(rec, 'date', row.date)
  const ec = ecFromRow(row)
  if (ec) rec.endCondition = ec
  const seg = jsonFromColumn(row.seg_stats)
  if (seg !== undefined) rec.segStats = seg
  const choices = jsonFromColumn(row.choices)
  if (choices !== undefined) rec.choices = choices
  return rec
}

// storyId の全記録を pos 昇順で読み、指定終了条件（storyRecKey）に該当する配列だけ返す。
export function loadStoryRecordsDb(db, storyId, endCondition) {
  const wantKey = storyRecKey(storyId, endCondition)
  const rows = db.selectObjects(
    `SELECT ${COLS} FROM "story_records" WHERE "story_id" IS ? ORDER BY "pos","id"`,
    [storyId],
  )
  const list = []
  for (const row of rows) {
    const rec = rowToRecord(row)
    if (storyRecKey(storyId, rec.endCondition) === wantKey) list.push(rec)
  }
  return list
}

// 全 storyId・全終了条件バリアントの記録を storyRecKey→配列マップで束ねる。
export function loadAllStoryRecordsDb(db) {
  const rows = db.selectObjects(`SELECT ${COLS} FROM "story_records" ORDER BY "pos","id"`)
  const out = {}
  for (const row of rows) {
    const rec = rowToRecord(row)
    const key = storyRecKey(row.story_id, rec.endCondition)
    ;(out[key] ||= []).push(rec)
  }
  return out
}

// 1件保存し、更新後の当該グループ配列を返す（rankInsert 成績順・最大 MAX_RECORDS）。
export function saveStoryRecordDb(db, storyId, record) {
  db.transaction(() => {
    const current = loadStoryRecordsDb(db, storyId, record.endCondition)
    const list = rankInsert(current, record)
    const ec = ecToColumns(record.endCondition)
    db.exec({
      sql: 'DELETE FROM "story_records" WHERE "story_id" IS ? AND "ec_kind" IS ? AND "ec_value" IS ?',
      bind: [storyId, ec.ec_kind, ec.ec_value],
    })
    list.forEach((r, pos) => {
      const rec = ecToColumns(r.endCondition)
      db.exec({
        sql: `INSERT INTO "story_records" (${COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        bind: [
          storyId,
          rec.ec_kind,
          rec.ec_value,
          pos,
          r.mode ?? null,
          r.source ?? null,
          r.ending ?? null,
          r.endLabel ?? null,
          r.speed ?? null,
          r.keys ?? null,
          r.mistakes ?? null,
          r.accuracy ?? null,
          r.seconds ?? null,
          r.date ?? null,
          jsonToColumn(r.segStats),
          jsonToColumn(r.choices),
        ],
      })
    })
  })
  return loadStoryRecordsDb(db, storyId, record.endCondition)
}

// 発見エンドを発見順（配列 verbatim）で保存する。id 昇順で復元できるよう都度全置換で入れ直す。
export function saveFoundDb(db, storyId, ids) {
  db.transaction(() => {
    db.exec({ sql: 'DELETE FROM "story_endings" WHERE "story_id" IS ?', bind: [storyId] })
    for (const endingId of ids) {
      db.exec({
        sql: 'INSERT INTO "story_endings" ("story_id","ending_id") VALUES (?,?)',
        bind: [storyId, endingId],
      })
    }
  })
}

// 発見エンドを発見順（id 昇順）で返す。
export function loadFoundDb(db, storyId) {
  const rows = db.selectObjects(
    'SELECT "ending_id" FROM "story_endings" WHERE "story_id" IS ? ORDER BY "id"',
    [storyId],
  )
  return rows.map((r) => r.ending_id)
}
