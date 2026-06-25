// ランキング行クリックで記録詳細モーダルを開く共有フック。
// 各テーブルで const { open, modal } = useRecordDetail() し、行 onClick で open()、末尾で {modal} を描画する。
import { useState } from 'react'
import RecordDetail from './RecordDetail.jsx'

export function useRecordDetail() {
  const [sel, setSel] = useState(null)
  const open = (record, position, ctx = {}) => setSel({ record, position, ...ctx })
  const modal = sel ? (
    <RecordDetail
      record={sel.record}
      position={sel.position}
      rankText={sel.rankText}
      modeKey={sel.modeKey}
      onClose={() => setSel(null)}
    />
  ) : null
  return { open, modal }
}
