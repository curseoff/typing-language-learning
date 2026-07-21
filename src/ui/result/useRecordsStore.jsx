// マラソン記録マップ（キー→記録配列）の保持。結果ページのランキングはこの state を読む。
// 保存（saveRecord）は更新後のマップを同期で返すので setRecords で差し替えるが、
// #451 の削除は application 側のメモリ像だけが変わり、この state は古いままになる
// （＝削除したのに下敷きの結果ページに残る）。refresh でストアから読み直して追随させる。
import { useCallback, useState } from 'react'
import { loadRecords } from '../../application/records.service.js'

export function useRecordsStore() {
  const [records, setRecords] = useState(loadRecords)
  // 削除は稀な操作なので差分反映はせず、丸ごと読み直す（確実に最新になる方を選ぶ）。
  const refresh = useCallback(() => setRecords(loadRecords()), [])
  return { records, setRecords, refresh }
}
