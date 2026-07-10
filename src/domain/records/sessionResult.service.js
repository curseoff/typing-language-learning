// Domain Service（#290 Phase5）：どの Entity/VO にも自然に属さないロジック。
// sessionToRecord は「Session Entity の状態(progress)」＋「採点(score)」＋「外部メタ(meta)」を
// またいで1つの記録オブジェクトを作る純関数。
//   - Session Entity 自身の責務でも score 計算の責務でもない＝どちらにも属さない横断操作＝Service。
//   - session を破壊しない（progress() を読むだけ・finish は呼ばない）＝状態も副作用も持たない。
// 純ドメイン：React/DOM/時間 非依存。
import { score } from '../marathon/scoring.service.js'

// session（TypingSession Entity）と外部 meta から記録値を組み立てる純関数。
export function sessionToRecord(session, meta = {}) {
  const { keys, mistakes, elapsedMs } = session.progress()
  const { speed, accuracy, seconds } = score({ keys, mistakes, elapsedMs })
  // 採点値・素の keys/mistakes を meta に重ねる（後勝ち＝採点/進捗が優先）。
  return { ...meta, keys, mistakes, speed, accuracy, seconds }
}
