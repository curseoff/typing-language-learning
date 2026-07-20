// #439 対戦：相手の入力盤面を伏字で静止複製する共有 presenter（英英/単語/単語例文で共用・純粋描画）。
// solo の入力盤面（.game / .seg-word / .flow）と同じマークアップを使い、答え側の行だけを伏字マス
// （MaskBoard・実文字を出さない＝カンニング防止）に差し替える。非答え側（ヒント）は実テキスト
// （日本語は RubyText で読み補助）。PlayMeta/StatsRow は持たない（対戦ヘッダバー＝MatchHeaderBar に集約）。
// カーソル・入力欄・ティッカースクロールも持たない（相手の1問を静止複製）。見出し語（word）は任意
// （単語モードは空＝見出しを出さない）。3 モードで board の word/hint/answerShape が違うだけで UI は同一。
import { RubyText } from '../shared/Text.presenter'
import MaskBoard, { type MaskBoardCell } from './MaskBoard.presenter'

// ヒント（非答え側）の実テキスト。ja は kana を渡すとルビ表示（読み補助・答え側ではないので出してよい）。
export interface MirrorHint {
  side: 'en' | 'ja'
  text: string
  kana?: string
}

export interface PlayMirrorViewProps {
  word?: string // 見出し語（表示可・空/未指定なら見出し無し＝単語モード）
  wordJa?: string // 見出し和訳（en モードのみ・ja モードは付かない＝答えになるため）
  answerSide: 'en' | 'ja' // 相手が打っている側＝MaskBoard を出す行
  hint?: MirrorHint // 非答え側の実テキスト（無ければその行を出さない）
  cells: MaskBoardCell[] // 答え行の伏字マス列（domain maskBoardCells の結果）
}

export default function PlayMirrorView({ word, wordJa, answerSide, hint, cells }: PlayMirrorViewProps) {
  // 各言語行の中身：答え側は伏字マス、非答え側はヒントの実テキスト（該当が無ければ null＝行を出さない）。
  const rowContent = (side: 'en' | 'ja') => {
    if (side === answerSide) return <MaskBoard cells={cells} />
    if (hint && hint.side === side) {
      return side === 'ja' ? <RubyText ja={hint.text} kana={hint.kana ?? ''} /> : <span>{hint.text}</span>
    }
    return null
  }
  const enNode = rowContent('en')
  const jaNode = rowContent('ja')
  return (
    <div className="game">
      {word && (
        <p className="seg-word">
          単語 <strong>{word}</strong>
          {wordJa && <span className="seg-word-ja">（{wordJa}）</span>}
        </p>
      )}
      {/* solo の TopFlow と同じ .flow パネル＋ref-tag 行。ただし ticker は動かさず（静止）内容は全表示（vs-mirror-flow）。 */}
      <div className="flow vs-mirror-flow">
        {enNode && (
          <div className="flow-row">
            <span className="ref-tag en">英語</span>
            <div className="flow-track">{enNode}</div>
          </div>
        )}
        {jaNode && (
          <div className="flow-row">
            <span className="ref-tag ja">日本語</span>
            <div className="flow-track">{jaNode}</div>
          </div>
        )}
      </div>
    </div>
  )
}
