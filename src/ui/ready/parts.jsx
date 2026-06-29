// スタート画面の共有プリミティブ。各種類 Section から使う小さな部品・定数をまとめる。
import { WORD_LEVELS, WORD_THEMES } from '../../content/words.js'
import { useRecordDetail } from '../result/useRecordDetail.jsx'

export const THEME_OPTIONS = ['すべて', ...WORD_THEMES]
export const dictLevelLabel = (lv) => WORD_LEVELS.find((l) => l.level === lv)?.label ?? ''

// 選択状態のクラス。フォーカス行の選択＝青枠(sel-focus)、非フォーカス行の選択＝青背景(sel)。
export const selCls = (selected, focused) => (selected ? (focused ? 'sel-focus' : 'sel') : '')

export function ModeButtons({ modes, value, onChange, focused }) {
  return (
    <div className="mode-btns">
      {modes.map((m) => (
        <button
          key={m.key}
          className={`mode-btn ${selCls(value === m.key, focused)}`}
          onClick={() => onChange(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

export function SectionLabel({ children }) {
  return <div className="section-label">{children}</div>
}

// 下部の「記録ランキング / 収録一覧」切り替え
export function BottomTabs({ value, onChange, focused }) {
  return (
    <div className="bottom-tabs">
      {[
        ['records', '記録ランキング'],
        ['list', '収録一覧'],
      ].map(([k, label]) => (
        <button
          key={k}
          className={`bottom-tab ${selCls(value === k, focused)}`}
          onClick={() => onChange(k)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function StartRow({ onStart }) {
  return (
    <>
      <button className="btn-primary" onClick={onStart}>
        スタート
      </button>
      <p className="key-hint">
        <kbd>↑</kbd> <kbd>↓</kbd> 項目 / <kbd>←</kbd> <kbd>→</kbd> 選択 / <kbd>Enter</kbd> スタート
      </p>
    </>
  )
}

// 単語の記録（入力=速度、4択=正解数）。行クリックで詳細。単語・英英で共用。
export function WordRecords({ list, isQuiz, rankText }) {
  const rows = list || []
  const { open, modal } = useRecordDetail()
  return (
    <div className="records">
      <h3>
        記録ランキング<span className="records-sub">（タイピング数順・最大15件）</span>
      </h3>
      {rows.length === 0 ? (
        <p className="no-records">まだ記録がありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>タイピング数</th>
              <th>正確率</th>
              <th>時間</th>
              <th>日時</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className="row-click"
                onClick={() => open(r, i + 1, { rankText, list: rows, isQuiz })}
                title="クリックで記録の詳細"
              >
                <td>{i + 1}</td>
                <td className="speed">{r.keys ?? 0}</td>
                <td>{r.accuracy}%</td>
                <td>{r.seconds}秒</td>
                <td className="date">{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modal}
    </div>
  )
}
