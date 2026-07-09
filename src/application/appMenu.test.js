// #286 メニューバー新設 Phase1: buildTopMenuVisibility の純関数テスト。
// caps（hasHandle/supportsFsa/installable）から各メニュー項目の
// { enabled, reason } を導出する。reason は表示文言ではなく安定コード
// ('need-sqlite-primary' | 'need-fsa' | 'not-installable' | null)。
// メニュー自体は常に表示（隠さず disabled＋理由）方針なので show フラグは無し。
import { describe, it, expect } from 'vitest'
import { buildTopMenuVisibility } from './appMenu.js'

describe('buildTopMenuVisibility（トップメニューの有効/理由を導出する純関数）', () => {
  it('全 true のとき、全項目が enabled:true・reason:null になる', () => {
    const menus = buildTopMenuVisibility({ hasHandle: true, supportsFsa: true, installable: true })

    expect(menus).toEqual({
      data: {
        export: { enabled: true, reason: null },
        import: { enabled: true, reason: null },
        connectExternal: { enabled: true, reason: null },
        restoreExternal: { enabled: true, reason: null },
      },
      help: {
        about: { enabled: true, reason: null },
        install: { enabled: true, reason: null },
      },
    })
  })

  it('全 false のとき、規則どおり disabled と安定コードの reason を返す', () => {
    const menus = buildTopMenuVisibility({
      hasHandle: false,
      supportsFsa: false,
      installable: false,
    })

    expect(menus).toEqual({
      data: {
        export: { enabled: false, reason: 'need-sqlite-primary' },
        import: { enabled: false, reason: 'need-sqlite-primary' },
        // ハンドル無しが優先（need-fsa より need-sqlite-primary）
        connectExternal: { enabled: false, reason: 'need-sqlite-primary' },
        restoreExternal: { enabled: false, reason: 'need-sqlite-primary' },
      },
      help: {
        about: { enabled: true, reason: null },
        install: { enabled: false, reason: 'not-installable' },
      },
    })
  })

  it('空オブジェクト {}（欠損キー＝falsy）でも全 false と同じ結果になる', () => {
    const menus = buildTopMenuVisibility({})

    expect(menus).toEqual({
      data: {
        export: { enabled: false, reason: 'need-sqlite-primary' },
        import: { enabled: false, reason: 'need-sqlite-primary' },
        connectExternal: { enabled: false, reason: 'need-sqlite-primary' },
        restoreExternal: { enabled: false, reason: 'need-sqlite-primary' },
      },
      help: {
        about: { enabled: true, reason: null },
        install: { enabled: false, reason: 'not-installable' },
      },
    })
  })

  it('sqlite 主タブだが FSA 非対応・非インストール可のとき、export/import は有効・external は need-fsa', () => {
    const menus = buildTopMenuVisibility({
      hasHandle: true,
      supportsFsa: false,
      installable: false,
    })

    expect(menus.data.export).toEqual({ enabled: true, reason: null })
    expect(menus.data.import).toEqual({ enabled: true, reason: null })
    // ハンドルはあるので need-sqlite-primary ではなく need-fsa を出す
    expect(menus.data.connectExternal).toEqual({ enabled: false, reason: 'need-fsa' })
    expect(menus.data.restoreExternal).toEqual({ enabled: false, reason: 'need-fsa' })
    expect(menus.help.install).toEqual({ enabled: false, reason: 'not-installable' })
    expect(menus.help.about).toEqual({ enabled: true, reason: null })
  })

  it('sqlite 主タブ＋FSA 対応だが非インストール可のとき、external は有効・install のみ not-installable', () => {
    const menus = buildTopMenuVisibility({
      hasHandle: true,
      supportsFsa: true,
      installable: false,
    })

    expect(menus.data.connectExternal).toEqual({ enabled: true, reason: null })
    expect(menus.data.restoreExternal).toEqual({ enabled: true, reason: null })
    expect(menus.help.install).toEqual({ enabled: false, reason: 'not-installable' })
    expect(menus.help.about).toEqual({ enabled: true, reason: null })
  })

  it('external の理由は「ハンドル無し」を FSA 非対応より優先する（need-sqlite-primary）', () => {
    const menus = buildTopMenuVisibility({
      hasHandle: false,
      supportsFsa: false,
      installable: true,
    })

    expect(menus.data.connectExternal).toEqual({ enabled: false, reason: 'need-sqlite-primary' })
    expect(menus.data.restoreExternal).toEqual({ enabled: false, reason: 'need-sqlite-primary' })
  })

  it('about は caps に関わらず常に enabled:true・reason:null（複数入力で確認）', () => {
    const inputs = [
      { hasHandle: false, supportsFsa: false, installable: false },
      { hasHandle: true, supportsFsa: false, installable: false },
      { hasHandle: true, supportsFsa: true, installable: true },
      {},
    ]

    for (const caps of inputs) {
      expect(buildTopMenuVisibility(caps).help.about).toEqual({ enabled: true, reason: null })
    }
  })

  it('install は installable のみに依存し、他 caps では変わらない', () => {
    expect(
      buildTopMenuVisibility({ hasHandle: false, supportsFsa: false, installable: true }).help
        .install,
    ).toEqual({ enabled: true, reason: null })
    expect(
      buildTopMenuVisibility({ hasHandle: true, supportsFsa: true, installable: false }).help
        .install,
    ).toEqual({ enabled: false, reason: 'not-installable' })
  })

  it('truthy/falsy 値は boolean に正規化される（!! 相当）', () => {
    const menus = buildTopMenuVisibility({ hasHandle: 1, supportsFsa: 0, installable: '' })

    expect(menus.data.export.enabled).toBe(true)
    expect(menus.data.connectExternal.enabled).toBe(false)
    expect(menus.data.connectExternal.reason).toBe('need-fsa')
    expect(menus.help.install.enabled).toBe(false)
  })

  it('純粋：同じ引数で2回呼ぶと同一結果を返す', () => {
    const caps = { hasHandle: true, supportsFsa: false, installable: true }

    expect(buildTopMenuVisibility(caps)).toEqual(buildTopMenuVisibility(caps))
  })

  it('純粋：入力オブジェクトを破壊変更しない', () => {
    const caps = { hasHandle: true, supportsFsa: true, installable: false }

    buildTopMenuVisibility(caps)

    expect(caps).toEqual({ hasHandle: true, supportsFsa: true, installable: false })
  })
})
