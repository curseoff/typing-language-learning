// 問題ごとの記録テーブル。入力系（速度）と4択クイズ系（正誤）の両対応。
// 物語の入力系では choices（選んだ選択肢）を「その選択をした場面の直後」に差し込み、
// 場面→選択→次の場面…という1つの時系列で表示する。
import { Fragment } from 'react'

export default function SegStatsTable({ segStats, choices }) {
  if (!segStats || segStats.length === 0) return null
  const isQuiz = segStats[0].correct !== undefined

  if (isQuiz) {
    return (
      <div className="seg-stats">
        <h3>問題ごとの記録</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>問題</th>
              <th>正誤</th>
              <th>ミス</th>
            </tr>
          </thead>
          <tbody>
            {segStats.map((s) => (
              <tr key={s.no} className={s.correct ? '' : 'has-miss'}>
                <td>{s.no}</td>
                <td className="q-label">
                  {s.label}
                  {s.answer && <span className="q-answer"> → {s.answer}</span>}
                </td>
                <td className={s.correct ? 'ok' : 'miss'}>{s.correct ? '○' : '×'}</td>
                <td className={s.mistakes > 0 ? 'miss' : ''}>{s.mistakes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // 各場面の直後に差し込む選択肢を引く。afterSeg＝「この選択は何件目の場面の直後か」。
  // 旧記録（afterSeg 無し）は末尾＝全場面の後にまとめて出すフォールバック。
  const list = choices ?? []
  const choicesAfter = (segCount) =>
    list.filter((c) =>
      c.afterSeg != null ? c.afterSeg === segCount : segCount === segStats.length,
    )

  const choiceRow = (c, key) => (
    <tr key={key} className="choice-row">
      <td colSpan={5}>
        <span className="choice-tag">↳ 選択</span>
        <span className="choice-ja">{c.ja}</span>
        {c.en && <span className="choice-en">{c.en}</span>}
      </td>
    </tr>
  )

  return (
    <div className="seg-stats">
      <h3>問題ごとの記録</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>種別</th>
            <th>問題</th>
            <th>速度</th>
            <th>ミス</th>
          </tr>
        </thead>
        <tbody>
          {segStats.map((s, i) => (
            <Fragment key={s.no}>
              <tr className={s.mistakes > 0 ? 'has-miss' : ''}>
                <td>{s.no}</td>
                <td>
                  <span className={`type-badge ${s.type}`}>{s.type === 'en' ? '英' : '和'}</span>
                </td>
                <td className="q-label">
                  {s.label}
                  {s.partial && <span className="partial-tag">途中</span>}
                </td>
                <td className="speed">{s.speed} 打/分</td>
                <td className={s.mistakes > 0 ? 'miss' : ''}>{s.mistakes}</td>
              </tr>
              {choicesAfter(i + 1).map((c, j) => choiceRow(c, `c-${i}-${j}`))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
