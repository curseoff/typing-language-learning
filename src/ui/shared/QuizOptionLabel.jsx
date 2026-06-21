// 4択の選択肢ラベル。入力中の候補は、打った分を色づけて「どこまで打ったか」を表示する。
// opt = { display, variants, kana? }
import { kanjiDone } from '../../domain/typing/progress.js'
import { Chars } from './Text.jsx'

export default function QuizOptionLabel({ opt, input, picked, hasError }) {
  const typing = picked === null && input && opt.variants.some((v) => v.startsWith(input))
  if (!typing) return opt.display

  // 表示＝入力対象（英単語・英文など）：打鍵数ぶん色づけ
  if (opt.display === opt.variants[0]) {
    return <Chars text={opt.display} done={input.length} cursor={input.length} hasError={hasError} />
  }
  // 表示＝漢字、入力＝ローマ字（和訳の選択肢）：漢字位置に変換して色づけ
  if (opt.kana) {
    const done = kanjiDone({ ja: opt.display, kana: opt.kana }, input)
    return <Chars text={opt.display} done={done} cursor={done} hasError={hasError} />
  }
  return opt.display
}
