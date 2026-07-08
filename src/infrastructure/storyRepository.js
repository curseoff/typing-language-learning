// 物語の永続化（発見エンド＋記録ランキング）。物語ごとにキーを分ける。
import { rankInsert, endConditionTag } from '../domain/records/ranking.js'

// 物語ごとのキー（例 story-records-v1-climbing）。
const foundKey = (storyId) => `story-endings-v1-${storyId}`
const RECORDS_PREFIX = 'story-records-v1-'
const recordsKey = (storyId) => `${RECORDS_PREFIX}${storyId}`

// 終了条件別の記録キー。time60/endless/未指定はタグ無し＝従来キーと一致。
export function storyRecKey(storyId, endCondition) {
  const base = recordsKey(storyId)
  const t = endConditionTag(endCondition)
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
  // 移行は従来キー（time60 相当・タグ無し）に対してのみ行う。
  migrateLegacy(storyId, LEGACY_RECORDS_KEY, recordsKey(storyId))
  return parseArray(localStorage.getItem(key))
}

// 全 storyId・全終了条件バリアントの物語記録をまとめて読む（#248）。
// localStorage を走査し、記録キーの接頭辞（末尾ハイフン付き）で始まるものだけを対象にする。
// これで base（story-records-v1-<id>）と終了条件別（…__<tag>）の両方を拾い、
// 発見エンド（story-endings-v1-…）とレガシー（story-records-v1／末尾ハイフン無し）は自然に除外される。
// 返り値はキー→記録配列のマップ（record は既に source:'story'/storyId を持つのでそのまま束ねる）。
export function loadAllStoryRecords() {
  const out = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(RECORDS_PREFIX)) continue
      const list = parseArray(localStorage.getItem(key))
      if (list.length) out[key] = list
    }
  } catch {
    return {}
  }
  return out
}

export function saveStoryRecord(storyId, record) {
  const key = storyRecKey(storyId, record.endCondition)
  const list = rankInsert(loadStoryRecords(storyId, record.endCondition), record) // 成績順・最大15件
  localStorage.setItem(key, JSON.stringify(list))
  return list
}
