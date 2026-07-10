import { describe, it, expect } from 'vitest'
// #274 スライス1: sqlite 専用への転換（純関数・DOM/infra 非依存）。
// 受理値は 'sqlite' | 'memory' の 2 値。レガシー 'local' は無効値として扱う。
// 既定は 'sqlite'。非対応環境は 'memory'（非永続・メモリのみ）へ縮退する。
// coder が後で Green にする src/application/persist/backend.js を対象にする。
import { resolvePersistBackend, chooseBackend, diagnosePersistFallback } from './backend.policy.js'

describe('resolvePersistBackend（url > ls > env > 既定 sqlite の優先順・受理値は sqlite|memory）', () => {
  it('全て未指定なら既定 sqlite（空オブジェクト）', () => {
    expect(resolvePersistBackend({})).toBe('sqlite')
  })

  it('引数無しでも既定 sqlite', () => {
    expect(resolvePersistBackend()).toBe('sqlite')
  })

  it('url が有効なら url を採用する（url=memory → memory）', () => {
    expect(resolvePersistBackend({ url: 'memory' })).toBe('memory')
  })

  it('url が無効/欠損なら ls を見る（ls=sqlite → sqlite）', () => {
    expect(resolvePersistBackend({ ls: 'sqlite' })).toBe('sqlite')
  })

  it('url/ls 無しなら env を採用する（env=memory → memory）', () => {
    expect(resolvePersistBackend({ env: 'memory' })).toBe('memory')
  })

  it('大文字小文字と前後空白は無視する（url="  SQLite " → sqlite）', () => {
    expect(resolvePersistBackend({ url: '  SQLite ' })).toBe('sqlite')
  })

  it('memory も trim/小文字化して判定する（env=" MEMORY " → memory）', () => {
    expect(resolvePersistBackend({ env: ' MEMORY ' })).toBe('memory')
  })

  it('レガシー local は無効値として飛ばし既定へ落ちる（url=local → sqlite）', () => {
    expect(resolvePersistBackend({ url: 'local' })).toBe('sqlite')
  })

  it('レガシー local は大小問わず無効（url=LOCAL → sqlite）', () => {
    expect(resolvePersistBackend({ url: 'LOCAL' })).toBe('sqlite')
  })

  it('無効な段は無視して次段の有効値を採用する（url=foo, ls=memory → memory）', () => {
    expect(resolvePersistBackend({ url: 'foo', ls: 'memory' })).toBe('memory')
  })

  it('複数段が無効でも有効な段まで落ちる（url=foo, ls=bar, env=memory → memory）', () => {
    expect(resolvePersistBackend({ url: 'foo', ls: 'bar', env: 'memory' })).toBe('memory')
  })

  it('空文字は無効扱いで既定 sqlite へ落ちる（url="" → sqlite）', () => {
    expect(resolvePersistBackend({ url: '' })).toBe('sqlite')
  })

  it('非文字列（数値/オブジェクト）は無効扱いで飛ばす（url=1, ls={} → 既定 sqlite）', () => {
    expect(resolvePersistBackend({ url: 1, ls: {} })).toBe('sqlite')
  })

  it('全て null なら既定 sqlite（引数プロパティ null）', () => {
    expect(resolvePersistBackend({ url: null, ls: null, env: null })).toBe('sqlite')
  })

  it('前段が有効なら後段より優先する（url=sqlite, ls=memory → sqlite）', () => {
    expect(resolvePersistBackend({ url: 'sqlite', ls: 'memory' })).toBe('sqlite')
  })
})

describe('chooseBackend（desired と能力フラグから sqlite|memory へ縮退決定）', () => {
  const caps = { opfsOk: true, workerOk: true, locksSupported: true }

  it('desired=sqlite かつ能力が全て true なら sqlite', () => {
    expect(chooseBackend({ desired: 'sqlite', ...caps })).toBe('sqlite')
  })

  it('opfsOk=false なら memory へ縮退', () => {
    expect(chooseBackend({ desired: 'sqlite', ...caps, opfsOk: false })).toBe('memory')
  })

  it('workerOk=false なら memory へ縮退', () => {
    expect(chooseBackend({ desired: 'sqlite', ...caps, workerOk: false })).toBe('memory')
  })

  it('locksSupported=false なら memory へ縮退', () => {
    expect(chooseBackend({ desired: 'sqlite', ...caps, locksSupported: false })).toBe('memory')
  })

  it('能力フラグが undefined（欠如）なら memory へ縮退', () => {
    expect(chooseBackend({ desired: 'sqlite' })).toBe('memory')
  })

  it('desired=memory は能力が全て true でも memory', () => {
    expect(chooseBackend({ desired: 'memory', ...caps })).toBe('memory')
  })

  it('desired=memory は能力が全て false でも memory', () => {
    expect(
      chooseBackend({ desired: 'memory', opfsOk: false, workerOk: false, locksSupported: false }),
    ).toBe('memory')
  })
})

describe('diagnosePersistFallback（{ backend, reason } を返す・backend は chooseBackend と一致）', () => {
  const caps = { opfsOk: true, workerOk: true, locksSupported: true }

  it('sqlite かつ全能力 OK なら { backend: sqlite, reason: ok }', () => {
    expect(diagnosePersistFallback({ desired: 'sqlite', ...caps })).toEqual({
      backend: 'sqlite',
      reason: 'ok',
    })
  })

  it('desired=memory（明示的に非永続を要求）なら { backend: memory, reason: forced-memory }', () => {
    expect(diagnosePersistFallback({ desired: 'memory', ...caps })).toEqual({
      backend: 'memory',
      reason: 'forced-memory',
    })
  })

  it('sqlite で opfs 欠如は opfs 優先で { backend: memory, reason: no-opfs }（worker も欠けても opfs 優先）', () => {
    expect(
      diagnosePersistFallback({
        desired: 'sqlite',
        opfsOk: false,
        workerOk: false,
        locksSupported: true,
      }),
    ).toEqual({ backend: 'memory', reason: 'no-opfs' })
  })

  it('sqlite で opfs OK・worker 欠如は { backend: memory, reason: no-worker }（locks も欠けても worker 優先）', () => {
    expect(
      diagnosePersistFallback({
        desired: 'sqlite',
        opfsOk: true,
        workerOk: false,
        locksSupported: false,
      }),
    ).toEqual({ backend: 'memory', reason: 'no-worker' })
  })

  it('sqlite で locks のみ欠如は { backend: memory, reason: no-locks }', () => {
    expect(
      diagnosePersistFallback({
        desired: 'sqlite',
        opfsOk: true,
        workerOk: true,
        locksSupported: false,
      }),
    ).toEqual({ backend: 'memory', reason: 'no-locks' })
  })

  it('不変条件: 複数入力で backend は必ず chooseBackend と一致する', () => {
    const inputs = [
      { desired: 'sqlite', opfsOk: true, workerOk: true, locksSupported: true },
      { desired: 'sqlite', opfsOk: false, workerOk: true, locksSupported: true },
      { desired: 'sqlite', opfsOk: true, workerOk: false, locksSupported: true },
      { desired: 'sqlite', opfsOk: true, workerOk: true, locksSupported: false },
      { desired: 'sqlite', opfsOk: false, workerOk: false, locksSupported: false },
      { desired: 'memory', opfsOk: true, workerOk: true, locksSupported: true },
      { desired: 'memory', opfsOk: false, workerOk: false, locksSupported: false },
      { desired: 'sqlite' },
    ]
    for (const x of inputs) {
      expect(diagnosePersistFallback(x).backend).toBe(chooseBackend(x))
    }
  })
})
