import { it, expect } from 'vitest'

// Store（.store.js）の契約テスト用の再利用ヘルパ。#333。
// Store は「module 可変ストア＋pub/sub」＝状態を更新（mutate）すると subscribe した購読者へ通知し、
// getSnapshot は参照安定な state を返す（useSyncExternalStore の無限ループ回避＝同一状態なら同じ参照/
// プリミティブ）。同値への更新では通知しない（無駄な再描画を避ける）。#326 の Factory 等と同系のメタ契約。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数（すべて呼び出し側の Store に依存しない純関数で渡す）：
//   subscribe   … (listener) => unsubscribe   購読し、解除関数を返す。
//   getSnapshot … () => state                 参照安定な現在状態（プリミティブ or 参照）。
//   mutate      … () => void                  固定の目標値へ状態を変更する。clean 状態から呼ぶと変化＝通知、
//                                             同じ mutate をもう一度呼ぶと同値＝無通知になるよう固定値をセットする。
// 前提：各 it 開始時にストアは clean（呼び出し側 beforeEach(reset) で担保）。
export function assertStore({ subscribe, getSnapshot, mutate }) {
  it('通知：変更で通知され、同値の再変更では通知しない', () => {
    let n = 0
    const un = subscribe(() => n++)
    mutate() // clean→固定値＝変化して通知
    mutate() // 同値＝無通知（無駄な再描画回避）
    expect(n).toBe(1)
    un()
  })

  it('解除：unsubscribe すると以後の変更で通知されない', () => {
    let n = 0
    const un = subscribe(() => n++)
    un()
    mutate()
    expect(n).toBe(0)
  })

  it('参照安定：未変更なら getSnapshot は同値を返す', () => {
    expect(getSnapshot()).toBe(getSnapshot()) // 同一状態＝同じ参照/プリミティブ
  })

  it('反映と安定：変更が snapshot に反映され、変更後も参照安定', () => {
    const before = getSnapshot()
    mutate()
    const after = getSnapshot()
    expect(after).not.toBe(before) // 変更が反映される
    expect(getSnapshot()).toBe(after) // 変更後も再取得で安定
  })
}
