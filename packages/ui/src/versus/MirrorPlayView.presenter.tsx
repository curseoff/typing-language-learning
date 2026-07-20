// #439 道Y：相手の入力盤面を「本物の TopFlow」で複製する共有 presenter（英英/単語/単語例文で共用・純粋描画）。
// solo の入力盤面（DictTypeView/WordTypeView/MarathonView）と同じ TopFlow（ティッカー＝スライド／2問カルーセル／
// 青枠）を使い、答え側（answerSide）の行だけを全面伏字（MaskedText/MaskedRuby・実文字を出さない＝カンニング防止）に
// する。進捗は相手から届く curPos（表示単位＝en は空白込み char／ja はかな消費数）から導く（segInput は使わない）。
// #439：both（英語・日本語）モードは typedSide に依らず常に「英語行＝伏字／日本語行＝実表示（問題文を全表示）」に
// 統一する（TopFlow 側の isBoth 分岐で maskRow='en' 固定・英語 filled は typedSide で curPos or 全 filled）。
// PlayMeta/StatsRow・カーソル・入力欄は持たない（対戦ヘッダバー＝MatchHeaderBar に集約）。3 モードで segments/answerSide/
// word が違うだけで UI は同一。見出し語（word）は任意（単語モードは空＝出さない）。wordJa は答えが和訳（ja）のとき隠す。
import TopFlow, { type TopSeg } from '../marathon/TopFlow.presenter'

// 見出し語ヘッダ「単語 <word>（<和訳>）」。solo（DictView の SegWord）と同じ .seg-word マークアップで見た目を揃える。
function SegWord({ word, wordJa }: { word?: string; wordJa?: string }) {
  if (!word) return null
  return (
    <p className="seg-word">
      単語 <strong>{word}</strong>
      {wordJa && <span className="seg-word-ja">（{wordJa}）</span>}
    </p>
  )
}

export interface MirrorPlayViewProps {
  segments: TopSeg[] // 受信側で再構成した相手の初回バッチ問題列（buildMirrorSegments の結果）
  segIndex: number // 相手が今解いている問題の配列 index（pickMirrorSegIndex の結果）
  answerSide: 'en' | 'ja' // 相手が打っている側＝全面伏字にする行
  curPos: number // 相手の進捗（TopFlow 表示単位：en=空白込み char／ja=かな消費数）
  miss?: boolean // 相手が現在問題でミス中か（答え行のカーソルを赤に）
  word?: string // 見出し語（表示可・空/未指定なら見出し無し＝単語モード）
  wordJa?: string // 見出し和訳（answerSide!=='ja' のときのみ表示・ja は答えになるため隠す）
}

export default function MirrorPlayView({ segments, segIndex, answerSide, curPos, miss = false, word, wordJa }: MirrorPlayViewProps) {
  return (
    <div className="game">
      <SegWord word={word} wordJa={answerSide === 'ja' ? undefined : wordJa} />
      <TopFlow
        segments={segments}
        segIndex={segIndex}
        mirror
        answerSide={answerSide}
        curPos={curPos}
        miss={miss}
        ticker
      />
    </div>
  )
}
