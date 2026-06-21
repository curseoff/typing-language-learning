// 4択の選択肢ラベル。入力中の候補は、打った分だけ色づけて「どこまで打ったか」を示す。
// Chars(1文字ずつの字間あり)は使わず、打鍵済みプレフィックスのみ着色して字間を保つ。
// opt = { display, variants, kana? }
import { kanjiDone } from '../../domain/typing/progress.js'

export default function QuizOptionLabel({ opt, input, picked, hasError }) {
  const typing = picked === null && input && opt.variants.some((v) => v.startsWith(input))
  if (!typing) return opt.display

  let done = 0
  if (opt.display === opt.variants[0]) done = input.length // 表示＝入力対象（英語）
  else if (opt.kana) done = kanjiDone({ ja: opt.display, kana: opt.kana }, input) // 漢字←ローマ字
  else return opt.display

  const chars = [...opt.display]
  return (
    <>
      <span className={`opt-typed ${hasError ? 'err' : ''}`}>{chars.slice(0, done).join('')}</span>
      {chars.slice(done).join('')}
    </>
  )
}
