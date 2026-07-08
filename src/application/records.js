// 記録の読み・書き・キー生成を application 層に集約するファサード。
// UI(.jsx) もフックも infrastructure を直接 import せず、ここ経由で記録を読み書きする
// （依存方向 ui → application → infrastructure を守るため。infra 直 import は facade のみ）。
//
// #266 Phase3a：キルスイッチで2実装を同居させる。
//   backend='local'（既定）… 現行 localStorage リポジトリを素通し（挙動不変）。
//   backend='sqlite'      … 起動時に構築したメモリ像から同期読み／save はメモリ像を即時更新して
//                            同期で更新後マップ（現行と同形）を返し、Worker への差分書き込みは
//                            write-queue 経由で fire-and-forget（write-through）。
// 同期シグネチャ・戻り値の形は現行据え置き（消費側は無改修で両バックエンドを通す）。
import {
  loadWordRecords as lsLoadWordRecords,
  saveWordRecord as lsSaveWordRecord,
  wordRecKey,
} from '../infrastructure/wordsRepository.js'
import {
  loadDictRecords as lsLoadDictRecords,
  saveDictRecord as lsSaveDictRecord,
  dictRecKey,
} from '../infrastructure/dictRepository.js'
import {
  loadStoryRecords as lsLoadStoryRecords,
  loadAllStoryRecords as lsLoadAllStoryRecords,
  saveStoryRecord as lsSaveStoryRecord,
  saveFound as lsSaveFound,
  loadFound as lsLoadFound,
  storyRecKey,
} from '../infrastructure/storyRepository.js'
import {
  loadRecords as lsLoadRecords,
  saveRecord as lsSaveRecord,
} from '../infrastructure/recordsRepository.js'
import {
  loadItemStats as lsLoadItemStats,
  recordItemStat as lsRecordItemStat,
  itemId,
} from '../infrastructure/itemStatsRepository.js'
import {
  buildImage,
  applySaveRecord,
  applySaveWordRecord,
  applySaveDictRecord,
  applyRecordItemStat,
  applySaveStoryRecord,
  applySaveFound,
} from './persist/memoryStore.js'
import { createWriteQueue } from './persist/writeQueue.js'

// ── バックエンド状態（モジュール内シングルトン）──
let backend = 'local'
let image = null // sqlite 時の全記録のメモリ像（buildImage の6マップ）
let queue = null // Worker への差分書き込みを直列化する write-queue

// 起動時（main.jsx）に sqlite バックエンドを有効化する。initialImage は Worker の hydrate 結果。
// handle は initStorage() のハンドル（save(repo, args)→Worker）。以後 save はここ経由で write-through。
export function initSqlitePersistence(handle, initialImage) {
  image = buildImage(initialImage)
  queue = createWriteQueue((op) => handle.save(op.repo, op.args))
  queue.setReady(true)
  backend = 'sqlite'
}

const isSqlite = () => backend === 'sqlite'

// ── ランキング（モード別）の読み書き ──
export function loadWordRecords() {
  return isSqlite() ? image.wordRecords : lsLoadWordRecords()
}
export function saveWordRecord(record) {
  if (!isSqlite()) return lsSaveWordRecord(record)
  image = { ...image, wordRecords: applySaveWordRecord(image.wordRecords, record) }
  queue.enqueue({ repo: 'word', args: [record] })
  return image.wordRecords
}
export function loadDictRecords() {
  return isSqlite() ? image.dictRecords : lsLoadDictRecords()
}
export function saveDictRecord(record) {
  if (!isSqlite()) return lsSaveDictRecord(record)
  image = { ...image, dictRecords: applySaveDictRecord(image.dictRecords, record) }
  queue.enqueue({ repo: 'dict', args: [record] })
  return image.dictRecords
}

// ── 物語（発見エンド＋記録）──
export function loadStoryRecords(storyId, endCondition) {
  if (!isSqlite()) return lsLoadStoryRecords(storyId, endCondition)
  return image.storyRecords[storyRecKey(storyId, endCondition)] || []
}
export function loadAllStoryRecords() {
  return isSqlite() ? image.storyRecords : lsLoadAllStoryRecords()
}
export function saveStoryRecord(storyId, record) {
  if (!isSqlite()) return lsSaveStoryRecord(storyId, record)
  image = { ...image, storyRecords: applySaveStoryRecord(image.storyRecords, storyId, record) }
  queue.enqueue({ repo: 'story', args: [storyId, record] })
  return image.storyRecords[storyRecKey(storyId, record.endCondition)] || []
}
export function saveFound(storyId, ids) {
  if (!isSqlite()) return lsSaveFound(storyId, ids)
  image = { ...image, storyFound: applySaveFound(image.storyFound, storyId, ids) }
  queue.enqueue({ repo: 'found', args: [storyId, ids] })
}
export function loadFound(storyId) {
  return isSqlite() ? image.storyFound[storyId] || [] : lsLoadFound(storyId)
}

// ── マラソンの記録 I/O（読み書き）。UI 合成層(App.jsx)の記録窓口をここに一本化 ──
export function loadRecords() {
  return isSqlite() ? image.records : lsLoadRecords()
}
export function saveRecord(record) {
  if (!isSqlite()) return lsSaveRecord(record)
  image = { ...image, records: applySaveRecord(image.records, record) }
  queue.enqueue({ repo: 'records', args: [record] })
  return image.records
}

// 記録マップのキー生成（フック由来の records マップから該当条件を引くのに使う）。
export { wordRecKey, dictRecKey }

// 選択条件のランキング配列を直接取り出す（UI が records マップを持たない場面で使う）。
// endCondition を渡すと終了条件別キー（time60/未指定は従来キー）で引く（#208 段3b）。
export function wordRanking(level, theme, mode, endCondition) {
  return loadWordRecords()[wordRecKey(level, theme, mode, endCondition)]
}
export function dictRanking(level, theme, mode, endCondition) {
  return loadDictRecords()[dictRecKey(level, theme, mode, endCondition)]
}

// ── 問題ごとの収録統計 ──
export function loadItemStats() {
  return isSqlite() ? image.itemStats : lsLoadItemStats()
}
// 問題別の累積統計を1件記録する（F-1：item_stats もファサードに集約）。戻り値は更新後マップ。
export function recordItemStat(id, delta) {
  if (!isSqlite()) return lsRecordItemStat(id, delta)
  image = { ...image, itemStats: applyRecordItemStat(image.itemStats, id, delta) }
  queue.enqueue({ repo: 'item', args: [id, delta] })
  return image.itemStats
}

// 収録一覧（ItemList）の type と mode から item-stats の id を作る。
// type='words'|'dict'|'marathon'（UI 都合の種類名）→ 記録上の接頭辞へ変換。
export function itemStatId(type, mode, key) {
  const prefix = type === 'dict' ? 'd' : type === 'marathon' ? 's' : 'w'
  return itemId(prefix, mode, key)
}

// 物語の場面ごとの id（story:mode:storyId/nodeId）。物語別に分けて衝突を防ぐ。
export function storyStatId(mode, storyId, nodeId) {
  return itemId('story', mode, `${storyId}/${nodeId}`)
}
