// 物語の永続化（発見エンド＋記録ランキング）。物語ごとにキーを分ける。
import { rankInsert, endConditionToken, isRecordable } from '../domain/records/ranking.js'

// 物語ごとのキー（例 story-records-v1-climbing）。
const foundKey = (storyId) => `story-endings-v1-${storyId}`
const recordsKey = (storyId) => `story-records-v1-${storyId}`

// 終了条件別の記録キー。time60/endless/未指定はトークン無し＝従来キーと一致。
export function storyRecKey(storyId, endCondition) {
  const base = recordsKey(storyId)
  const t = endConditionToken(endCondition)
  return t ? `${base}__${t}` : base
}

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

export function loadStoryRecords(storyId, endCondition) {
  const key = storyRecKey(storyId, endCondition)
  // 移行は従来キー（time60 相当・トークン無し）に対してのみ行う。
  migrateLegacy(storyId, LEGACY_RECORDS_KEY, recordsKey(storyId))
  return parseArray(localStorage.getItem(key))
}

export function saveStoryRecord(storyId, record) {
  if (!isRecordable(record.endCondition)) return loadStoryRecords(storyId, record.endCondition) // endless は非記録
  const key = storyRecKey(storyId, record.endCondition)
  const list = rankInsert(loadStoryRecords(storyId, record.endCondition), record) // 成績順・最大15件
  localStorage.setItem(key, JSON.stringify(list))
  return list
}
