// 全記録横断ビュー（#248）の container：3リポジトリ＋物語の記録を集約し、正規化して presenter に渡す。
// 並べ替えは application の sortAllRecords を props（sortFn）で注入する（presenter は application 非依存）。
import { useMemo } from 'react'
import { AllRecordsView as AllRecordsPresenter } from '@tll/ui'
import { STORIES } from '../../content/stories/index.js'
import { loadRecords, loadDictRecords, loadWordRecords, loadStoryRecords } from '../../application/records.js'
import { flattenRecords, sortAllRecords } from '../../application/allRecords.js'

export default function AllRecordsView({ onExit }) {
  // マウント時に localStorage から全記録を読む（物語は storyId ごとに配列で保存＝records マップ形へ束ねる）。
  const rows = useMemo(() => {
    const records = { ...loadRecords() }
    for (const s of STORIES) {
      const list = loadStoryRecords(s.id) // 物語記録は既に source:'story' を持つ
      if (list.length) records[`story-${s.id}`] = list
    }
    return flattenRecords({
      records,
      dictRecords: loadDictRecords(),
      wordRecords: loadWordRecords(),
    })
  }, [])

  return <AllRecordsPresenter rows={rows} sortFn={sortAllRecords} onExit={onExit} />
}
