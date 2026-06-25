// ランキング行クリックで記録の結果ページ（全画面）を開く共有フック。
// 各テーブルで const { open, modal } = useRecordDetail() し、行 onClick で
// open(record, position, { rankText, modeKey, list, isQuiz, hasEnding }) を呼び、末尾で {modal} を描画する。
import { useState } from 'react'
import RecordDetail from './RecordDetail.jsx'

export function useRecordDetail() {
  const [sel, setSel] = useState(null)
  const open = (record, position, ctx = {}) => setSel({ record, position, ...ctx })
  const modal = sel ? (
    <RecordDetail
      list={sel.list && sel.list.length ? sel.list : [sel.record]}
      initial={{ record: sel.record, position: sel.position }}
      rankText={sel.rankText}
      modeKey={sel.modeKey}
      isQuiz={sel.isQuiz}
      hasEnding={sel.hasEnding}
      onClose={() => setSel(null)}
    />
  ) : null
  return { open, modal }
}
