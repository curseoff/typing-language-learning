// 翻訳モード(英訳/和訳)。上に原文、下に単語チップ、入力欄は伏せて打つと現れる。
import { consumedWords, guideText } from '../../domain/typing/progress.js'
import { Chips, MaskedText, RubyText } from '../shared/index.js'

export default function TranslateView({ segments, segIndex, segInput, hasError }) {
  const seg = segments[segIndex]
  if (!seg) return null
  const toEnglish = seg.type === 'en' // 英訳(和文→英語)
  const sourceOf = (s) => (s.type === 'en' ? s.ja : s.en)
  const next = segments[segIndex + 1]

  // 英訳モードの原文は日本語なのでルビ(ふりがな)を付ける。和訳モードの原文は英語なのでそのまま。
  const renderSource = (s) =>
    toEnglish && s.kana ? <RubyText ja={s.ja} kana={s.kana} /> : sourceOf(s)

  const target = guideText(seg, segInput) // 打つべき文字列(伏せて表示)
  const pos = segInput.length
  const used = consumedWords(seg, segInput) // 打ち終えた単語数

  return (
    <div className="translate">
      <div className="tr-task">{toEnglish ? '日本語を英語に訳す' : '英語を日本語に訳す'}</div>
      <div className="tr-source">{renderSource(seg)}</div>
      {next && <div className="tr-next">次: {renderSource(next)}</div>}

      <Chips chips={seg.chips} used={used} />

      <div className={`tr-input ${hasError ? 'error' : ''}`}>
        <MaskedText text={target} pos={pos} hasError={hasError} />
      </div>
    </div>
  )
}
