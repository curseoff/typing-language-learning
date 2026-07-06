// 結果画面（container）。presenter の正本は @tll/ui。ここは records マップから recKey で該当リストを
// 引き、modeLabel を解決し、記録詳細モーダル（useRecordDetail）を用意して presenter に渡す。
// 外部 API（result/records/segStats/onRetry）は従来どおり維持し、呼び出し側は無改変で通る。
import { Result as ResultView } from '@tll/ui'
import { modeLabel } from '../../content/modes.js'
import { recKey, MAX_RECORDS } from '../../domain/records/ranking.js'
import { useRecordDetail } from './useRecordDetail.jsx'

export default function Result({ result, records, segStats, onRetry }) {
  const { open, modal } = useRecordDetail()
  const list = records[recKey(result.mode, result.rank, result.source, result.theme, result.endCondition)]
  return (
    <ResultView
      result={result}
      modeText={modeLabel(result.mode)}
      segStats={segStats}
      records={list}
      maxRecords={MAX_RECORDS}
      onRowClick={open}
      recordsModal={modal}
      onRetry={onRetry}
    />
  )
}
