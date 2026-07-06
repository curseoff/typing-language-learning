// 選択肢下の「反対側」スロット。回答前も同じ高さを占めるようマスク表示で予約し、
// 回答後（revealed）に実際の値へ差し替える（レイアウトシフト防止）。
// kana があればルビ付き（RubyText）、無ければプレーンテキスト。値が無ければ何も出さない。
import { RubyText, MaskedRubyText } from './Text'

export interface OptionJaProps {
  ja?: string
  kana?: string
  revealed?: boolean
}

export default function OptionJa({ ja, kana, revealed }: OptionJaProps) {
  if (!ja) return null
  if (revealed) {
    return <span className="quiz-option-ja">{kana ? <RubyText ja={ja} kana={kana} /> : ja}</span>
  }
  return (
    <span className="quiz-option-ja masked" aria-hidden="true">
      <MaskedRubyText ja={ja} kana={kana} />
    </span>
  )
}
