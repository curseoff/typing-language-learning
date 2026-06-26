// @vitest-environment jsdom
// 記録詳細の表示テスト。物語の新記録は「選んだ選択肢」を場面（問題ごとの記録）の
// 直後に時系列で差し込み、旧記録（choices 無し）・afterSeg 無しでも壊れない（後方互換）。
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import RecordDetail from './RecordDetail.jsx'

afterEach(cleanup)

const seg = (no, label) => ({ no, type: 'ja', label, speed: 300, mistakes: 0 })

const base = {
  source: 'story',
  mode: 'en',
  ending: 'good',
  endLabel: 'グッドエンド',
  speed: 200,
  keys: 100,
  mistakes: 1,
  accuracy: 99,
  seconds: 30,
  date: '2026/06/26',
  segStats: [seg(1, '場面1'), seg(2, '場面2'), seg(3, '場面3')],
}

const renderDetail = (record) =>
  render(
    <RecordDetail
      list={[record]}
      initial={{ record, position: 1 }}
      rankText="物語"
      modeKey="en"
      isQuiz={false}
      hasEnding
      onClose={() => {}}
    />,
  )

// 表内の行を「場面ラベル」または「選択肢ラベル」の並びとして取り出す。
const seqOf = () =>
  [...document.querySelectorAll('.seg-stats tbody tr')].map((tr) =>
    tr.classList.contains('choice-row')
      ? `選択:${tr.querySelector('.choice-ja').textContent}`
      : `場面:${tr.querySelector('.q-label').textContent.replace('途中', '')}`,
  )

describe('RecordDetail：選んだ選択肢の時系列統合', () => {
  it('独立した「選んだ選択肢」セクションは無い', () => {
    renderDetail({
      ...base,
      choices: [{ en: 'Yes.', ja: 'はい。', afterSeg: 1 }],
    })
    expect(screen.queryByText('選んだ選択肢')).toBeNull()
  })

  it('選択肢は afterSeg の場面の直後に差し込まれる', () => {
    renderDetail({
      ...base,
      choices: [
        { en: 'For sightseeing.', ja: '観光で来ました。', afterSeg: 1 },
        { en: 'Yes, please.', ja: 'はい、お願いします。', afterSeg: 2 },
      ],
    })
    expect(seqOf()).toEqual([
      '場面:場面1',
      '選択:観光で来ました。',
      '場面:場面2',
      '選択:はい、お願いします。',
      '場面:場面3',
    ])
    // en も従として描画される
    expect(document.querySelector('.choice-row .choice-en').textContent).toBe('For sightseeing.')
  })

  it('最後の場面の直後に出る選択肢（afterSeg＝場面数）も末尾に出る', () => {
    renderDetail({
      ...base,
      choices: [{ en: 'Goodbye.', ja: 'さようなら。', afterSeg: 3 }],
    })
    expect(seqOf()).toEqual([
      '場面:場面1',
      '場面:場面2',
      '場面:場面3',
      '選択:さようなら。',
    ])
  })

  it('afterSeg 無しの旧 choices は末尾にまとめて出す（後方互換・クラッシュしない）', () => {
    renderDetail({
      ...base,
      choices: [
        { en: 'A.', ja: '選択A' },
        { en: 'B.', ja: '選択B' },
      ],
    })
    expect(seqOf()).toEqual([
      '場面:場面1',
      '場面:場面2',
      '場面:場面3',
      '選択:選択A',
      '選択:選択B',
    ])
  })

  it('choices が無い旧記録には選択肢行を出さない', () => {
    renderDetail({ ...base })
    expect(document.querySelector('.choice-row')).toBeNull()
    expect(seqOf()).toEqual(['場面:場面1', '場面:場面2', '場面:場面3'])
  })

  it('choices が空配列なら選択肢行を出さない', () => {
    renderDetail({ ...base, choices: [] })
    expect(document.querySelector('.choice-row')).toBeNull()
  })
})
