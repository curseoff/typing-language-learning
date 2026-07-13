import { it, expect } from 'vitest'
import { render, cleanup } from '@testing-library/react'

// Presenter（ui の .presenter：packages/ui の .presenter.tsx を src/ui が薄板 shim で再エクスポート）
// の契約テスト用の再利用ヘルパ。#339（#322 契約テストシリーズ）。
// Presenter は「props を受け取り JSX を返すだけの純粋な表示部品」＝画面の“関数”。ここが純粋である
// ほど、見た目は props でテスト・再利用でき、状態や副作用は上位（container/フック）に隔離される。
// その核＝3つのメタ性質を、各 presenter の具体マークアップを再エンコードせずに（＝同義反復を避けて）
// 検証する（#330 DomainService 契約・#334 Adapter 契約と同じ流儀）：
//   (1) 純描画     … props から throw せず JSX を描画できる（マウントが通る）。
//   (2) 決定性     … 同じ props の再レンダは同一の DOM を生む（乱数・時刻・IO に依存しない）。
//                    Math.random/Date.now 等に依存すると2回のレンダが食い違って落ちる＝ここで捕まる。
//   (3) 状態/副作用なし … React の状態/副作用フック（useState/useEffect 等）を使わない（静的 grep）。
//                    ※ hooks 不使用は「実体のソース文字列」を grep して判定する（render では検出できない
//                       ため source を渡す。source 省略時はこの it を張らない）。
// 各 presenter の「何を描くか」は当該 presenter の *.test.jsx が担う（ここでは DOM をベタ書きしない）。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
// jsdom 環境が要る（呼び出し側テストの先頭で `// @vitest-environment jsdom` を宣言する）。
//
// 状態/副作用を“正当に”持つ presenter（内部 UI 状態やスクロール等の DOM 副作用）は「純プレゼンター」では
// ない＝この契約の対象外。呼び出し側で source を省いて (1)(2) のみ載せるか、除外理由を明記して外す
// （adapter 契約が Worker 系を除外理由付きで外すのと同じ。テストを甘くせず、逸脱は所見として報告する）。
//
// 引数：
//   element … () => ReactElement   対象 presenter に妥当な props を与えた要素を毎回新しく返す
//             （参照非共有。省略すると描画/決定性の it を張らない＝source だけの静的検査に使える）。
//   source  … string               当該 presenter の実体ソース文字列（hooks grep 用。省略可）。
// `(?:<[^(]*>)?` は TS/TSX のジェネリクス呼び出し形（`useState<number>(0)` / `useRef<Foo>()` /
// `useReducer<Map<string, number>>(...)` 等）を捕捉するための省略可能なジェネリクス部。これが無いと
// `useState` と `(` の間に `<number>` が挟まる形を素通りする（\s*\( が一致しない）ため静的保証が漏れる。
// `[^(]*` は括弧を含まない＝呼び出しの `(` まで貪欲に伸びない（ジェネリクス内に `(` は来ない前提）。
export const FORBIDDEN_HOOK =
  /\buse(State|Effect|LayoutEffect|InsertionEffect|Reducer|Ref|Context|ImperativeHandle|SyncExternalStore|Transition|DeferredValue)\s*(?:<[^(]*>)?\s*\(/

export function assertPresenter({ element, source } = {}) {
  if (element) {
    it('純描画：props から throw せず JSX を描画する', () => {
      expect(() => {
        render(element())
      }).not.toThrow()
      cleanup()
    })

    it('決定性：同じ props の再レンダで同一の DOM を生む', () => {
      const first = render(element())
      const html1 = first.container.innerHTML
      cleanup()
      const second = render(element())
      const html2 = second.container.innerHTML
      cleanup()
      expect(html2).toBe(html1)
    })
  }

  if (source != null) {
    it('状態/副作用なし：React の状態/副作用フック（useState/useEffect 等）を使わない', () => {
      const hit = source.match(FORBIDDEN_HOOK)
      // 失敗時に「どの禁止フックか」を一目で分かるよう検出トークンを載せる（純プレゼンター違反の所見）。
      expect(hit?.[0] ?? null).toBeNull()
    })
  }
}
