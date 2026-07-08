import { describe, it, expect } from 'vitest'
// #266 Phase3a: 永続化バックエンドの選択（純関数・DOM/infra 非依存）。
// coder が後で Green にする src/application/persist/backend.js を対象にする。
import { resolvePersistBackend, chooseBackend } from './backend.js'

describe('resolvePersistBackend（url > ls > env > 既定 local の優先順）', () => {
  it('url が有効なら url を採用する（url=sqlite, ls=local → sqlite）', () => {
    expect(resolvePersistBackend({ url: 'sqlite', ls: 'local' })).toBe('sqlite')
  })

  it('url が無効/欠損なら ls を見る（ls=sqlite, env=local → sqlite）', () => {
    expect(resolvePersistBackend({ ls: 'sqlite', env: 'local' })).toBe('sqlite')
  })

  it('env のみでも採用する（env=sqlite → sqlite）', () => {
    expect(resolvePersistBackend({ env: 'sqlite' })).toBe('sqlite')
  })

  it('大文字小文字は無視する（env=SQLite → sqlite）', () => {
    expect(resolvePersistBackend({ env: 'SQLite' })).toBe('sqlite')
  })

  it('前後空白は trim して判定する（url="  sqlite  " → sqlite）', () => {
    expect(resolvePersistBackend({ url: '  sqlite  ' })).toBe('sqlite')
  })

  it('無効な段は無視して次段へ落ちる（url=foo は無視して ls=local → local）', () => {
    expect(resolvePersistBackend({ url: 'foo', ls: 'local' })).toBe('local')
  })

  it('複数段が無効でも有効な段まで落ちる（url=foo, ls=bar, env=sqlite → sqlite）', () => {
    expect(resolvePersistBackend({ url: 'foo', ls: 'bar', env: 'sqlite' })).toBe('sqlite')
  })

  it('空文字は無効扱いで既定へ落ちる（url="" → local）', () => {
    expect(resolvePersistBackend({ url: '' })).toBe('local')
  })

  it('全て null なら既定 local（引数プロパティ null）', () => {
    expect(resolvePersistBackend({ url: null, ls: null, env: null })).toBe('local')
  })

  it('全て未指定でも既定 local（空オブジェクト）', () => {
    expect(resolvePersistBackend({})).toBe('local')
  })

  it('local を明示した段はそのまま local（url=LOCAL → local, 大小無視）', () => {
    expect(resolvePersistBackend({ url: 'LOCAL' })).toBe('local')
  })
})

describe('chooseBackend（desired と能力フラグから実バックエンドを縮退決定）', () => {
  const caps = { opfsOk: true, workerOk: true, locksSupported: true }

  it('desired=sqlite かつ能力が全て true なら sqlite', () => {
    expect(chooseBackend({ desired: 'sqlite', ...caps })).toBe('sqlite')
  })

  it('opfsOk=false なら local へ縮退', () => {
    expect(chooseBackend({ desired: 'sqlite', ...caps, opfsOk: false })).toBe('local')
  })

  it('workerOk=false なら local へ縮退', () => {
    expect(chooseBackend({ desired: 'sqlite', ...caps, workerOk: false })).toBe('local')
  })

  it('locksSupported=false なら local へ縮退', () => {
    expect(chooseBackend({ desired: 'sqlite', ...caps, locksSupported: false })).toBe('local')
  })

  it('desired=local は能力が全て true でも local', () => {
    expect(chooseBackend({ desired: 'local', ...caps })).toBe('local')
  })

  it('desired=local は能力が全て false でも local', () => {
    expect(
      chooseBackend({ desired: 'local', opfsOk: false, workerOk: false, locksSupported: false }),
    ).toBe('local')
  })
})
