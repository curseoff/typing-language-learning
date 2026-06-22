// 収録一覧（一般ユーザー向け）。文章・単語・英英辞典の問題を閲覧できる。
// 物語は分岐ストーリーのためネタバレ回避で対象外。
import { useEffect, useState } from 'react'
import { RANKS, SENTENCES } from '../../content/sentences.js'
import { WORDS, WORD_LEVELS, WORD_THEMES } from '../../content/words.js'
import { DICT } from '../../content/dictionary.js'
import { DICT_AVAILABLE_LEVELS } from '../../domain/dictionary/dictset.js'

const TYPES = [
  { key: 'marathon', label: '文章' },
  { key: 'words', label: '単語' },
  { key: 'dict', label: '英英辞典' },
]
const THEME_OPTIONS = ['すべて', ...WORD_THEMES]

export default function BrowseView({ onExit }) {
  const [type, setType] = useState('words')
  const [rank, setRank] = useState(1)
  const [level, setLevel] = useState(1)
  const [theme, setTheme] = useState('すべて')

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onExit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  let items = []
  if (type === 'marathon') items = SENTENCES.filter((s) => s.rank === rank)
  else if (type === 'words')
    items = WORDS.filter((w) => w.level === level && (theme === 'すべて' || w.theme === theme))
  else items = DICT.filter((d) => d.level === level && (theme === 'すべて' || d.theme === theme))

  const levels = type === 'dict' ? DICT_AVAILABLE_LEVELS : WORD_LEVELS.map((l) => l.level)

  return (
    <div className="browse">
      <div className="browse-head">
        <button className="story-exit" onClick={onExit}>
          ← トップ
        </button>
        <h2>収録一覧</h2>
      </div>

      <div className="mode-btns browse-filter">
        {TYPES.map((t) => (
          <button
            key={t.key}
            className={`mode-btn ${type === t.key ? 'active' : ''}`}
            onClick={() => setType(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {type === 'marathon' ? (
        <div className="mode-btns browse-filter">
          {RANKS.map((r) => (
            <button
              key={r.rank}
              className={`mode-btn ${rank === r.rank ? 'active' : ''}`}
              onClick={() => setRank(r.rank)}
            >
              R{r.rank} {r.label}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="mode-btns browse-filter">
            {levels.map((lv) => (
              <button
                key={lv}
                className={`mode-btn ${level === lv ? 'active' : ''}`}
                onClick={() => setLevel(lv)}
              >
                L{lv}
              </button>
            ))}
          </div>
          <div className="mode-btns browse-filter">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t}
                className={`mode-btn ${theme === t ? 'active' : ''}`}
                onClick={() => setTheme(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="pool-count">{items.length} 件</p>

      <ol className="browse-list">
        {items.map((it, i) => (
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
          </li>
        ))}
      </ol>
    </div>
  )
}
