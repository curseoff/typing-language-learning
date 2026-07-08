// 全記録横断ビュー（#248）の container：3リポジトリ＋物語の記録を集約し、正規化して presenter に渡す。
// 並べ替えは application の sortAllRecords を props（sortFn）で注入する（presenter は application 非依存）。
import { useMemo } from 'react'
import { AllRecordsView as AllRecordsPresenter } from '@tll/ui'
import { loadRecords, loadDictRecords, loadWordRecords, loadAllStoryRecords } from '../../application/records.js'
import { flattenRecords, sortAllRecords } from '../../application/allRecords.js'

export default function AllRecordsView({ onExit }) {
  // マウント時に localStorage から全記録を読む（物語は storyId・終了条件別バリアントを全て束ねる＝records マップ形へ）。
  const rows = useMemo(() => {
    const records = { ...loadRecords() }
    for (const [key, list] of Object.entries(loadAllStoryRecords())) {
      // 物語記録は既に source:'story' を持つ。キー衝突回避に接頭辞を付ける。
      records[`story-${key}`] = list
    }
    return flattenRecords({
      records,
      dictRecords: loadDictRecords(),
      wordRecords: loadWordRecords(),
    })
  }, [])

  return <AllRecordsPresenter rows={rows} sortFn={sortAllRecords} onExit={onExit} />
}
