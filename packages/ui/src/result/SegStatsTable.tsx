// 問題ごとの記録テーブル。入力系（速度）と4択クイズ系（正誤）の両対応。
// 4択系は「あなたの回答」を英日で併記し、正誤を色＋記号(✓/✗)で示す（#240）。
// 入力系は問題を英日ペアで示す。物語の入力系では choices（選んだ選択肢）を
// 「その選択をした場面の直後」に差し込み、場面→選択→次の場面…の1時系列で表示する。
import * as React from 'react'
import { Fragment } from 'react'

export interface SegStat {
  no: number
  label: React.ReactNode
  mistakes: number
  // 4択クイズ系
  correct?: boolean
  answer?: React.ReactNode // 正解の表示
  picked?: React.ReactNode // 選んだ選択肢の表示
  pickedEn?: React.ReactNode // 選んだ選択肢の英単語
  pickedJa?: React.ReactNode // 選んだ選択肢の和訳
  // 入力系
  type?: 'en' | 'ja'
  en?: React.ReactNode // 問題の英語
  ja?: React.ReactNode // 問題の日本語
  kana?: string // 日本語の読み（ふりがな）
  speed?: number | string
  partial?: boolean
}

export interface SegChoice {
  ja: React.ReactNode
  en?: React.ReactNode
  afterSeg?: number | null
}

export interface SegStatsTableProps {
  segStats?: SegStat[]
  choices?: SegChoice[]
}

// 表頭の凡例（記号＋文言で色に依存しない・a11y）。
function Legend() {
  return (
    <div className="seg-legend" aria-hidden="true">
      <span className="lg-item">
        <span className="lg-mark rdone">✓</span> 正解
      </span>
      <span className="lg-item">
        <span className="lg-mark rerr">✗</span> 誤答・ミス
      </span>
      <span className="lg-item">
        <span className="type-badge en">英</span>英語
      </span>
      <span className="lg-item">
        <span className="type-badge ja">和</span>日本語
      </span>
    </div>
  )
}

// 誤答時に正解を別掲する（正解時は選択=正解なので省略）。
function AnswerNote({ s }: { s: SegStat }) {
  if (s.correct || s.answer == null) return null
  return (
    <span className="picked-answer">
      正解: <span className="rdone">{s.answer}</span>
    </span>
  )
}

// 4択の「あなたの回答」セル。
// 旧記録（picked 無し）は正解なら選択=正解として answer を、誤答なら「—」＋正解別掲でフォールバック。
function PickedCell({ s }: { s: SegStat }) {
  const hasPicked = s.picked != null || s.pickedEn != null || s.pickedJa != null
  if (!hasPicked) {
    if (s.correct) {
      return s.answer != null ? (
        <span className="picked rdone">
          <span className="picked-mark">✓</span>
          <span className="picked-main">{s.answer}</span>
        </span>
      ) : (
        <span className="q-none">—</span>
      )
    }
    return (
      <span className="picked rerr">
        <span className="picked-mark">✗</span>
        <span className="q-none">—</span>
        <AnswerNote s={s} />
      </span>
    )
  }
  const mainJa = s.pickedJa ?? s.picked
  return (
    <span className={`picked ${s.correct ? 'rdone' : 'rerr'}`}>
      <span className="picked-mark">{s.correct ? '✓' : '✗'}</span>
      <span className="picked-main">{mainJa}</span>
      {s.pickedEn != null && <span className="picked-en">{s.pickedEn}</span>}
      <AnswerNote s={s} />
    </span>
  )
}

// 入力系の「問題」セル。en/ja が揃えば英日ペア、無ければ label のみ（旧記録）。
function InputLabel({ s }: { s: SegStat }) {
  if (s.en == null || s.ja == null) return <>{s.label}</>
  return (
    <span className="q-pair">
      <span className="q-en">{s.en}</span>
      <span className="q-ja">
        {s.kana ? <ruby>{s.ja}<rt>{s.kana}</rt></ruby> : s.ja}
      </span>
    </span>
  )
}

export default function SegStatsTable({ segStats, choices }: SegStatsTableProps) {
  if (!segStats || segStats.length === 0) return null
  const isQuiz = segStats[0].correct !== undefined

  if (isQuiz) {
    return (
      <div className="seg-stats">
        <h3>問題ごとの記録</h3>
        <Legend />
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>問題</th>
              <th>あなたの回答</th>
              <th>正誤</th>
              <th>ミス</th>
            </tr>
          </thead>
          <tbody>
            {segStats.map((s) => (
              <tr key={s.no} className={s.correct ? '' : 'has-miss'}>
                <td>{s.no}</td>
                <td className="q-label">{s.label}</td>
                <td className="q-picked">
                  <PickedCell s={s} />
                </td>
                <td className={s.correct ? 'ok' : 'miss'}>
                  {s.correct ? '✓ 正解' : '✗ 誤答'}
                </td>
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
  const choicesAfter = (segCount: number) =>
    list.filter((c) =>
      c.afterSeg != null ? c.afterSeg === segCount : segCount === segStats.length,
    )

  const choiceRow = (c: SegChoice, key: string) => (
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
      <Legend />
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
                  <InputLabel s={s} />
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
