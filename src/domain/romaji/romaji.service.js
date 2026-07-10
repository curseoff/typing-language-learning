// ローマ字エンジンの正本は共有パッケージ @tll/core を再エクスポートする薄板。
// 実体は packages/core/src/romaji/romaji.service.js を参照。
export { romajiVariants, toRomaji, kanaConsumed } from '@tll/core'
