import { it, expect } from 'vitest'

// Accumulator Repository（累積カウンタの永続化）の契約テスト用の再利用ヘルパ。#329。
// itemStats（問題ごとの累積記録）は RankingBoard 集約ではなく「同一キーへ加算し続ける累積カウンタ」。
// ランキング系（assertRepository）とは不変条件が異なる（上限/整列/押し出しは無く、代わりに累積合算）
// ので専用の軽量ヘルパに分ける（本人決定）。共通核＝round-trip 同値・backing 分離は概念的純度を優先して
// 一部重複実装を許容する。#329 の assertRepository と対になる。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ）。
//
// 引数（すべて呼び出し側に依存しない純関数で渡す・独立オラクル）：
//   newRepo   … () => ({ save, load })  毎回「空の backing を閉じ込めた」新アダプタ。
//               save(stat)＝1件加算。load(key)＝そのキーの累積像。it() 内で遅延呼び出しされる。
//   keyFor    … (stat) => key           stat から累積先のキーを導く。
//   sample    … (i=0) => stat           相異なる妥当 stat（値を変える）。
//   sum       … (stats) => totals       素の JS で合算した累積像（count=件数・各値の総和）の独立オラクル。
//   emptyLoad … (stored) => bool        未保存の判定（既定：null）。
export function assertAccumulatorRepository({
  newRepo,
  keyFor,
  sample,
  sum,
  emptyLoad = (stored) => stored == null,
}) {
  it('C1 未保存キーの load は空', () => {
    const repo = newRepo()
    expect(emptyLoad(repo.load(keyFor(sample())))).toBe(true)
  })

  it('C2 round-trip：1件 save で count=1 の合算像に一致', () => {
    const repo = newRepo()
    const stat = sample()
    repo.save(stat)
    expect(repo.load(keyFor(stat))).toEqual(sum([stat]))
  })

  it('C3 backing 分離：save は別アダプタの backing へ漏れない', () => {
    const a = newRepo()
    const stat = sample()
    a.save(stat)
    const b = newRepo() // 別の空 backing を閉じ込めた新アダプタ
    expect(emptyLoad(b.load(keyFor(stat)))).toBe(true)
  })

  it('A1 累積：同一キーへ2件 save すると count=2・各値が合算される', () => {
    const repo = newRepo()
    const s0 = sample(0)
    const s1 = sample(1)
    repo.save(s0)
    repo.save(s1)
    expect(repo.load(keyFor(s0))).toEqual(sum([s0, s1]))
  })
}
