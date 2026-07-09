// 全記録横断ビュー（#248）の container：3リポジトリ＋物語の記録を集約し、正規化して presenter に渡す。
// 並べ替えは application の sortAllRecords を props（sortFn）で注入する（presenter は application 非依存）。
// 行クリックは記録詳細（useRecordDetail/RecordDetail）を開く（#250）。open 呼び出しは container 側で組む。
import { useMemo } from 'react'
import { AllRecordsView as AllRecordsPresenter } from '@tll/ui'
import { loadRecords, loadDictRecords, loadWordRecords, loadAllStoryRecords } from '../../application/records.js'
import { flattenRecords, sortAllRecords } from '../../application/allRecords.js'
import { useRecordDetail } from '../result/useRecordDetail.jsx'

// 行→記録ランキングの見出し文字列（RecordDetail のヘッダー）。既存 RecordsTable の rankText 流儀に倣う。
// 単語/英英/文章＝種類＋レベル＋テーマ（例「単語 基礎 / 旅行」）。物語＝レベル/テーマ無しなので種類名のみ。
function rankTextOf(row) {
  if (row.kind === 'story') return row.kindLabel
  const head = row.levelLabel ? `${row.kindLabel} ${row.levelLabel}` : row.kindLabel
  return row.theme ? `${head} / ${row.theme}` : head
}

export default function AllRecordsView({ onExit }) {
  const { open, modal } = useRecordDetail()

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

  // 行クリック：その行の元記録・同ランキング配列・順位で記録詳細を開く。
  const onRowClick = (row) =>
    open(row.raw, row.position, {
      rankText: rankTextOf(row),
      modeKey: row.mode,
      isQuiz: row.raw?.correct != null, // クイズ系（英日4択）は correct を持つ
      hasEnding: row.kind === 'story',
      list: row.siblings,
    })

  return (
    <>
      <AllRecordsPresenter rows={rows} sortFn={sortAllRecords} onExit={onExit} onRowClick={onRowClick} />
      {modal}
    </>
  )
}
