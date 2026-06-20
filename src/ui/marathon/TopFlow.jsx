// 上部: 英語/日本語の二段フロー。データを組み立てて共有 Flow に渡す。
import { useMemo } from 'react'
import { alignJaToKana, kanaConsumed } from '../../domain/typing/progress.js'
import { Flow } from '../shared/index.js'

export default function TopFlow({ segments, segIndex, segInput }) {
  // 文ごとに1件(sentenceIndex で集約)
  const sentences = useMemo(() => {
    const map = new Map()
    for (const s of segments) if (!map.has(s.sentenceIndex)) map.set(s.sentenceIndex, s)
    return [...map.values()]
  }, [segments])
  const hasEn = useMemo(() => segments.some((s) => s.type === 'en'), [segments])
  const hasJa = useMemo(() => segments.some((s) => s.type === 'ja'), [segments])

  const seg = segments[segIndex]
  const cur = seg ? seg.sentenceIndex : 0
  const enActive = seg?.type === 'en'
  const jaActive = seg?.type === 'ja'

  // 英文の進捗（和文入力中は英文は完了済み）
  const enDone = !seg ? 0 : enActive ? Math.min(segInput.length, seg.en.length) : seg.en.length
  // 漢字の進捗（ローマ字の進捗を漢字位置に変換）
  const jaDone = useMemo(() => {
    if (!seg || !jaActive) return 0
    const consumed = kanaConsumed(seg.kana, segInput)
    const ends = alignJaToKana(seg.ja, seg.kana)
    let count = 0
    for (const e of ends) if (e <= consumed) count++
    return count
  }, [seg, jaActive, segInput])

  // 現在の文＋先読み数件を折り返し表示
  const items = sentences.slice(cur, cur + 5)
  return (
    <Flow
      items={items}
      cur={0}
      enDone={enDone}
      jaDone={jaDone}
      activeRow={enActive ? 'en' : jaActive ? 'ja' : null}
      showEn={hasEn}
      showJa={hasJa}
      wrap
    />
  )
}
