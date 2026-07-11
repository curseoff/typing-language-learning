import { it, expect } from 'vitest'

// Application Service（.service.js のうち「ユースケースの薄い調停層」）の契約テスト用の再利用ヘルパ。#331。
// Application Service の核＝「薄い調停」：業務ルール（判定・計算・整列・上限）を自分で持たず、
//   Domain Service / Repository / Domain Event へ決められた順序で委譲し、その結果をそのまま返す。
//   依存（repository / bus 等）は注入で受け取り、in-memory の stub だけでユースケースが完結する
//   （グローバル状態・外部 I/O に依存しない＝毎回新しい注入 deps で決定的に動く）。
// #326 の Factory 契約・#327 の Domain Event 契約と同系の「対象非依存の共通契約」。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数（すべて呼び出し側の usecase に依存しない純関数で渡す）：
//   makeDeps          … () => deps   毎回新しい in-memory 注入依存を返す（recording bus / stub repository 等）。
//                       bus は publish された event を観測できるよう配列に貯める想定。
//   invoke            … (deps) => output   ユースケースを注入 deps で実行し出力（{record,key,board,...}）を返す。
//   oracles           … (deps) => 期待値マップ  委譲先を「独立に」再計算した期待値（record/key）。
//                       usecase 内部を呼ばず、Domain Service/Domain を素に呼んで作る（写経しない）。
//   expectedEventTypes … string[]   publish されるべき event type（順序どおり）。
//   makeDepsB         … () => deps（省略可）   makeDeps と別の番兵 board を返す repository を持つ deps。
//                       注入差し替えで board が注入先に追随することを見るための対比 deps。
// deps 形状の規約：deps.bus.published（発行イベント配列）／deps.repository.submitted（submit 記録配列）／
//   deps.board（その deps の repository.submitRecord が返す番兵 board）。
export function assertApplicationService({
  makeDeps,
  invoke,
  oracles,
  expectedEventTypes,
  makeDepsB,
}) {
  it('独自計算をしない：出力の record/key は委譲先を独立再計算した値と一致する', () => {
    const deps = makeDeps()
    const out = invoke(deps)
    const exp = oracles(deps)
    // usecase 内部の計算順序を写経せず、Domain Service/Domain を素に呼んだ結果と突き合わせる。
    expect(out.record).toEqual(exp.record)
    expect(out.key).toEqual(exp.key)
  })

  it('委譲：board は注入した repository.submitRecord の返り値をそのまま素通しする', () => {
    const deps = makeDeps()
    const out = invoke(deps)
    // stub repository が返す番兵 board を、usecase が加工せずそのまま返す（同一参照）。
    expect(out.board).toBe(boardOf(deps))
    // repository へは委譲値（key・record）が渡っている。
    const submitted = submittedOf(deps)
    expect(submitted.length).toBe(1)
    expect(submitted[0].key).toEqual(out.key)
    expect(submitted[0].record).toBe(out.record)
  })

  it('委譲：Domain Event を expectedEventTypes の順序で publish し、payload に委譲値が載る', () => {
    const deps = makeDeps()
    const out = invoke(deps)
    const published = publishedOf(deps)
    expect(published.map((e) => e.type)).toEqual(expectedEventTypes)
    // publish された各イベントの record が委譲値（同一 record 参照）を運ぶ。
    for (const e of published) {
      expect(e.record).toBe(out.record)
    }
    // key を運ぶイベント（RecordAchieved 等）には out.key が載る。
    const keyed = published.find((e) => 'key' in e)
    if (keyed) expect(keyed.key).toEqual(out.key)
  })

  it('依存注入で動く：makeDeps は毎回新規で、実行後に前回 deps を汚さない（in-memory 完結）', () => {
    const a = makeDeps()
    const b = makeDeps()
    invoke(a)
    // 別インスタンス b は a の実行に影響されない＝グローバル状態非依存。
    expect(publishedOf(b).length).toBe(0)
    expect(submittedOf(b).length).toBe(0)
  })

  it('依存注入で動く：repository の返り値を差し替えると board が追随する（独自計算せず注入先に委ねる）', () => {
    if (!makeDepsB) return
    const depsB = makeDepsB()
    const outB = invoke(depsB)
    // 別 deps の repository が返す別番兵 board に、出力の board が追随する。
    expect(outB.board).toBe(boardOf(depsB))
    // 元 makeDeps の番兵とは異なる（差し替えが効いている証明）。
    expect(outB.board).not.toBe(boardOf(makeDeps()))
  })
}

// deps から観測用の配列/番兵を取り出す小道具（呼び出し側の deps 形状に合わせた既定アクセサ）。
// deps.bus.published / deps.repository.submitted / deps.board を既定に使う。
function publishedOf(deps) {
  return deps.bus.published
}
function submittedOf(deps) {
  return deps.repository.submitted
}
function boardOf(deps) {
  return deps.board
}
