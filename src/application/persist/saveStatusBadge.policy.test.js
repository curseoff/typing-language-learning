// #399 保存状態バッジ: role/reason → バッジ表示（level/reasonCode）の写像。
// 純関数（DOM/infra/React 非依存・副作用なし・入力非破壊）。appMenu.policy と同方針で
// reasonCode は表示文言でなく安定コード（UI 側が文言へ写像する）。
// coder が後で Green にする src/application/persist/saveStatusBadge.policy.js を対象にする。
import { describe, it, expect } from 'vitest'
import { deriveSaveStatusBadge } from './saveStatusBadge.policy.js'

describe('deriveSaveStatusBadge（保存状態→バッジ写像・純関数）', () => {
  it('primary は ok / reasonCode=null（正常に保存できている）', () => {
    expect(deriveSaveStatusBadge({ role: 'primary' })).toEqual({
      level: 'ok',
      reasonCode: null,
    })
  })

  it('unknown は ok / reasonCode="starting"（起動中は警告しない）', () => {
    expect(deriveSaveStatusBadge({ role: 'unknown' })).toEqual({
      level: 'ok',
      reasonCode: 'starting',
    })
  })

  it('secondary は warn / reasonCode="secondary"', () => {
    expect(deriveSaveStatusBadge({ role: 'secondary' })).toEqual({
      level: 'warn',
      reasonCode: 'secondary',
    })
  })

  it('memory + no-opfs は warn / reasonCode="no-opfs"', () => {
    expect(deriveSaveStatusBadge({ role: 'memory', reason: 'no-opfs' })).toEqual({
      level: 'warn',
      reasonCode: 'no-opfs',
    })
  })

  it('memory + no-worker は warn / reasonCode="no-worker"', () => {
    expect(deriveSaveStatusBadge({ role: 'memory', reason: 'no-worker' })).toEqual({
      level: 'warn',
      reasonCode: 'no-worker',
    })
  })

  it('memory + no-locks は warn / reasonCode="no-locks"', () => {
    expect(deriveSaveStatusBadge({ role: 'memory', reason: 'no-locks' })).toEqual({
      level: 'warn',
      reasonCode: 'no-locks',
    })
  })

  it('memory + forced-memory は warn / reasonCode="forced-memory"', () => {
    expect(deriveSaveStatusBadge({ role: 'memory', reason: 'forced-memory' })).toEqual({
      level: 'warn',
      reasonCode: 'forced-memory',
    })
  })

  it('memory + reason:null は warn / reasonCode="not-saved"（reason 不明時フォールバック）', () => {
    expect(deriveSaveStatusBadge({ role: 'memory', reason: null })).toEqual({
      level: 'warn',
      reasonCode: 'not-saved',
    })
  })

  it('memory + reason 省略も warn / reasonCode="not-saved"（reason 不明時フォールバック）', () => {
    expect(deriveSaveStatusBadge({ role: 'memory' })).toEqual({
      level: 'warn',
      reasonCode: 'not-saved',
    })
  })

  it('未知 role は安全側 ok / reasonCode=null（警告を出さない）', () => {
    expect(deriveSaveStatusBadge({ role: '???' })).toEqual({
      level: 'ok',
      reasonCode: null,
    })
  })

  it('入力オブジェクトを破壊しない', () => {
    const state = { role: 'memory', reason: 'no-opfs' }
    deriveSaveStatusBadge(state)
    expect(state).toEqual({ role: 'memory', reason: 'no-opfs' })
  })

  it('level は必ず ok / warn のいずれか（不変条件）', () => {
    const allowed = ['ok', 'warn']
    const states = [
      { role: 'primary' },
      { role: 'unknown' },
      { role: 'secondary' },
      { role: 'memory', reason: 'no-opfs' },
      { role: 'memory', reason: 'no-worker' },
      { role: 'memory', reason: 'no-locks' },
      { role: 'memory', reason: 'forced-memory' },
      { role: 'memory', reason: null },
      { role: 'memory' },
      { role: '???' },
    ]
    for (const s of states) {
      expect(allowed).toContain(deriveSaveStatusBadge(s).level)
    }
  })
})
