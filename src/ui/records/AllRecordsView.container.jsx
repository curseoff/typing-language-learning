// 全記録横断ビュー（#248）の container：3リポジトリ＋物語の記録を集約し、正規化して presenter に渡す。
// 並べ替えは application の sortAllRecords を props（sortFn）で注入する（presenter は application 非依存）。
// 行クリックは記録詳細を開く（#250）。#360 App 配下では openDetail（URL 同期の単一オーバーレイ）へ
// 寄せ、Provider の外（単体テスト等）ではローカルモーダル（useRecordDetail）へフォールバックする。
import { useMemo } from 'react'
import { AllRecordsView as AllRecordsPresenter } from '@tll/ui'
import { loadRecords, loadDictRecords, loadWordRecords, loadAllStoryRecords } from '../../application/records.service.js'
import { flattenRecords, sortAllRecords } from '../../application/allRecords.policy.js'
import { rowToDetailCtx } from '../../application/recordDetailRoute.policy.js'
import { useRecordDetail } from '../result/useRecordDetail.jsx'
import { useOpenDetail } from '../result/RecordDetailContext.context.jsx'

export default function AllRecordsView({ onExit }) {
  // App 配下では openDetail（URL 同期）・未配線ならローカルモーダルへフォールバック。
  const openDetail = useOpenDetail()
  const { open: localOpen, modal } = useRecordDetail()
  const open = openDetail ?? localOpen

  // マウント時に記録ストア（SQLite/OPFS のメモリ像）から全記録を読む（物語は storyId・終了条件別バリアントを全て束ねる＝records マップ形へ）。
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

  // 行クリック：その行の元記録・順位で記録詳細を開く（openDetail は record/position のみ使い ctx は
  // URL 経由で再解決・ローカルモーダルは第3引数 ctx を使う）。ctx 組み立ては純関数 rowToDetailCtx へ委譲。
  const onRowClick = (row) => open(row.raw, row.position, rowToDetailCtx(row))

  return (
    <>
      <AllRecordsPresenter rows={rows} sortFn={sortAllRecords} onExit={onExit} onRowClick={onRowClick} />
      {!openDetail && modal}
    </>
  )
}
