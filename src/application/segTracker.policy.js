// 1プレイの「問題ごとの記録」(segStats)を作る共有ヘルパ。
// 各セグメント（語/文）の最初の打鍵時刻とミス数を追い、完了時に1件積む。
// 記録に segStats として保存し、結果ページ・記録詳細で表示する。
// 1問単位の採点・指標ルールは domain の正準純関数に委譲する（#388）。
import { segmentScore, missedItemCount } from '../domain/records/segmentStats.service.js'

export const newSegTracker = () => ({ list: [], start: null, mistakes: 0 })

// セグメントの最初の打鍵時刻を記録（既に開始済みなら無視）
export function segMark(tr, t) {
  if (tr.start === null) tr.start = t
}

export function segMiss(tr) {
  tr.mistakes += 1
}

// ライフ制（life）の「ミスした問題数」。確定済み問題(list)でミス>0の件数に、
// 進行中の問題が既にミス済みなら +1（打鍵ミス総数ではなく問題単位で数える・#208 段5）。
export function segMissedItems(tr) {
  return missedItemCount(tr.list, tr.mistakes)
}

// セグメント完了（または打ち切り partial=true）で1件積む。keys=その語/文の打鍵数、t=完了時刻。
// sentenceIndex を渡すと「何文目か」を記録に残す（英英 both で文数を数えるのに使う）。
// en/ja/kana を渡すと英日ペアを透過保存する（記録詳細で問題を英日併記するため・#240）。未指定なら付与しない。
export function segPush(tr, { type, label, keys, t, partial = false, sentenceIndex, en, ja, kana }) {
  const ms = tr.start != null ? t - tr.start : 0
  tr.list.push({
    no: tr.list.length + 1,
    type,
    label,
    keys,
    mistakes: tr.mistakes,
    ...segmentScore({ keys, ms }),
    partial,
    ...(sentenceIndex != null ? { sentenceIndex } : {}),
    ...(en != null ? { en } : {}),
    ...(ja != null ? { ja } : {}),
    ...(kana != null ? { kana } : {}),
  })
  tr.start = null
  tr.mistakes = 0
}
