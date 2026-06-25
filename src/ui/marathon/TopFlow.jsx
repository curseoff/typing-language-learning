// 上部: 英語/日本語の二段フロー。データを組み立てて共有 Flow に渡す。
// 入力モードに関わらず英語・日本語の両方を常に表示し、入力中の言語だけ進捗を色づける。
import { useMemo } from 'react'
import { alignJaToKana, kanaConsumed } from '../../domain/typing/progress.js'
import { Flow } from '../shared/index.js'

export default function TopFlow({ segments, segIndex, segInput, hasError = false, ticker = false }) {
  // 文ごとに1件(sentenceIndex で集約)
  const sentences = useMemo(() => {
    const map = new Map()
    for (const s of segments) if (!map.has(s.sentenceIndex)) map.set(s.sentenceIndex, s)
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

  // 英文の進捗：入力中は入力分、both で和文入力中は完了済み、単一言語モードの参考表示は0
  const enDone = !seg
    ? 0
    : enActive
      ? Math.min(segInput.length, seg.en.length)
      : isBoth
        ? seg.en.length
        : 0
  // 漢字の進捗（ローマ字→漢字位置）と、読み(かな)の進捗（ルビをかな単位で着色するため）
  const { jaDone, jaKanaDone } = useMemo(() => {
    if (!seg || !jaActive) return { jaDone: 0, jaKanaDone: 0 }
    const consumed = kanaConsumed(seg.kana, segInput)
    const ends = alignJaToKana(seg.ja, seg.kana)
    let count = 0
    for (const e of ends) if (e <= consumed) count++
    return { jaDone: count, jaKanaDone: consumed }
  }, [seg, jaActive, segInput])

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
      hasError={hasError}
      activeRow={enActive ? 'en' : jaActive ? 'ja' : null}
      showEn
      showJa
      wrap={!ticker}
      ticker={ticker}
    />
  )
}
