// Repository（リポジトリ）は集約 RankingBoard を「コレクションのように出し入れする
// 永続化抽象」。注入された store（Port）に依存し、実体（in-memory / sqlite など）を
// 差し替え可能にすることで、ドメインは永続化の詳細を知らない（永続化無知）。
// findByKey は store の記録から集約を再構築し、save は集約の内部像を store へ書き出す。
// 今回の createInMemoryRankingStore は学習/テスト用の in-memory アダプタ（実 sqlite 配線は別途）。
// 純ドメイン：React/DOM/Date/乱数/infra 非依存・副作用は注入 store のみ・決定的。
import { makeRankingBoard } from './rankingBoard.aggregate.js'

// Port（永続化アダプタ）の学習/テスト用 in-memory 実装。
// 内部 Map にキーごとの記録配列を保持し、save 時はスナップショット（コピー）を持つ＝
// 呼び出し側が渡した配列を後から破壊しても store 内は不変。
export function createInMemoryRankingStore() {
  const map = new Map()
  return {
    // 未保存キーは undefined。
    load(key) {
      return map.get(key)
    },
    // 渡された配列をコピーして保持（スナップショット）。
    save(key, records) {
      map.set(key, [...records])
    },
  }
}

// Repository。注入された store（Port）に依存し、実体を差し替え可能。
export function createRankingRepository(store) {
  // store の記録から集約を再構築する。未保存（undefined）は null に正規化。
  function findByKey(key, endCondition) {
    const rows = store.load(key)
    return rows ? makeRankingBoard({ key, endCondition, entries: rows }) : null
  }

  // 集約の内部像（整列済み entries）を board.key で store へ書き出す。
  function save(board) {
    store.save(board.key, board.entries())
  }

  // read-modify-write を1メソッドに：load→submit→save し最新集約を返す。
  function submitRecord(key, endCondition, record) {
    const cur = findByKey(key, endCondition) ?? makeRankingBoard({ key, endCondition, entries: [] })
    const next = cur.submit(record)
    save(next)
    return next
  }

  return { findByKey, save, submitRecord }
}
