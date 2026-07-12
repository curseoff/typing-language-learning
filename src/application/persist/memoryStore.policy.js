// #266 Phase3a: 起動時メモリ像の組み立てと save のメモリ側適用（純関数・非破壊）。
// sqlite バックエンド時、ファサードはこのメモリ像から同期読み／同期更新し、
// 書き込みは write-queue 経由で Worker へ流す（write-through）。
// apply* は「現行 localStorage リポジトリと同じ最終結果」でなければならないため、
// キー生成はドメインのキー関数、並び/キャップは集約ルート RankingBoard.submit() を再利用する。
import { recKey } from '../../domain/records/ranking.service.js'
import { wordRecKey, dictRecKey, storyRecKey } from '../../domain/records/recordKeys.service.js'
import { makeItemStat } from '../../domain/records/itemStat.entity.js'
import { makeRankingBoard } from '../../domain/records/rankingBoard.aggregate.js'
import { normalizeEndCondition } from '../../domain/session/endCondition.vo.js'

// 記録を集約ルート RankingBoard.submit() へ通して整列＋上限を適用し、非凍結の素配列で返す
// （従来の rankInsert 直呼びと厳密に等価。保存側は可変配列を期待するため [...] で展開する）。
function rankedEntries(key, current, record) {
  const endCondition = normalizeEndCondition(record.endCondition)
  const board = makeRankingBoard({ key, endCondition, entries: current || [] })
  return [...board.submit(record).entries()]
}

// 6マップを束ねた像を作る。欠損枠は {} に正規化（undefined でも空マップ）。
export function buildImage({
  records,
  wordRecords,
  dictRecords,
  itemStats,
  storyFound,
  storyRecords,
} = {}) {
  return {
    records: records ?? {},
    wordRecords: wordRecords ?? {},
    dictRecords: dictRecords ?? {},
    itemStats: itemStats ?? {},
    storyFound: storyFound ?? {},
    storyRecords: storyRecords ?? {},
  }
}

// マラソン記録を1件適用し、更新後の全マップ（新参照）を返す（recordsRepository.saveRecord と同値）。
export function applySaveRecord(records, record) {
  const key = recKey(record.mode, record.rank, record.source, record.theme, record.endCondition)
  return { ...records, [key]: rankedEntries(key, records[key], record) }
}

// 単語記録を1件適用（wordsRepository.saveWordRecord と同値＝rankInsert は sort+slice と等価）。
export function applySaveWordRecord(wordRecords, record) {
  const key = wordRecKey(record.level, record.theme, record.mode, record.endCondition, record.range)
  return { ...wordRecords, [key]: rankedEntries(key, wordRecords[key], record) }
}

// 英英記録を1件適用（dictRepository.saveDictRecord と同値）。
export function applySaveDictRecord(dictRecords, record) {
  const key = dictRecKey(record.level, record.theme, record.mode, record.endCondition)
  return { ...dictRecords, [key]: rankedEntries(key, dictRecords[key], record) }
}

// 問題別の累積統計を1件適用（itemStatsRepository.recordItemStat と同値・count+1/各値加算）。
// 累積ルールは domain の ItemStat Entity に委譲し一本化する（infra の SQL upsert が同規則をミラーする）。
// 保存する map の値は従来どおり素データ {count, keys, mistakes, ms} に射影する（id/メソッドは混ぜない）。
export function applyRecordItemStat(itemStats, id, { keys, mistakes, ms }) {
  const cur = makeItemStat({ id, ...(itemStats[id] || {}) })
  const next = cur.recordAttempt({ keys, mistakes, ms })
  return {
    ...itemStats,
    [id]: { count: next.count, keys: next.keys, mistakes: next.mistakes, ms: next.ms },
  }
}

// 物語記録を1件適用（storyRepository.saveStoryRecord と同値・キーは storyRecKey）。
// 像は loadAllStoryRecords と同形（storyRecKey→record[] のマップ）。
export function applySaveStoryRecord(storyRecords, storyId, record) {
  const key = storyRecKey(storyId, record.endCondition)
  return { ...storyRecords, [key]: rankedEntries(key, storyRecords[key], record) }
}

// 発見エンドを storyId 単位でそのまま格納（発見順を保持・配列は複製して非破壊）。
export function applySaveFound(storyFound, storyId, ids) {
  return { ...storyFound, [storyId]: [...ids] }
}
