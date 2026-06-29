// 記録の読み・書き・キー生成を application 層に集約するファサード。
// UI(.jsx) もフックも infrastructure を直接 import せず、ここ経由で記録を読み書きする
// （依存方向 ui → application → infrastructure を守るため。infra 直 import は facade のみ）。挙動は infrastructure と同一。
import { loadWordRecords, saveWordRecord, wordRecKey } from '../infrastructure/wordsRepository.js'
import { loadDictRecords, saveDictRecord, dictRecKey } from '../infrastructure/dictRepository.js'
import { loadStoryRecords, saveStoryRecord, saveFound, loadFound } from '../infrastructure/storyRepository.js'
import { loadRecords, saveRecord } from '../infrastructure/recordsRepository.js'
import { loadItemStats, itemId } from '../infrastructure/itemStatsRepository.js'

// ── ランキング（モード別）の読み書き ──
export { loadWordRecords, saveWordRecord, loadDictRecords, saveDictRecord }
export { loadStoryRecords, saveStoryRecord, saveFound, loadFound }

// ── マラソンの記録 I/O（読み書き）。UI 合成層(App.jsx)の記録窓口をここに一本化 ──
export { loadRecords, saveRecord }

// 記録マップのキー生成（フック由来の records マップから該当条件を引くのに使う）。
export { wordRecKey, dictRecKey }

// 選択条件のランキング配列を直接取り出す（UI が records マップを持たない場面で使う）。
export function wordRanking(level, theme, mode) {
  return loadWordRecords()[wordRecKey(level, theme, mode)]
}
export function dictRanking(level, theme, mode) {
  return loadDictRecords()[dictRecKey(level, theme, mode)]
}

// ── 問題ごとの収録統計 ──
export { loadItemStats }

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
