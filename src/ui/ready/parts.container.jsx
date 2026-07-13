// スタート画面の共有プリミティブ。presenter（ModeButtons/SectionLabel/BottomTabs/StartRow/selCls）は
// @tll/ui が正本＝ここは再エクスポート。content 依存のヘルパと、記録詳細に依存する WordRecords は app 側に残す。
import { WORD_LEVELS, WORD_THEMES } from '../../content/words.js'
import { rangeCount, rangeLabel } from '../../domain/words/wordRange.service.js'
import { useRecordDetail } from '../result/useRecordDetail.jsx'
import { useOpenDetail } from '../result/RecordDetailContext.context.jsx'

export { selCls, ModeButtons, SectionLabel, BottomTabs, StartRow } from '@tll/ui'

export const THEME_OPTIONS = ['すべて', ...WORD_THEMES]
export const dictLevelLabel = (lv) => WORD_LEVELS.find((l) => l.level === lv)?.label ?? ''

// #362/#364 固定範囲セレクタ（数値ステッパー）。単語/英英/単語例文の3セクションで共有する。
// 範囲数が最大152（単語 L4/すべて）になり得るのでドロップダウンやボタン羅列でなく
// ◀ ラベル(n/総数) ▶ のステッパーにする（本人決定・毎回同じ範囲）。状態は null=範囲指定なし
// （従来の全体ランダム）/ 1..count。最左（1 の手前）が「範囲指定なし」。total=収録数・unit は表示単位
// （単語/英英=語・単語例文=文）。
export function RangeStepper({ total, range, onChange, unit = '語' }) {
  const count = rangeCount(total)
  const idx = range ?? 0 // 0=範囲指定なし
  const atStart = idx <= 0
  const atEnd = idx >= count
  const dec = () => onChange(idx <= 1 ? null : idx - 1) // 1→なし、なしで止まる
  const inc = () => onChange(idx >= count ? (count >= 1 ? count : null) : idx + 1) // なし→1、末尾で止まる
  const label = range == null ? '範囲指定なし（全体）' : `${rangeLabel(range, 100, total)} ${unit}`
  const position = range == null ? `— / ${count}` : `${range} / ${count}`
  return (
    <>
      <div className="section-label">範囲（毎回同じ順で復習）</div>
      <div className="range-stepper">
        <button
          className="range-step-btn"
          onClick={dec}
          disabled={atStart}
          aria-label="前の範囲"
        >
          ◀
        </button>
        <div className="range-current">
          <span className="range-label">{label}</span>
          <span className="range-pos">{position}</span>
        </div>
        <button
          className="range-step-btn"
          onClick={inc}
          disabled={atEnd || count === 0}
          aria-label="次の範囲"
        >
          ▶
        </button>
      </div>
    </>
  )
}

// 単語の記録（入力=速度、4択=正解数）。行クリックで詳細。単語・英英で共用。
// 問題数制（items）・サドンデス（life）は「正解数」順のランキング＝主列を正解数に切替える（#208 段3b/5b）。
export function WordRecords({ list, isQuiz, rankText, endCondition }) {
  const rows = list || []
  // #360 App 配下では openDetail（URL 同期の単一オーバーレイ）・未配線ならローカルモーダルへ。
  const openDetail = useOpenDetail()
  const { open: localOpen, modal } = useRecordDetail()
  const open = openDetail ?? localOpen
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
        記録ランキング
        {rankText && <span className="records-mode">{rankText}</span>}
        <span className="records-sub">（{mainSub}順・最大15件）</span>
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
      {!openDetail && modal}
    </div>
  )
}
