import { it, expect } from 'vitest'

// Domain Event（.event.js）の契約テスト用の再利用ヘルパ。#327。
// Domain Event は「起きた事実」を不変の値で表す＝type を過去形で持ち、payload を注入で受け取り
// （時刻/id を内部生成しない＝決定的で純粋）、Object.freeze で後から書き換わらない。
// 事実の同定に必要な必須情報が欠ければ throw する（自己検証）。#323 の VO 契約と同系の値法則。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数（すべて呼び出し側の Event に依存しない純関数で渡す）：
//   makeEvent      … (payload) => event   イベント値ファクトリ（凍結オブジェクトを返す）。
//   samplePayload  … () => payload         妥当な payload を毎回新しく返す（参照非共有）。
//   expectedType   … string                期待する type（過去形＝/ed$/）。
//   invalidPayload … [payload, ...]        makeEvent が throw すべき不正 payload の一覧（省略時は空）。
export function assertDomainEvent({ makeEvent, samplePayload, expectedType, invalidPayload = [] }) {
  it('不変値：makeEvent の返り値は Object.freeze 済み', () => {
    expect(Object.isFrozen(makeEvent(samplePayload()))).toBe(true)
  })

  it('過去形の type：expectedType を持ち /ed$/ で終わる', () => {
    const e = makeEvent(samplePayload())
    expect(e.type).toBe(expectedType)
    expect(/ed$/.test(expectedType)).toBe(true)
  })

  it('payload は注入：キー集合が type＋payload と一致し、内部生成フィールドが無い', () => {
    const payload = samplePayload()
    const e = makeEvent(payload)
    const expectedKeys = ['type', ...Object.keys(payload)].sort()
    expect(Object.keys(e).sort()).toEqual(expectedKeys) // 余計な時刻/id を内部生成しない
    for (const k of Object.keys(payload)) {
      expect(e[k]).toBe(payload[k]) // 注入値がそのまま載る
    }
  })

  it('値的：同値の新規 payload 2つから作ったイベントは等しい', () => {
    expect(makeEvent(samplePayload())).toEqual(makeEvent(samplePayload()))
  })

  it('自己検証：必須情報が欠けた payload は makeEvent が throw', () => {
    for (const bad of invalidPayload) expect(() => makeEvent(bad)).toThrow()
  })
}
