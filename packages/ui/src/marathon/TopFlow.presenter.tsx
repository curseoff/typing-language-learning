// 上部: 英語/日本語の二段フロー。データを組み立てて共有 Flow に渡す。
// 入力モードに関わらず英語・日本語の両方を常に表示し、入力中の言語だけ進捗を色づける。
import { useMemo } from 'react'
import { alignJaToKana, kanaConsumed } from '@tll/core'
import { Flow } from '../shared/Flow.presenter'
import type { MaskRange } from '../shared/Text.presenter'

export interface TopSeg {
  type: 'ja' | 'en'
  ja: string
  en: string
  kana?: string
  sentenceIndex: number
  cloze?: boolean // #402 穴埋め対象語（入力側を伏字にする＝単語モード）
  clozeRanges?: MaskRange[] // #402 例文/英英の文中伏字（英文 en 内の内容語 char レンジ）
}

export interface TopFlowProps {
  segments: TopSeg[]
  segIndex: number
  segInput?: string
  hasError?: boolean
  ticker?: boolean
  clozeRevealed?: boolean // #402 現在語(cloze)でミスがあり正解を開示中か
  // #439 相手盤面複製（mirror）：自分の segInput ではなく、相手の進捗 curPos から表示を導く。
  //   answerSide＝相手が打っている側＝全面伏字にする行（Flow の maskRow へ渡す）。
  //   curPos は TopFlow 表示単位（en=空白込み char／ja=かな消費数）。miss で答え行のカーソルを赤に。
  mirror?: boolean
  answerSide?: 'en' | 'ja'
  curPos?: number
  miss?: boolean
}

export default function TopFlow({
  segments,
  segIndex,
  segInput = '',
  hasError = false,
  ticker = false,
  clozeRevealed = false,
  mirror = false,
  answerSide,
  curPos = 0,
  miss = false,
}: TopFlowProps) {
  // 文ごとに1件(sentenceIndex で集約)。both は en/ja 2 seg あるので、
  // #402 穴埋めではどちらの seg に cloze が付くかを両 seg 見て clozeSide に集約する。
  const sentences = useMemo(() => {
    const map = new Map<number, TopSeg & { clozeSide?: 'en' | 'ja' }>()
    for (const s of segments) {
      if (!map.has(s.sentenceIndex)) map.set(s.sentenceIndex, { ...s })
      const rep = map.get(s.sentenceIndex)!
      if (s.cloze) {
        rep.cloze = true
        rep.clozeSide = s.type // cloze が付いた側（en=英語のみ / ja=読みのみ）を伏せる
      }
      if (s.clozeRanges) rep.clozeRanges = s.clozeRanges // 例文/英英の文中伏字（英文 en）
    }
    return [...map.values()]
  }, [segments])
  // 英→日の両方を打つモード（both）か。単一言語モードでは非入力側は参考表示。
  const isBoth = useMemo(
    () => segments.some((s) => s.type === 'en') && segments.some((s) => s.type === 'ja'),
    [segments],
  )

  const seg = segments[segIndex]
  const curIdx = seg ? sentences.findIndex((s) => s.sentenceIndex === seg.sentenceIndex) : 0
  const enActive = seg?.type === 'en'
  const jaActive = seg?.type === 'ja'
  // mirror では「答え側（answerSide）」を打っている扱いにし、進捗は curPos から導く（hint 側は 0＝素の文脈表示）。
  const effActiveRow = mirror ? answerSide ?? null : enActive ? 'en' : jaActive ? 'ja' : null
  const effError = mirror ? miss : hasError

  // 英文の進捗：mirror は answerSide==='en' のとき curPos（空白込み char）を上限 clamp。hint 側は0（素表示）。
  //   非 mirror は従来（入力中は入力分／both で和文入力中は完了済み／単一言語の参考表示は0）。
  const enDone = !seg
    ? 0
    : mirror
      ? answerSide === 'en'
        ? Math.min(curPos, [...seg.en].length)
        : 0
      : enActive
        ? Math.min(segInput.length, seg.en.length)
        : isBoth
          ? seg.en.length
          : 0
  // 漢字の進捗（ローマ字→漢字位置）と、読み(かな)の進捗（ルビをかな単位で着色するため）
  //   mirror は answerSide==='ja' のとき curPos を「かな消費数」とみなして漢字 done を数える（hint 側は 0）。
  const { jaDone, jaKanaDone } = useMemo(() => {
    if (mirror) {
      if (answerSide !== 'ja' || !seg || !seg.kana) return { jaDone: 0, jaKanaDone: 0 }
      const consumed = Math.min(curPos, [...seg.kana].length)
      const ends = alignJaToKana(seg.ja, seg.kana)
      let count = 0
      for (const e of ends) if (e <= consumed) count++
      return { jaDone: count, jaKanaDone: consumed }
    }
    if (!seg || !jaActive) return { jaDone: 0, jaKanaDone: 0 }
    const consumed = kanaConsumed(seg.kana, segInput)
    const ends = alignJaToKana(seg.ja, seg.kana)
    let count = 0
    for (const e of ends) if (e <= consumed) count++
    return { jaDone: count, jaKanaDone: consumed }
  }, [seg, jaActive, segInput, mirror, answerSide, curPos])

  // ティッカー: 0から全件描画し現在語の左端を固定して滑らかにスクロール（単語モード向け）。
  // 通常(wrap): 現在文＋先読み数件を折り返し表示（長文の例文・物語向け）。
  const items = ticker ? sentences.slice(0, curIdx + 6) : sentences.slice(curIdx, curIdx + 5)
  const flowCur = ticker ? curIdx : 0
  return (
    <Flow
      items={items}
      cur={flowCur}
      enDone={enDone}
      jaDone={jaDone}
      jaKanaDone={jaKanaDone}
      hasError={effError}
      activeRow={effActiveRow}
      showEn
      showJa
      wrap={!ticker}
      ticker={ticker}
      isBoth={isBoth}
      clozeRevealed={clozeRevealed}
      maskRow={mirror ? answerSide : undefined}
    />
  )
}
