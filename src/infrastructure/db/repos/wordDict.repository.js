// 単語問題・英英辞典クイズ記録の DB リポジトリ共通ファクトリ。
// 両者はテーブル名とキー関数（wordRecKey/dictRecKey）が違うだけで写像は同一なので factory 化する。
// 現行 wordsRepository/dictRepository と同値な round-trip を保つ。
import { makeRankingBoard } from '../../../domain/records/rankingBoard.vo.js'
import { normalizeEndCondition } from '../../../domain/session/endCondition.vo.js'
import { assign, ecToColumns, ecFromRow, jsonToColumn, jsonFromColumn } from './_codec.mapper.js'

const COLS =
  '"level","theme","mode","ec_kind","ec_value","pos",' +
  '"source","seed","speed","keys","mistakes","accuracy",' +
  '"correct","correctCount","words","seconds","date","seg_stats"'

function rowToRecord(row) {
  const rec = {}
  assign(rec, 'source', row.source)
  assign(rec, 'seed', row.seed)
  assign(rec, 'level', row.level)
  assign(rec, 'theme', row.theme)
  assign(rec, 'mode', row.mode)
  assign(rec, 'speed', row.speed)
  assign(rec, 'keys', row.keys)
  assign(rec, 'mistakes', row.mistakes)
  assign(rec, 'accuracy', row.accuracy)
  assign(rec, 'correct', row.correct)
  assign(rec, 'correctCount', row.correctCount)
  assign(rec, 'words', row.words)
  assign(rec, 'seconds', row.seconds)
  assign(rec, 'date', row.date)
  const ec = ecFromRow(row)
  if (ec) rec.endCondition = ec
  const seg = jsonFromColumn(row.seg_stats)
  if (seg !== undefined) rec.segStats = seg
  return rec
}

// table＝'word_records'|'dict_records'、keyFn＝wordRecKey|dictRecKey。
export function makeWordDictDb(table, keyFn) {
  const key = (r) => keyFn(r.level, r.theme, r.mode, r.endCondition)

  function load(db) {
    const rows = db.selectObjects(`SELECT ${COLS} FROM "${table}" ORDER BY "pos","id"`)
    const out = {}
    for (const row of rows) {
      const rec = rowToRecord(row)
      ;(out[key(rec)] ||= []).push(rec)
    }
    return out
  }

  function save(db, record) {
    db.transaction(() => {
      const current = load(db)[key(record)] || []
      const board = makeRankingBoard({
        key: key(record),
        endCondition: normalizeEndCondition(record.endCondition),
        entries: current,
      })
      const list = [...board.submit(record).entries()]
      const ec = ecToColumns(record.endCondition)
      db.exec({
        sql:
          `DELETE FROM "${table}" WHERE "level" IS ? AND "theme" IS ? AND "mode" IS ? AND ` +
          '"ec_kind" IS ? AND "ec_value" IS ?',
        bind: [record.level ?? null, record.theme ?? null, record.mode ?? null, ec.ec_kind, ec.ec_value],
      })
      list.forEach((r, pos) => {
        const rec = ecToColumns(r.endCondition)
        db.exec({
          sql: `INSERT INTO "${table}" (${COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          bind: [
            r.level ?? null,
            r.theme ?? null,
            r.mode ?? null,
            rec.ec_kind,
            rec.ec_value,
            pos,
            r.source ?? null,
            r.seed ?? null,
            r.speed ?? null,
            r.keys ?? null,
            r.mistakes ?? null,
            r.accuracy ?? null,
            r.correct ?? null,
            r.correctCount ?? null,
            r.words ?? null,
            r.seconds ?? null,
            r.date ?? null,
            jsonToColumn(r.segStats),
          ],
        })
      })
    })
    return load(db)
  }

  return { save, load }
}
