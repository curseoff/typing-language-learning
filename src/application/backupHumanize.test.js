// #268 Phase5a（Phase4 持ち越しUX）: humanizeImportError の純関数テスト。
// SQLite-WASM の生エラーコードを利用者向け日本語へ丸め、既に日本語のメッセージは尊重する。
import { describe, it, expect } from 'vitest'
import { humanizeImportError } from './backup.js'

describe('humanizeImportError', () => {
  it('SQLITE_NOTADB は「SQLite のデータベースではありません」に丸める', () => {
    expect(humanizeImportError(new Error('SQLITE_NOTADB: file is not a database'))).toMatch(
      /SQLite のデータベースではありません/,
    )
  })

  it('malformed/corrupt は「ファイルが壊れている」に丸める', () => {
    expect(humanizeImportError(new Error('database disk image is malformed'))).toMatch(/壊れている/)
  })

  it('既に日本語のメッセージはそのまま尊重する', () => {
    const jp = 'このアプリのバックアップではありません（DBの構成が一致しません）'
    expect(humanizeImportError(new Error(jp))).toBe(jp)
  })

  it('未知の英語エラーは汎用の日本語にフォールバックする', () => {
    expect(humanizeImportError(new Error('some unknown english error'))).toMatch(
      /データを復元できませんでした/,
    )
  })

  it('文字列やnull/undefinedでも落ちず日本語を返す', () => {
    expect(typeof humanizeImportError('boom')).toBe('string')
    expect(typeof humanizeImportError(null)).toBe('string')
    expect(typeof humanizeImportError(undefined)).toBe('string')
  })
})
