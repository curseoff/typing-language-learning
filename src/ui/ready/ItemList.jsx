// 収録一覧（現在の選択条件＝種類×レベル×テーマ×モードの問題を、問題ごとの記録つきで表示）。
import { loadItemStats, itemStatId } from '../../application/records.js'

// 記録は入力モードのみ（4択は対象外）。type と mode から id を作る。
const idOf = (type, mode, it) => itemStatId(type, mode, type === 'dict' ? it.word : it.en)

export default function ItemList({ items, type, mode }) {
  const stats = loadItemStats()
  const isQuiz = mode === 'quiz' || mode === 'pick' || mode.startsWith('quiz')
  // 単語は頻度順（freqが無い語は後ろ）
  const rows =
    type === 'words'
      ? [...items].sort((a, b) => (a.freq ?? Infinity) - (b.freq ?? Infinity))
      : items
  return (
    <ol className="browse-list">
      {isQuiz && <li className="browse-note">※4択モードは問題ごとの記録対象外です</li>}
      {rows.map((it, i) => {
        const s = stats[idOf(type, mode, it)]
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
