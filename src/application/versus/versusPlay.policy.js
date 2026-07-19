// #432 P2P穴埋め対戦：自分のプレイ進捗を相手へ送る progress payload へ変換する純ポリシー。
// 責務：手元の集計（typed/total/mistakes・segStats・進行中ミス・初期ライフ）から、
//       送信メッセージが必要とする派生値（correct＝一発正解数、lives＝サドンデス残機）を組み立てる。
// 純粋・入力非破壊（副作用/時刻/乱数なし）。lives はサドンデス時（initialLives が数値）だけ載せる。
import { firstTryCorrectCount, missedItemCount } from '../../domain/records/segmentStats.service.js'
import { livesFor } from '../../domain/versus/suddenDeath.service.js'
import { maskFill } from '../../domain/versus/progressMask.service.js'

// 自分の進捗 → 送信 payload へ変換する。
//   typed/total/mistakes … そのまま透過（表示用の素の進捗）
//   correct               … segStats から一発正解数を数える
//   lives                 … initialLives が数値のときだけ、ミス問題数から残機を算出して載せる
//   speed/elapsedMs       … #432 相手カード表示用。呼び出し側が計測した値を透過するだけ（派生計算なし）。
//                           undefined のときはキー自体を含めない（後方互換）。
//   cells                 … #437 伏せ字マスバー用。手元の実長 curLen を送信側で cap マスへ量子化して載せる
//                           （curLen 実長はワイヤに流さない）。curLen or cap 未指定＝4択相当ではキーを含めない。
//   miss                  … #437 ミス中フラグ。undefined のときはキーを含めない（後方互換）。
export function toProgressPayload({ typed, total, mistakes, segStats, currentMistakes, initialLives, speed, elapsedMs, curPos, curLen, cap, miss }) {
  const out = { typed, total, mistakes, correct: firstTryCorrectCount(segStats) }
  if (typeof initialLives === 'number') {
    out.lives = livesFor(missedItemCount(segStats, currentMistakes), initialLives)
  }
  if (speed !== undefined) out.speed = speed
  if (elapsedMs !== undefined) out.elapsedMs = elapsedMs
  if (curLen != null && cap != null) out.cells = maskFill({ curPos, curLen, cap })
  if (miss !== undefined) out.miss = miss
  return out
}
