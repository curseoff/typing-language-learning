import { describe, it, expect } from 'vitest'
// #278 [#264 Phase5b] FSA 外部自動バックアップ＋サイトデータ消去からの復元の純ロジック(Red)。
// coder が後で Green にする src/application/persist/externalBackup.js を対象にする。
// すべて DOM/infra/FSA 非依存・副作用なし・入力非破壊の純関数。
// N世代ローテ/checksum/復元候補選定は 5a の recovery.js を再利用する（ここでは新規に書かない）。
//
// 仕様固定（曖昧点をここで1つに決める）:
// - decidePermissionAction: FSA queryPermission 結果 'granted'|'prompt'|'denied' から
//   'write'|'request'|'skip' を返す。未知/null/undefined は安全側で 'skip'。
// - 外部バックアップ名の規約: `tll-backup-<createdAt>-v<userVersion>-<checksum>.sqlite3`。
//   ・createdAt の粒度は epoch ミリ秒（date.getTime() の数値そのまま＝parse で復元しやすい）。
//   ・checksum は小文字16進の文字列（recovery.computeChecksum の出力＝[0-9a-f]+ に合わせる）。
//   ・parse は number 化（createdAt/userVersion）し checksum は文字列のまま返す。規約外は null。
//   ・build→parse の round-trip で meta が戻ることを固定。
// - toBackupEntries: ファイル名配列のうち規約に合うものだけを解析し
//   `{ name, createdAt, userVersion, checksum }` の配列にする（name は元ファイル名を保持）。
//   rotateBackups / selectRestoreCandidate（createdAt を持つ前提）へそのまま渡せる形。
import {
  decidePermissionAction,
  buildExternalBackupName,
  parseExternalBackupName,
  toBackupEntries,
} from './externalBackup.js'

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

describe('buildExternalBackupName（外部バックアップ名の生成・純関数）', () => {
  it('規約どおり tll-backup-<createdAt(epoch ms)>-v<userVersion>-<checksum>.sqlite3 を作る', () => {
    const date = new Date(1783593730000)
    const name = buildExternalBackupName(date, { userVersion: 2, checksum: '1a2b3c4d' })
    expect(name).toBe('tll-backup-1783593730000-v2-1a2b3c4d.sqlite3')
  })

  it('createdAt は date.getTime()（epoch ミリ秒）を埋める', () => {
    const date = new Date(0)
    const name = buildExternalBackupName(date, { userVersion: 5, checksum: 'deadbeef' })
    expect(name).toBe('tll-backup-0-v5-deadbeef.sqlite3')
  })

  it('userVersion と checksum を反映する', () => {
    const date = new Date(1783593730000)
    const name = buildExternalBackupName(date, { userVersion: 10, checksum: 'abcd1234' })
    expect(name).toContain('-v10-')
    expect(name).toContain('-abcd1234.sqlite3')
  })

  it('入力の meta オブジェクトを破壊しない', () => {
    const meta = { userVersion: 2, checksum: '1a2b3c4d' }
    const snapshot = { ...meta }
    buildExternalBackupName(new Date(1783593730000), meta)
    expect(meta).toEqual(snapshot)
  })
})

describe('parseExternalBackupName（外部バックアップ名の解析・純関数）', () => {
  it('規約に合う名前を { createdAt, userVersion, checksum } に解析する', () => {
    expect(parseExternalBackupName('tll-backup-1783593730000-v2-1a2b3c4d.sqlite3')).toEqual({
      createdAt: 1783593730000,
      userVersion: 2,
      checksum: '1a2b3c4d',
    })
  })

  it('createdAt と userVersion は number 化して返す', () => {
    const parsed = parseExternalBackupName('tll-backup-0-v5-deadbeef.sqlite3')
    expect(parsed.createdAt).toBe(0)
    expect(parsed.userVersion).toBe(5)
    expect(typeof parsed.createdAt).toBe('number')
    expect(typeof parsed.userVersion).toBe('number')
  })

  it('checksum は文字列のまま返す', () => {
    const parsed = parseExternalBackupName('tll-backup-1783593730000-v2-1a2b3c4d.sqlite3')
    expect(parsed.checksum).toBe('1a2b3c4d')
    expect(typeof parsed.checksum).toBe('string')
  })

  it('無関係な名前（foo.sqlite3）は null', () => {
    expect(parseExternalBackupName('foo.sqlite3')).toBe(null)
  })

  it('プレフィックスだけで各部が欠けた名前（tll-backup-.sqlite3）は null', () => {
    expect(parseExternalBackupName('tll-backup-.sqlite3')).toBe(null)
  })

  it('拡張子が違う名前（.sqlite）は null', () => {
    expect(parseExternalBackupName('tll-backup-1783593730000-v2-1a2b3c4d.sqlite')).toBe(null)
  })

  it('拡張子が違う名前（.db）は null', () => {
    expect(parseExternalBackupName('tll-backup-1783593730000-v2-1a2b3c4d.db')).toBe(null)
  })

  it('createdAt が数値でない名前は null', () => {
    expect(parseExternalBackupName('tll-backup-abc-v2-1a2b3c4d.sqlite3')).toBe(null)
  })

  it('userVersion に v プレフィックスが無い名前は null', () => {
    expect(parseExternalBackupName('tll-backup-1783593730000-2-1a2b3c4d.sqlite3')).toBe(null)
  })

  it('Phase4 の内部バックアップ名（typing-language-learning-...）は規約外で null', () => {
    expect(parseExternalBackupName('typing-language-learning-20260709-092210.sqlite3')).toBe(null)
  })

  it('build した名前を parse すると meta が戻る（round-trip）', () => {
    const date = new Date(1783593730000)
    const meta = { userVersion: 7, checksum: 'cafebabe' }
    const name = buildExternalBackupName(date, meta)
    expect(parseExternalBackupName(name)).toEqual({
      createdAt: date.getTime(),
      userVersion: 7,
      checksum: 'cafebabe',
    })
  })
})

describe('toBackupEntries（ファイル名配列→バックアップエントリ配列・純関数）', () => {
  it('規約に合う名前だけを解析し、name を保持したエントリ配列にする', () => {
    const entries = toBackupEntries([
      'tll-backup-1783593730000-v2-1a2b3c4d.sqlite3',
      'tll-backup-1783593740000-v2-abcd1234.sqlite3',
    ])
    expect(entries).toEqual([
      {
        name: 'tll-backup-1783593730000-v2-1a2b3c4d.sqlite3',
        createdAt: 1783593730000,
        userVersion: 2,
        checksum: '1a2b3c4d',
      },
      {
        name: 'tll-backup-1783593740000-v2-abcd1234.sqlite3',
        createdAt: 1783593740000,
        userVersion: 2,
        checksum: 'abcd1234',
      },
    ])
  })

  it('規約外の名前は除外する（混在→合致分のみ）', () => {
    const entries = toBackupEntries([
      'README.md',
      'tll-backup-1783593730000-v2-1a2b3c4d.sqlite3',
      'foo.sqlite3',
      'typing-language-learning-20260709-092210.sqlite3',
    ])
    expect(entries).toEqual([
      {
        name: 'tll-backup-1783593730000-v2-1a2b3c4d.sqlite3',
        createdAt: 1783593730000,
        userVersion: 2,
        checksum: '1a2b3c4d',
      },
    ])
  })

  it('空配列なら空配列を返す', () => {
    expect(toBackupEntries([])).toEqual([])
  })

  it('規約外のみなら空配列を返す', () => {
    expect(toBackupEntries(['a.txt', 'b.sqlite3', 'tll-backup-.sqlite3'])).toEqual([])
  })

  it('生成したエントリは createdAt を持ち、rotateBackups/selectRestoreCandidate へ渡せる形', () => {
    const entries = toBackupEntries([
      'tll-backup-1783593730000-v2-1a2b3c4d.sqlite3',
      'tll-backup-1783593740000-v2-abcd1234.sqlite3',
    ])
    for (const e of entries) {
      expect(typeof e.createdAt).toBe('number')
      expect(typeof e.name).toBe('string')
    }
  })

  it('入力配列を破壊しない', () => {
    const filenames = [
      'tll-backup-1783593730000-v2-1a2b3c4d.sqlite3',
      'foo.sqlite3',
    ]
    const snapshot = [...filenames]
    toBackupEntries(filenames)
    expect(filenames).toEqual(snapshot)
  })
})
