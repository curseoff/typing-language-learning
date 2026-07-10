import { describe, it, expect } from 'vitest'
// FSA 権限状態→次アクションの純判定（#274 L-2 で application/persist/externalBackup.js から domain へ移設）。
// 'granted'→'write' / 'prompt'→'request' / それ以外（未知/null/undefined/空/非文字列）は安全側で 'skip'。
import { decidePermissionAction } from './permission.js'

describe('decidePermissionAction（FSA 権限状態→次アクションの純判定）', () => {
  it("'granted' なら 'write'（そのまま書ける）", () => {
    expect(decidePermissionAction('granted')).toBe('write')
  })

  it("'prompt' なら 'request'（requestPermission を促す）", () => {
    expect(decidePermissionAction('prompt')).toBe('request')
  })

  it("'denied' なら 'skip'（書かない）", () => {
    expect(decidePermissionAction('denied')).toBe('skip')
  })

  it("未知の文字列は安全側で 'skip'", () => {
    expect(decidePermissionAction('unknown')).toBe('skip')
  })

  it("null は安全側で 'skip'", () => {
    expect(decidePermissionAction(null)).toBe('skip')
  })

  it("undefined は安全側で 'skip'", () => {
    expect(decidePermissionAction(undefined)).toBe('skip')
  })

  it("空文字列は安全側で 'skip'", () => {
    expect(decidePermissionAction('')).toBe('skip')
  })

  it("常に 'write'|'request'|'skip' のいずれかを返す（boolean 等を返さない）", () => {
    for (const input of ['granted', 'prompt', 'denied', 'unknown', '', null, undefined, 0, {}]) {
      expect(['write', 'request', 'skip']).toContain(decidePermissionAction(input))
    }
  })
})
