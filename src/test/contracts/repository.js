import { it, expect } from 'vitest'

// Repository（.repository.js）の契約テスト用の再利用ヘルパ（ranking 系）。#329。
// Repository は集約/記録を「コレクションのように出し入れする永続化抽象」＝
// backing（in-memory / sqlite / mock）を差し替えても同じ契約が成立する（永続化無知）。
// このヘルパは round-trip 同値・backing 分離という共通核に加え、ranking 特有の不変条件
// （上限 MAX_RECORDS・成績順の整列・満杯時の押し出し）を常時検証する（オプションにしない）。
// #323 の VO 契約・#324 の Entity 契約・#325 の Aggregate 契約と同じ流儀。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数（すべて呼び出し側の Repository に依存しない純関数で渡す・独立オラクル）：
//   newRepo    … () => ({ save, load })  毎回「空の backing を閉じ込めた」新アダプタ。
//                save(record)＝1件永続化（RMW）。load(key)＝その key の記録配列。
//                必ず it() 内で遅延呼び出しされる（describe 収集時には呼ばない）。
//   keyFor     … (record) => key         record からグループキーを導く。
//   sample     … (i=0) => record         同一グループ内で相異なる妥当 record（スコアだけ変える）。
//   reflectsOne… (stored, record) => bool 1件保存が反映されているか（配列に構造等価で含む）。
//   isSorted   … (list) => bool          成績順に整列しているか（compareRecords 準拠の独立オラクル）。
//   cap        … number                  上限件数（= MAX_RECORDS）。
//   worse      … record                  満杯時に採用されない（全既存より悪い）最悪 record。
//   emptyLoad  … (stored) => bool         未保存/空の判定（既定：null か length 0）。
export function assertRepository({
  newRepo,
  keyFor,
  sample,
  reflectsOne,
  isSorted,
  cap,
  worse,
  emptyLoad = (stored) => stored == null || stored.length === 0,
}) {
  it('C1 未保存キーの load は空', () => {
    const repo = newRepo()
    expect(emptyLoad(repo.load(keyFor(sample())))).toBe(true)
  })

  it('C2 round-trip：save した1件が load に反映される', () => {
    const repo = newRepo()
    const record = sample()
    repo.save(record)
    const stored = repo.load(keyFor(record))
    expect(emptyLoad(stored)).toBe(false) // 空ではない
    expect(reflectsOne(stored, record)).toBe(true) // 保存した1件が構造等価で含まれる
  })

  it('C3 backing 分離：save は別アダプタの backing へ漏れない（永続化無知の核）', () => {
    const a = newRepo()
    const record = sample()
    a.save(record)
    const b = newRepo() // 別の空 backing を閉じ込めた新アダプタ
    expect(emptyLoad(b.load(keyFor(record)))).toBe(true)
  })

  it('R1 上限維持：cap+4 件 save しても load は cap 件以下', () => {
    const repo = newRepo()
    for (let i = 0; i < cap + 4; i++) repo.save(sample(i))
    expect(repo.load(keyFor(sample(0))).length).toBeLessThanOrEqual(cap)
  })

  it('R2 並び：独立比較器で成績順に整列している（repo の返り順を正解にしない）', () => {
    const repo = newRepo()
    for (let i = 0; i < cap + 4; i++) repo.save(sample(i))
    expect(isSorted(repo.load(keyFor(sample(0))))).toBe(true)
  })

  it('R3 押し出し：満杯後に最悪 record を save しても採用されない（load に含まれない）', () => {
    const repo = newRepo()
    for (let i = 0; i < cap; i++) repo.save(sample(i)) // 満杯化
    repo.save(worse)
    expect(repo.load(keyFor(worse))).not.toContainEqual(worse)
  })
}
