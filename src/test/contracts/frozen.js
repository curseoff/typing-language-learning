import { expect } from 'vitest'

// deep-freeze（再帰的な不変性）を検証する共有アサーション。#383。
// KANA_TABLE のような「凍結済み定数テーブル」が、表・各行・cells 配列・各 cell まで
// すべて Object.isFrozen であることを再帰的に確認する。
// it() の外で使う純アサーション関数＝呼び出し側の it() 内から呼ぶ想定（valueObject.js の
// import 書式に倣い vitest の expect を使う）。未凍結ノードがあれば path を含めて失敗する。
//
//   value … 検証対象（プレーンオブジェクト／配列の木を再帰的にたどる）。
//   path  … 失敗メッセージ用の位置（既定 '$'＝ルート）。
export function assertFrozenDeep(value, path = '$', seen = new Set()) {
  // プリミティブや関数は凍結対象外＝葉として素通し（null/undefined 含む）。
  if (value === null || typeof value !== 'object') return
  if (seen.has(value)) return // 循環参照ガード
  seen.add(value)

  expect(Object.isFrozen(value), `${path} は Object.isFrozen であるべき`).toBe(true)

  if (Array.isArray(value)) {
    value.forEach((v, i) => assertFrozenDeep(v, `${path}[${i}]`, seen))
  } else {
    for (const key of Object.keys(value)) {
      assertFrozenDeep(value[key], `${path}.${key}`, seen)
    }
  }
}
