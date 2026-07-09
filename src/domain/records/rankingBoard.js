// RankingBoard は記録ランキングを表す Aggregate（集約）で、この関数が返すオブジェクトが
// Aggregate Root（集約ルート）。ルートが不変条件（top MAX_RECORDS 件・compareRecords(ec)
// 順の整列）を常に保証し、状態変更はルートの submit() 経由のみに限定する（rankInsert の
// 直呼びはルート内に隠蔽し、外部からは submit でしか記録を足せない）。
// 同一性は key（Entity＝別 entries でも key が同じなら同一）。EndCondition VO を内包し、
// 生成時に VO を検証する。イミュータブル（submit は元を変えず新しい board を返す）。
// 純ドメイン：React/DOM/Date/乱数 非依存・副作用なし・決定的。
import { MAX_RECORDS, rankInsert } from './ranking.js'
import { isEndCondition } from '../session/endCondition.js'

// 集約ルートを生成する。key は同一性（非空文字列必須）、endCondition は内包する VO（必須）。
// entries は順不同・超過でも生成時に不変条件へ正規化する（rankInsert の畳み込みで整列＆切詰め）。
export function makeRankingBoard({ key, endCondition, entries = [] }) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error(`makeRankingBoard: key は非空文字列が必要: ${String(key)}`)
  }
  if (!isEndCondition(endCondition)) {
    throw new Error('makeRankingBoard: endCondition は妥当な EndCondition VO が必要')
  }

  // 生成時の正規化：空配列から各 entry を rankInsert で畳み込み、整列＆上限を満たす内部像を作る。
  const normalized = (entries || []).reduce(
    (acc, record) => rankInsert(acc, record, endCondition, MAX_RECORDS),
    [],
  )

  return Object.freeze({
    key,
    endCondition,

    // 記録を追加した新しい RankingBoard を返す（元は不変）。満杯で悪い記録は入らない（rankInsert の性質）。
    submit(record) {
      const nextEntries = rankInsert(normalized, record, endCondition, MAX_RECORDS)
      return makeRankingBoard({ key, endCondition, entries: nextEntries })
    },

    // 内部ランキングの凍結スナップショット（書き換えても board 内部は不変）。
    entries() {
      return Object.freeze([...normalized])
    },

    size() {
      return normalized.length
    },

    isFull() {
      return normalized.length === MAX_RECORDS
    },

    // 先頭（最良）。空なら null。
    best() {
      return normalized.length > 0 ? normalized[0] : null
    },
  })
}

// 集約ルートの同一性（Entity）。key が一致すれば entries が違っても等価。
// throw せず boolean を返し、null/不正（key を持たない）は false。
export function rankingBoardEquals(a, b) {
  if (a == null || b == null) return false
  if (typeof a.key !== 'string' || typeof b.key !== 'string') return false
  return a.key === b.key
}
