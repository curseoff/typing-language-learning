import { describe, it, expect } from 'vitest'
// #388: 1問（セグメント）単位の採点・指標ルールの正準純関数を domain に集約する。
// 本体 src/domain/records/segmentStats.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 各式は現行フック／segTracker.policy の inline を byte 等価に写す（挙動不変が至上）。
//   firstTryCorrectCount     … useMarathon.js:100-102 / useWords.js / useDict.js（!partial && (mistakes??0)===0）
//   firstTryCorrectCountQuiz … useWordQuiz.js:92-94 / useDictQuiz.js:105-107（correct && (mistakes??0)===0）
//   segmentScore             … segTracker.policy.js:33-34 / useMarathon.js:151-152 ほか
//                              （seconds: Math.round(ms/100)/10, speed: ms>0? Math.round(keys/(ms/60000)) : 0）
//   missedItemCount          … segTracker.policy.js:17-20 / useMarathon:134-136 / useWordQuiz:132-134 / useDictQuiz:145-147
//                              （filter((mistakes??0)>0).length + (current>0?1:0)）
//   quizScore                … useWordQuiz.js:86-90 / useDictQuiz.js:99-103
//                              （seconds: Math.round(elapsedMs/100)/10,
//                                accuracy: total>0? Math.round((correct/total)*100) : 0,
//                                speed: elapsedMs>0? Math.round(keys/(elapsedMs/60000)) : 0）
import {
  firstTryCorrectCount,
  firstTryCorrectCountQuiz,
  segmentScore,
  missedItemCount,
  quizScore,
} from './segmentStats.service.js'

describe('firstTryCorrectCount（タイピング系・一発正解数＝!partial かつ mistakes0）', () => {
  it('完了(非partial)かつミス0の問題を数える', () => {
    expect(firstTryCorrectCount([{ partial: false, mistakes: 0 }])).toBe(1)
  })

  it('partial=true の問題は除外する（打ち切り記録は一発正解に数えない）', () => {
    expect(firstTryCorrectCount([{ partial: true, mistakes: 0 }])).toBe(0)
  })

  it('mistakes>0 の問題は除外する', () => {
    expect(firstTryCorrectCount([{ partial: false, mistakes: 2 }])).toBe(0)
  })

  it('mistakes 欠落は 0 扱い（?? 0）で一発正解に数える', () => {
    expect(firstTryCorrectCount([{ partial: false }])).toBe(1)
  })

  it('混在：非partial&ミス0 のみを数える', () => {
    const segStats = [
      { partial: false, mistakes: 0 }, // ○
      { partial: true, mistakes: 0 }, // × partial
      { partial: false, mistakes: 1 }, // × ミス
      { partial: false }, // ○ ミス欠落=0
    ]
    expect(firstTryCorrectCount(segStats)).toBe(2)
  })

  it('空配列は 0', () => {
    expect(firstTryCorrectCount([])).toBe(0)
  })

  it('入力 segStats を破壊しない', () => {
    const segStats = [{ partial: false, mistakes: 0 }]
    const snapshot = structuredClone(segStats)
    firstTryCorrectCount(segStats)
    expect(segStats).toEqual(snapshot)
  })
})

describe('firstTryCorrectCountQuiz（クイズ系・一発正解数＝correct かつ mistakes0）', () => {
  it('正答(correct:true)かつミス0の設問を数える', () => {
    expect(firstTryCorrectCountQuiz([{ correct: true, mistakes: 0 }])).toBe(1)
  })

  it('correct=false（誤答）は除外する', () => {
    expect(firstTryCorrectCountQuiz([{ correct: false, mistakes: 0 }])).toBe(0)
  })

  it('mistakes>0 は除外する', () => {
    expect(firstTryCorrectCountQuiz([{ correct: true, mistakes: 1 }])).toBe(0)
  })

  it('mistakes 欠落は 0 扱い（?? 0）で一発正解に数える', () => {
    expect(firstTryCorrectCountQuiz([{ correct: true }])).toBe(1)
  })

  it('混在：correct&ミス0 のみを数える', () => {
    const segStats = [
      { correct: true, mistakes: 0 }, // ○
      { correct: false, mistakes: 0 }, // × 誤答
      { correct: true, mistakes: 2 }, // × ミス
      { correct: true }, // ○ ミス欠落=0
    ]
    expect(firstTryCorrectCountQuiz(segStats)).toBe(2)
  })

  it('空配列は 0', () => {
    expect(firstTryCorrectCountQuiz([])).toBe(0)
  })

  it('入力 segStats を破壊しない', () => {
    const segStats = [{ correct: true, mistakes: 0 }]
    const snapshot = structuredClone(segStats)
    firstTryCorrectCountQuiz(segStats)
    expect(segStats).toEqual(snapshot)
  })
})

describe('segmentScore（1問の秒数と速度・segTracker.policy と byte 等価）', () => {
  it('通常値：ms=60000/keys=600 → seconds60 / speed600', () => {
    expect(segmentScore({ keys: 600, ms: 60000 })).toEqual({ seconds: 60, speed: 600 })
  })

  it('ms=0 は speed=0（ゼロ割回避）・seconds=0', () => {
    expect(segmentScore({ keys: 10, ms: 0 })).toEqual({ seconds: 0, speed: 0 })
  })

  it('seconds は 0.1 秒丸め（ms=1234 → 12.34/round12/10 = 1.2）', () => {
    // Math.round(1234/100)/10 = Math.round(12.34)/10 = 12/10 = 1.2
    expect(segmentScore({ keys: 100, ms: 1234 }).seconds).toBe(1.2)
  })

  it('seconds の丸めは 0.5 で切り上げ（ms=1250 → 12.5/round13/10 = 1.3）', () => {
    // Math.round(1250/100)/10 = Math.round(12.5)/10 = 13/10 = 1.3
    expect(segmentScore({ keys: 50, ms: 1250 }).seconds).toBe(1.3)
  })

  it('speed は keys/(ms/60000) の四捨五入（ms=1234/keys=100 → 4862）', () => {
    // Math.round(100 / (1234/60000)) = Math.round(6000000/1234) = Math.round(4862.23...) = 4862
    expect(segmentScore({ keys: 100, ms: 1234 }).speed).toBe(4862)
  })

  it('決定性：同入力→同出力', () => {
    const a = segmentScore({ keys: 300, ms: 30000 })
    const b = segmentScore({ keys: 300, ms: 30000 })
    expect(a).toEqual(b)
  })
})

describe('missedItemCount（ミスした問題数＝確定ミス件数＋進行中ミス+1）', () => {
  it('確定ミス件数＋進行中ミスあり+1', () => {
    const segStats = [
      { mistakes: 0 }, // ○ ミス無し
      { mistakes: 2 }, // × ミス有り
      { mistakes: 1 }, // × ミス有り
    ]
    expect(missedItemCount(segStats, 3)).toBe(3) // 2 + 1
  })

  it('進行中ミス0なら+0', () => {
    const segStats = [{ mistakes: 2 }, { mistakes: 0 }]
    expect(missedItemCount(segStats, 0)).toBe(1) // 1 + 0
  })

  it('mistakes 欠落は 0 扱い（?? 0）でミス問題に数えない', () => {
    const segStats = [{}, { mistakes: 1 }]
    expect(missedItemCount(segStats, 0)).toBe(1)
  })

  it('空配列＋進行中ミス0 は 0', () => {
    expect(missedItemCount([], 0)).toBe(0)
  })

  it('空配列＋進行中ミスあり は 1', () => {
    expect(missedItemCount([], 5)).toBe(1)
  })

  it('入力 segStats を破壊しない', () => {
    const segStats = [{ mistakes: 2 }]
    const snapshot = structuredClone(segStats)
    missedItemCount(segStats, 1)
    expect(segStats).toEqual(snapshot)
  })
})

describe('quizScore（クイズ session 単位・useWordQuiz/useDictQuiz と byte 等価）', () => {
  it('通常値：keys300/correct45/total50/elapsedMs60000 → seconds60 / accuracy90 / speed300', () => {
    expect(quizScore({ keys: 300, correct: 45, total: 50, elapsedMs: 60000 })).toEqual({
      seconds: 60,
      accuracy: 90,
      speed: 300,
    })
  })

  it('total=0 は accuracy=0（ゼロ割回避）', () => {
    expect(quizScore({ keys: 10, correct: 0, total: 0, elapsedMs: 60000 }).accuracy).toBe(0)
  })

  it('elapsedMs=0 は speed=0（ゼロ割回避）・seconds=0', () => {
    const s = quizScore({ keys: 10, correct: 3, total: 5, elapsedMs: 0 })
    expect(s.speed).toBe(0)
    expect(s.seconds).toBe(0)
  })

  it('accuracy は correct/total の百分率の四捨五入（correct1/total3 → 33）', () => {
    // Math.round((1/3)*100) = Math.round(33.33...) = 33
    expect(quizScore({ keys: 5, correct: 1, total: 3, elapsedMs: 60000 }).accuracy).toBe(33)
  })

  it('speed は keys/(elapsedMs/60000) の四捨五入（keys90/elapsedMs60000 → 90）', () => {
    expect(quizScore({ keys: 90, correct: 5, total: 5, elapsedMs: 60000 }).speed).toBe(90)
  })

  it('決定性：同入力→同出力', () => {
    const args = { keys: 120, correct: 8, total: 10, elapsedMs: 45000 }
    expect(quizScore(args)).toEqual(quizScore({ ...args }))
  })
})
