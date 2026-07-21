// 収録一覧（container）。presenter の正本は @tll/ui。ここは記録（loadItemStats）を読み、
// item の表示キー（dict=word / それ以外=en）→ 記録 の対応表 stats を作って presenter に渡す。
// 外部 API（items/type/mode）は従来どおり維持し、呼び出し側は無改変で通る。
import { ItemList as ItemListView } from '@tll/ui'
import { loadItemStats, itemStatIds } from '../../application/records.service.js'
import { sumItemStats } from '../../application/itemStatMerge.policy.js'

const keyOf = (type, it) => (type === 'dict' ? it.word : it.en)

export default function ItemList({ items, type, mode }) {
  const raw = loadItemStats()
  // presenter は type/mode を id 化しないので、container で item ごとに引いて表示キーへ載せ替える。
  const stats = {}
  for (const it of items) {
    const key = keyOf(type, it)
    // #450 学習統計は通常プレイと対戦で別 id に積まれている（対戦の打鍵が solo の記録を歪めないため）。
    // 収録一覧は「その問題をどれだけ打ったか」を見せる場所なので、ここでは両方を足して1つに見せる。
    // 両方とも記録が無ければ sumItemStats は undefined を返す＝従来どおり何も表示されない。
    stats[key] = sumItemStats(...itemStatIds(type, mode, key).map((id) => raw[id]))
  }
  return <ItemListView items={items} type={type} mode={mode} stats={stats} />
}
