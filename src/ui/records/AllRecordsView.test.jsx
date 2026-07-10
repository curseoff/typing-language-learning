// @vitest-environment jsdom
// 全記録横断ビュー container（#250）: localStorage の記録を集約して presenter に渡し、
// データ行クリックで記録詳細（RecordDetail）を開くところまでを結合で確認する。
// rankText の組み立て（種類＋レベル＋テーマ／物語は種類名のみ）と onRowClick 配線を通す。
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import AllRecordsView from './AllRecordsView.container.jsx'
import { initMemoryPersistence, saveStoryRecord } from '../../application/records.service.js'

afterEach(cleanup)
beforeEach(() => {
  localStorage.clear()
  initMemoryPersistence() // 記録メモリ像を空にリセット（facade は localStorage を読まない）
})

const wordRec = {
  source: 'word',
  level: 1,
  theme: '旅行',
  mode: 'en',
  speed: 300,
  accuracy: 95,
  mistakes: 1,
  keys: 80,
  seconds: 60,
  date: '2026/7/4 08:00:00',
  segStats: [{ en: 'sea', ja: '海', kana: 'うみ', speed: 300, mistakes: 0 }],
}

const storyRec = {
  source: 'story',
  mode: 'en',
  storyId: 'travel',
  speed: 350,
  accuracy: 99,
  mistakes: 3,
  keys: 120,
  seconds: 40,
  date: '2026/7/3 07:00:00',
  segStats: [{ no: 1, type: 'ja', label: '場面1', speed: 300, mistakes: 0 }],
}

describe('AllRecordsView container（行クリックで記録詳細）', () => {
  it('単語記録の行クリックで記録詳細が開き rankText に種類＋レベル＋テーマが出る', () => {
    // 記録メモリ像へ直接シード（キー形式は wordRecKey と同一）。
    initMemoryPersistence({ wordRecords: { 'L1__旅行__en': [wordRec] } })
    render(<AllRecordsView onExit={() => {}} />)
    // データ行（単語）をクリック。
    fireEvent.click(screen.getByText('単語'))
    // RecordDetail のヘッダーに rankText が出る（種類＋レベル＋テーマ）。
    expect(screen.getByText('単語 基礎 / 旅行')).toBeTruthy()
  })

  it('物語記録の行クリックでは rankText が種類名のみ（レベル/テーマ無し）', () => {
    // story は storyRecKey 変換が要るので facade save でシード。
    saveStoryRecord('travel', storyRec)
    render(<AllRecordsView onExit={() => {}} />)
    fireEvent.click(screen.getByText('物語'))
    // 物語はレベル/テーマ無しなので種類名のみ。RecordDetail 見出しに出る。
    const headings = screen.getAllByText('物語')
    // テーブル行の '物語' と RecordDetail 見出しの '物語' の2箇所以上に現れる。
    expect(headings.length).toBeGreaterThanOrEqual(2)
  })

  it('記録が無ければプレースホルダを出す（行クリック対象なし）', () => {
    render(<AllRecordsView onExit={() => {}} />)
    expect(screen.getByText('まだ記録がありません。')).toBeTruthy()
  })
})
