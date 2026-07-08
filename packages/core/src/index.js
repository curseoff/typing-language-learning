// @tll/core: React/DOM 非依存の純粋ドメイン。ローマ字エンジンと入力進捗計算を公開する。
// app / @tll/ui はここを参照する（依存方向：ui → core、app → core ＝ 正）。
export { romajiVariants, toRomaji, kanaConsumed } from './romaji/romaji.js'
export { KANA_TABLE, kanaOf, cellOf } from './romaji/kanaTable.js'
export {
  guideText,
  alignJaToKana,
  rubyParts,
  kanjiDone,
  consumedWords,
  chipProgress,
} from './typing/progress.js'
