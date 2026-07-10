// 収録一覧（presenter）。現在の選択条件の問題を、問題ごとの記録つきで表示する。
// 記録の読み出し（loadItemStats）は container に置き、ここは props（items/type/mode/stats）で描くだけ。
// stats は「item の表示キー（dict=word / それ以外=en）→ 記録」の対応表を container が用意する。

export interface ItemStat {
  count: number
  mistakes: number
  keys: number
  ms: number
}

export interface ItemListItem {
  en?: string
  word?: string
  def?: string
  ja?: string
  freq?: number
}

export interface ItemListProps {
  items: ItemListItem[]
  type: string // 'words' | 'dict' | 'marathon'
  mode: string
  stats?: Record<string, ItemStat | undefined> // item の表示キー → 記録
}

// item の表示キー（dict は見出し語 word、それ以外は en）。stats の索引にも使う。
const keyOf = (type: string, it: ItemListItem): string =>
  (type === 'dict' ? it.word : it.en) ?? ''

export default function ItemList({ items, type, mode, stats = {} }: ItemListProps) {
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
        const s = stats[keyOf(type, it)]
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
