// 物語の永続化（発見エンド＋記録ランキング）。物語ごとにキーを分ける。
import { rankInsert } from '../domain/records/ranking.js'

// 物語ごとのキー（例 story-records-v1-climbing）。
const foundKey = (storyId) => `story-endings-v1-${storyId}`
const recordsKey = (storyId) => `story-records-v1-${storyId}`

// 旧（単一物語時代）のキー。travel の記録として一度だけ引き継ぐ。
const LEGACY_FOUND_KEY = 'story-endings-v1'
const LEGACY_RECORDS_KEY = 'story-records-v1'
const LEGACY_STORY_ID = 'travel'

function parseArray(raw) {
  try {
    const a = JSON.parse(raw || '[]')
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

// 旧キーがあり新キーが未作成なら、travel の新キーへ移してから旧キーを消す。
function migrateLegacy(storyId, legacyKey, newKey) {
  if (storyId !== LEGACY_STORY_ID) return
  const legacy = localStorage.getItem(legacyKey)
  if (legacy == null) return
  if (localStorage.getItem(newKey) == null) {
    localStorage.setItem(newKey, legacy)
  }
  localStorage.removeItem(legacyKey)
}

export function loadFound(storyId) {
  const key = foundKey(storyId)
  migrateLegacy(storyId, LEGACY_FOUND_KEY, key)
  return parseArray(localStorage.getItem(key))
}

export function saveFound(storyId, ids) {
  localStorage.setItem(foundKey(storyId), JSON.stringify(ids))
}

export function loadStoryRecords(storyId) {
  const key = recordsKey(storyId)
  migrateLegacy(storyId, LEGACY_RECORDS_KEY, key)
  return parseArray(localStorage.getItem(key))
}

export function saveStoryRecord(storyId, record) {
  const list = rankInsert(loadStoryRecords(storyId), record) // 速い順・最大15件
  localStorage.setItem(recordsKey(storyId), JSON.stringify(list))
  return list
}
