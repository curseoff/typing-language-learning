// 単一かなに対するローマ字入力の判定（練習モード用）。
// romajiVariants（許容する全綴り）を正本に、途中受理と打ち切りを判定する。
import { romajiVariants } from '@tll/core'

// input が kana の妥当な綴りの前方一致か（打鍵途中として受理できるか）。空入力は常に true。
export function acceptsRomaji(kana, input) {
  return romajiVariants(kana).some((v) => v.startsWith(input))
}

// input が kana を打ち切ったか（妥当な綴りのいずれかと完全一致か）。
export function isKanaComplete(kana, input) {
  return romajiVariants(kana).includes(input)
}
