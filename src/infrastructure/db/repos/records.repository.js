// マラソン記録の DB リポジトリ（現行 recordsRepository と同値な round-trip）。
// キー生成/並び/キャップはドメインを再利用（recKey／集約 RankingBoard.submit）＝localStorage 版と同一ロジック。
import { recKey } from '../../../domain/records/ranking.service.js'
import { makeRankingBoard } from '../../../domain/records/rankingBoard.aggregate.js'
import { normalizeEndCondition } from '../../../domain/session/endCondition.vo.js'
import { assign, ecToColumns, ecFromRow } from './_codec.mapper.js'

const COLS =
  '"mode","rank","source","theme","ec_kind","ec_value","pos",' +
  '"seed","speed","keys","mistakes","accuracy","correctCount","seconds","date","range"'

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
  assign(rec, 'range', row.range)
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
    const key = recKey(rec.mode, rec.rank, rec.source, rec.theme, rec.endCondition, rec.range)
    ;(out[key] ||= []).push(rec)
  }
  return out
}

// sampleRecord が属するグループ（recKey と同じ座標）を list で丸ごと置き換える。
// 保存も削除も「グループ内の全行を消して新しい並びを pos 昇順で入れ直す」で表せるため共通化する
// （list が空ならグループの行は 1 本も残らない＝#451 の最後の1件削除）。呼び出し側で transaction を張る。
function replaceGroup(db, sampleRecord, list) {
  const ec = ecToColumns(sampleRecord.endCondition)
  db.exec({
    sql:
      'DELETE FROM "records" WHERE "mode" IS ? AND "rank" IS ? AND "source" IS ? AND ' +
      '"theme" IS ? AND "ec_kind" IS ? AND "ec_value" IS ? AND "range" IS ?',
    bind: [
      sampleRecord.mode ?? null,
      sampleRecord.rank ?? null,
      sampleRecord.source ?? null,
      sampleRecord.theme ?? null,
      ec.ec_kind,
      ec.ec_value,
      sampleRecord.range ?? null,
    ],
  })
  list.forEach((r, pos) => {
    const rec = ecToColumns(r.endCondition)
    db.exec({
      sql: `INSERT INTO "records" (${COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
        r.range ?? null,
      ],
    })
  })
}

// 記録を1件保存し、更新後の全マップを返す（該当グループを DELETE→pos 昇順 INSERT）。
export function saveRecordDb(db, record) {
  db.transaction(() => {
    const key = recKey(
      record.mode,
      record.rank,
      record.source,
      record.theme,
      record.endCondition,
      record.range
    )
    const current = loadRecordsDb(db)[key] || []
    const board = makeRankingBoard({
      key,
      endCondition: normalizeEndCondition(record.endCondition),
      entries: current,
    })
    replaceGroup(db, record, [...board.submit(record).entries()])
  })
  return loadRecordsDb(db)
}

// #451 sampleRecord のグループを list（削除後の残り）で置き換える。削除専用 SQL は持たず、
// メモリ像（正）の結果をそのまま反映する＝並び直しも削除も同じ経路で整合する。
export function replaceRecordsGroupDb(db, sampleRecord, list) {
  db.transaction(() => replaceGroup(db, sampleRecord, list))
  return loadRecordsDb(db)
}
