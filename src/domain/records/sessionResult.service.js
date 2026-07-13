// Domain Service（#290 Phase5）：どの Entity/VO にも自然に属さないロジック。
// sessionToRecord は「Session Entity の状態(progress)」＋「採点（ScoreRecord VO）」＋「外部メタ(meta)」を
// またいで1つの記録オブジェクトを作る純関数。
//   - Session Entity 自身の責務でも採点の責務でもない＝どちらにも属さない横断操作＝Service。
//   - session を破壊しない（progress() を読むだけ・finish は呼ばない）＝状態も副作用も持たない。
// 採点・meta マージ・凍結は makeScoreRecord（scoreRecord.vo.js）に委ね、記録生成を1箇所に閉じる。
// 純ドメイン：React/DOM/時間 非依存。
import { makeScoreRecord } from './scoreRecord.vo.js'
import { quizScore } from './segmentStats.service.js'

// session（TypingSession Entity）と外部 meta から記録値を組み立てる純関数。
export function sessionToRecord(session, meta = {}) {
  const { keys, mistakes, elapsedMs } = session.progress()
  return makeScoreRecord({ keys, mistakes, elapsedMs, meta })
}

// クイズ（useWordQuiz/useDictQuiz）の記録を作る純関数。
// 素の進捗（keys/mistakes/correct/total/elapsedMs）＋採点（quizScore）＋外部 meta を横断してまとめる。
//   - total は出力では words として持ち、total キーは残さない。
//   - correctCount（一発正解数）等は meta 経由で受ける。
//   - スコア/カウント項目（keys/mistakes/correct/words/speed/accuracy/seconds）を meta の後に展開し、
//     meta が採点/進捗の値を汚染できないようにする。
//   - 下流（saveWordRecord/setRecords）が触れる plain オブジェクトを返す（凍結しない）。
// 純ドメイン：React/DOM/時間 非依存・非破壊（meta を変更しない）。
export function quizToRecord({ keys, mistakes, correct, total, elapsedMs }, meta = {}) {
  const { speed, accuracy, seconds } = quizScore({ keys, correct, total, elapsedMs })
  return { ...meta, keys, mistakes, correct, words: total, speed, accuracy, seconds }
}
