// 収録一覧（現在の選択条件の問題を、問題ごとの記録つきで表示）。
import { loadItemStats } from '../../infrastructure/itemStatsRepository.js'

const idOf = (type, it) =>
  type === 'dict' ? `d:${it.word}` : type === 'marathon' ? `s:${it.en}` : `w:${it.en}`

export default function ItemList({ items, type }) {
  const stats = loadItemStats()
  return (
    <ol className="browse-list">
      {items.map((it, i) => {
        const s = stats[idOf(type, it)]
        return (
          <li key={i} className="browse-item">
            {type === 'dict' ? (
              <>
                <span className="bi-en">{it.word}</span>
                <span className="bi-def">{it.def}</span>
                <span className="bi-ja">{it.ja}</span>
              </>
            ) : (
              <>
                <span className="bi-en">{it.en}</span>
                <span className="bi-ja">{it.ja}</span>
              </>
            )}
            <span className="bi-stat">
              {s ? (
                <>
                  練習 {s.count}回 ・ 平均ミス {(s.mistakes / s.count).toFixed(1)} ・{' '}
                  {(s.ms > 0 ? s.keys / (s.ms / 1000) : 0).toFixed(1)} 打/秒
                </>
              ) : (
                '未練習'
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
