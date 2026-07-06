// スタート画面の共有プリミティブ。presenter（ModeButtons/SectionLabel/BottomTabs/StartRow/selCls）は
// @tll/ui が正本＝ここは再エクスポート。content 依存のヘルパと、記録詳細に依存する WordRecords は app 側に残す。
import { WORD_LEVELS, WORD_THEMES } from '../../content/words.js'
import { useRecordDetail } from '../result/useRecordDetail.jsx'

export { selCls, ModeButtons, SectionLabel, BottomTabs, StartRow } from '@tll/ui'

export const THEME_OPTIONS = ['すべて', ...WORD_THEMES]
export const dictLevelLabel = (lv) => WORD_LEVELS.find((l) => l.level === lv)?.label ?? ''

// 単語の記録（入力=速度、4択=正解数）。行クリックで詳細。単語・英英で共用。
// 問題数制（items）・サドンデス（life）は「正解数」順のランキング＝主列を正解数に切替える（#208 段3b/5b）。
export function WordRecords({ list, isQuiz, rankText, endCondition }) {
  const rows = list || []
  const { open, modal } = useRecordDetail()
  // 主列は終了条件で切替える（items/life=正解数・endless=速度・それ以外=タイピング数）。#208 段6
  const kind = endCondition?.kind ?? 'time'
  const isItems = kind === 'items' || kind === 'life'
  const isEndless = kind === 'endless'
  const mainHead = isEndless ? '速度' : isItems ? '正解' : 'タイピング数'
  const mainSub = isEndless ? '速度' : isItems ? '正解数' : 'タイピング数'
  const mainValue = (r) => (isEndless ? (r.speed ?? 0) : isItems ? (r.correctCount ?? 0) : (r.keys ?? 0))
  return (
    <div className="records">
      <h3>
        記録ランキング<span className="records-sub">（{mainSub}順・最大15件）</span>
      </h3>
      {rows.length === 0 ? (
        <p className="no-records">まだ記録がありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>{mainHead}</th>
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
                <td className="speed">{mainValue(r)}</td>
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
