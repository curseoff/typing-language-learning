// 入力進捗計算（表示ローマ字・漢字位置・単語チップ消費）の正本は @tll/core を再エクスポートする薄板。
// 実体は packages/core/src/typing/progress.js を参照。
export {
  kanaConsumed,
  guideText,
  alignJaToKana,
  rubyParts,
  kanjiDone,
  consumedWords,
  chipProgress,
} from '@tll/core'
