// 物語レジストリ。複数の物語をまとめ、id で引けるようにする。
// 各物語＝{ id, title, start, endingCount, nodes }。順序は表示順（先頭がデフォルト）。
import { travel } from './travel.js'
import { climbing } from './climbing.js'

export const STORIES = [travel, climbing]

// id → 物語オブジェクト（無ければ先頭を返す）
export function storyById(id) {
  return STORIES.find((s) => s.id === id) ?? STORIES[0]
}

// デフォルト（先頭）の物語 id
export const DEFAULT_STORY_ID = STORIES[0].id
