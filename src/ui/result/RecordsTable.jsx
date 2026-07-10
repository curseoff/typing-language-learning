// 記録ランキングテーブル（container）。presenter の正本は @tll/ui。ここは記録詳細モーダル
// （useRecordDetail）を持ち、modeLabel（content）・MAX_RECORDS（domain）を解決して presenter へ渡す。
// 行クリックは open をそのまま onRowClick に渡す（presenter が ctx を組んで呼ぶ）。外部 API は不変。
import { RecordsTable as RecordsTableView } from '@tll/ui'
import { modeLabel } from '../../content/modes.js'
import { MAX_RECORDS } from '../../domain/records/ranking.service.js'
import { useRecordDetail } from './useRecordDetail.jsx'

export default function RecordsTable({ records, modeKey, rankText, endCondition, highlight }) {
  const { open, modal } = useRecordDetail()
  return (
    <>
      <RecordsTableView
        records={records}
        modeKey={modeKey}
        modeText={modeKey ? modeLabel(modeKey) : undefined}
        rankText={rankText}
        endCondition={endCondition}
        highlight={highlight}
        maxRecords={MAX_RECORDS}
        onRowClick={open}
      />
      {modal}
    </>
  )
}
