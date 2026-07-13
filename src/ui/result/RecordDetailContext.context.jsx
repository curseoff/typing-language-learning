// #360 記録詳細を URL と同期させるための Context。App が単一の openDetail を provide し、
// 記録行を持つ container（AllRecordsView / Result / RecordsTable）が consume する。
// openDetail(record, position) は URL を pushState し、App 所有の RecordDetail オーバーレイを開く。
// 未配線（Provider の外＝単体テスト等）では null になり、各 container はローカルモーダルへフォールバックする。
import { createContext, useContext } from 'react'

const RecordDetailContext = createContext(null)

export function RecordDetailProvider({ openDetail, children }) {
  return <RecordDetailContext.Provider value={openDetail}>{children}</RecordDetailContext.Provider>
}

// openDetail(record, position) を返す（App 配下なら関数・未配線なら null）。
export function useOpenDetail() {
  return useContext(RecordDetailContext)
}
