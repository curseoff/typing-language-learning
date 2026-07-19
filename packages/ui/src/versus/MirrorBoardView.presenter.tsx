// #439 対戦：相手1人ぶんの「盤面複製」＝いま相手が解いている1問を静止複製する presenter（純粋描画）。
// 方式B（構造送信）：答え側は伏字マス（MaskBoard・実文字を出さない）、非答え側（ヒント）は実テキスト。
// 見出し語ヘッダ（単語 <word>（<wordJa>）＝DictView の seg-word を踏襲）＋英語/日本語の2段（ref-tag ラベル付き）。
// wordJa 未指定（ja モード＝和訳が答え）は見出し和訳を出さない。答え側の綴り/かなは cells の長さ情報のみ。
import { RubyText } from '../shared/Text.presenter'
import MaskBoard, { type MaskBoardCell } from './MaskBoard.presenter'

// ヒント（非答え側）の実テキスト。ja は kana を渡すとルビ表示（読み補助・答え側ではないので出してよい）。
export interface MirrorHint {
  side: 'en' | 'ja'
  text: string
  kana?: string
}

export interface MirrorBoardData {
  word: string // 見出し語（表示可・空文字＝単語モード等で見出し無し）
  wordJa?: string // 見出し和訳（en モードのみ・ja モードは付かない）
  answerSide: 'en' | 'ja' // 相手が打っている側＝MaskBoard を出す行
  hint?: MirrorHint // 非答え側の実テキスト（VO が落とせば undefined＝マスだけ出す）
  cells: MaskBoardCell[] // 答え行の伏字マス列（domain maskBoardCells の結果）
}

export type MirrorBoardViewProps = MirrorBoardData

export default function MirrorBoardView({ word, wordJa, answerSide, hint, cells }: MirrorBoardViewProps) {
  // 各言語行の中身：答え側は伏字マス（MaskBoard）、非答え側はヒントの実テキスト（該当が無ければ null＝行を出さない）。
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
    <div className="vs-mirror">
      {word && (
        <p className="seg-word vs-mirror-word">
          単語 <strong>{word}</strong>
          {wordJa && <span className="seg-word-ja">（{wordJa}）</span>}
        </p>
      )}
      {enNode && (
        <div className="vs-mirror-row">
          <span className="ref-tag en">英語</span>
          <div className="vs-mirror-text">{enNode}</div>
        </div>
      )}
      {jaNode && (
        <div className="vs-mirror-row">
          <span className="ref-tag ja">日本語</span>
          <div className="vs-mirror-text">{jaNode}</div>
        </div>
      )}
    </div>
  )
}
