// 1問（セグメント）単位の採点・指標ルールの正準純関数。#388
// 各フック（useMarathon/useWords/useDict/useWordQuiz/useDictQuiz）と segTracker.policy に
// 散在していた inline 式をここへ集約する（挙動不変＝各式を byte 等価に写す）。
// React/DOM/IO/クロック非依存の純関数のみ（入力を破壊しない）。

// タイピング系の一発正解数＝完了(非partial)かつミス0の問題数（mistakes 欠落は 0 扱い）。
export function firstTryCorrectCount(segStats) {
  return segStats.filter((s) => !s.partial && (s.mistakes ?? 0) === 0).length
}

// クイズ系の一発正解数＝正答(correct)かつミス0の設問数（mistakes 欠落は 0 扱い）。
export function firstTryCorrectCountQuiz(segStats) {
  return segStats.filter((s) => s.correct && (s.mistakes ?? 0) === 0).length
}

// 1問の秒数と速度。seconds は 0.1 秒丸め、speed は分あたり打鍵数（ms=0 はゼロ割回避で 0）。
export function segmentScore({ keys, ms }) {
  return {
    seconds: Math.round(ms / 100) / 10,
    speed: ms > 0 ? Math.round(keys / (ms / 60000)) : 0,
  }
}

// ライフ制の「ミスした問題数」＝確定ミス件数＋進行中ミスあり+1（問題単位・#208 段5）。
export function missedItemCount(segStats, currentMistakes) {
  return segStats.filter((s) => (s.mistakes ?? 0) > 0).length + (currentMistakes > 0 ? 1 : 0)
}

// クイズ session 単位の採点。seconds は 0.1 秒丸め、accuracy は正答率%、speed は分あたり打鍵数
// （total=0 は accuracy=0、elapsedMs=0 は speed=0＝いずれもゼロ割回避）。
export function quizScore({ keys, correct, total, elapsedMs }) {
  return {
    seconds: Math.round(elapsedMs / 100) / 10,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    speed: elapsedMs > 0 ? Math.round(keys / (elapsedMs / 60000)) : 0,
  }
}
