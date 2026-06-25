// 4択の選択肢ラベル。入力中の候補は、打った分だけ色づけて「どこまで打ったか」を示す。
// 和訳（kana あり）の選択肢はルビ付きで表示する。
// opt = { display, variants, kana? }
import { kanjiDone, kanaConsumed } from '../../domain/typing/progress.js'
import { RubyTyped } from './Text.jsx'

export default function QuizOptionLabel({ opt, input, picked, hasError }) {
  const typing = picked === null && input && opt.variants.some((v) => v.startsWith(input))

  // 和訳の選択肢：ルビ付き＋打鍵進捗で着色（漢字は漢字単位、ふりがなはかな単位）
  if (opt.kana) {
    const done = typing ? kanjiDone({ ja: opt.display, kana: opt.kana }, input) : 0
    const kanaDone = typing ? kanaConsumed(opt.kana, input) : 0
    return (
      <span className={`opt-ruby ${typing && hasError ? 'err' : ''}`}>
        <RubyTyped ja={opt.display} kana={opt.kana} done={done} kanaDone={kanaDone} />
      </span>
    )
  }

  // 英語の選択肢：打鍵済みプレフィックスのみ着色（字間を保つため1 span で包む）
  if (!typing) return <span>{opt.display}</span>
  const chars = [...opt.display]
  const done = input.length
  return (
    <span>
      <span className={`opt-typed ${hasError ? 'err' : ''}`}>{chars.slice(0, done).join('')}</span>
      {chars.slice(done).join('')}
    </span>
  )
}
