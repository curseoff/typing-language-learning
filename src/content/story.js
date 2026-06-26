// 物語データのエントリ。複数物語に対応したため実体は content/stories/ に移した。
// 後方互換のため、デフォルト物語（先頭＝travel）を STORY として再エクスポートする。
import { STORIES, storyById, DEFAULT_STORY_ID } from './stories/index.js'

export { STORIES, storyById, DEFAULT_STORY_ID }

// 後方互換：単一物語を前提にしていた箇所向け（新規コードは storyById を使う）。
export const STORY = STORIES[0]
