// 記録の「もう一度チャレンジ」（同じ問題列の再挑戦）を配線するための Context。
// App が onReplay を provide し、RecordDetail が consume する。
// useRecordDetail() の呼び出し元（Ready/RecordsTable/WordsView/...）に props を増やさず配線できる。
import { createContext, useContext } from 'react'

const ReplayContext = createContext(null)

export function ReplayProvider({ onReplay, children }) {
  return <ReplayContext.Provider value={onReplay}>{children}</ReplayContext.Provider>
}

// onReplay(record) を返す（未配線なら null）。
export function useReplay() {
  return useContext(ReplayContext)
}
