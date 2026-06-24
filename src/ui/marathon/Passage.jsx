// 下部本文: 600文字を最初から全文表示。英文は英字、和文は漢字のまま表示し、
// 打った位置を色分け(和文はローマ字入力の進捗を漢字位置に変換)。
import { alignJaToKana, guideText, kanaConsumed } from '../../domain/typing/progress.js'
import { TARGET_KEYS } from '../../domain/marathon/passage.js'
import { Chars, RubyChars } from '../shared/index.js'

export default function Passage({ segments, segIndex, segInput, completed, hasError }) {
  // 各セグメント先頭までの打鍵対象(romaji/英字)の通し文字数 → 600超過の判定に使う
  const tgtLen = (seg, i) => {
    const state = i < segIndex ? 'done' : i === segIndex ? 'current' : 'future'
    return state === 'done'
      ? (completed[i] ?? seg.canonical).length
      : state === 'current'
        ? guideText(seg, segInput).length
        : seg.canonical.length
  }
  // offsets[i] = セグメント0..i の打鍵対象長の累積（over 判定は offsets[i-1]＝当該セグメント先頭までの累積）
  const offsets = segments.reduce((acc, seg, i) => {
    acc.push((acc[i - 1] ?? 0) + tgtLen(seg, i))
    return acc
  }, [])
  return (
    <div className={`passage ${hasError ? 'error' : ''}`}>
      {segments.map((seg, i) => {
        const state = i < segIndex ? 'done' : i === segIndex ? 'current' : 'future'
        const over = (offsets[i - 1] ?? 0) >= TARGET_KEYS

        // 表示文字列と「打ち終えた文字数」「カーソル位置」を決める
        let display
        let doneLen
        if (seg.type === 'ja') {
          display = seg.ja // 漢字のまま表示
          if (state === 'done') doneLen = [...seg.ja].length
          else if (state === 'current') {
            const consumed = kanaConsumed(seg.kana, segInput)
            const ends = alignJaToKana(seg.ja, seg.kana)
            doneLen = ends.filter((e) => e <= consumed).length
          } else doneLen = 0
        } else {
          display =
            state === 'done'
              ? completed[i] ?? seg.canonical
              : state === 'current'
                ? guideText(seg, segInput)
                : seg.canonical
          doneLen = state === 'done' ? display.length : state === 'current' ? segInput.length : 0
        }

        return (
          <span key={i}>
            {i > 0 && <span className="gap"> </span>}
            {seg.type === 'ja' ? (
              <RubyChars
                ja={seg.ja}
                kana={seg.kana}
                done={doneLen}
                cursor={state === 'current' ? doneLen : -1}
                hasError={hasError}
                over={over}
              />
            ) : (
              <Chars
                text={display}
                done={doneLen}
                cursor={state === 'current' ? doneLen : -1}
                hasError={hasError}
                over={over}
              />
            )}
          </span>
        )
      })}
    </div>
  )
}
