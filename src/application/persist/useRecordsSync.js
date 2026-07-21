// #451 記録削除への追随。各プレイのフック（useWords/useDict/useWordQuiz/useDictQuiz/useStory）は
// 自前の records state を持っているが、削除は application のメモリ像だけを書き換えるので、
// 放っておくとその state は古いまま＝消したはずの記録が下敷きの結果ページに残り続ける。
// 記録ストアの変更通知を購読し、来たら load で丸ごと読み直す。
//
// 差分反映はしない：削除は稀な操作なので、速さより「確実に最新になる」方を選ぶ。
// 5つのフックで同じ書き方に揃えるためにここへ切り出している。
import { useEffect } from 'react'
import { subscribeRecordsChanged } from '../records.service.js'

// setRecords: useState の setter（参照は安定）
// load: 自分の records を読み直す関数（モジュール関数か useCallback で安定させて渡す）
export function useRecordsSync(setRecords, load) {
  // 戻り値の解除関数をそのまま cleanup にする＝unmount 後は通知が届かない（setState 警告の防止）。
  useEffect(() => subscribeRecordsChanged(() => setRecords(load())), [setRecords, load])
}
