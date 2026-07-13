import { it, expect } from 'vitest'

// packages/ui の Util（*.util.ts＝純粋な UI 設定・計算）を共通契約に載せる再利用ヘルパ。#341。
// root の src/test/contracts/domainService.js（assertDomainService）と対になる packages/ui 版で、
// Util の核＝次の3メタ性質を、各 fn の具体計算を再エンコードせずに（＝同義反復を避けて）検証する：
//   1. 決定性         … 同じ入力からは常に同じ出力（Util は乱数/クロックを持たないので入力だけで決まる）。
//   2. 非破壊         … 引数（入力）を書き換えない（読み取りのみ・副作用なし）。
//   3. 副作用importなし … source を静的に走査し、IO/DOM/クロック/乱数の参照が無いことを確かめる。
// 各 fn の「何を計算するか」は当該 util の *.test.tsx が担う（ここでは正解値をベタ書きしない）。
// describe(...) の中から呼ぶ想定の import 専用ヘルパ（vitest は *.test.* しか実行しないためサフィックス不要）。

type AnyFn = (...args: any[]) => unknown

export interface AssertUtilArgs {
  // 対象の純関数（省略時は runtime 検査（決定性・非破壊）を張らない＝定数データモジュール用）。
  fn?: AnyFn
  // 「引数タプル」の配列を毎回新しく返す（参照非共有＝非破壊検査の要）。fn を渡すなら必須。
  cases?: () => unknown[][]
  // 対象 util モジュールの生ソース文字列（静的 purity 走査に使う・必須）。
  source: string
  // 非破壊の観測像（既定：関数/undefined を落とした JSON 深クローン）。
  clone?: (value: unknown) => unknown
}

// 既定の観測像：JSON.stringify は関数/undefined を自然に落とすので深クローンにそのまま使える。
const defaultClone = (value: unknown): unknown => JSON.parse(JSON.stringify(value ?? null))

// 「副作用importなし」で失格とする参照（IO/DOM/クロック/乱数）。
// Math.max/Math.min など乱数以外の Math 呼び出しは許容＝Math\.random 等の限定一致で判定する。
const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
  ['Math.random', /\bMath\s*\.\s*random\b/],
  ['Date', /\bDate\b/],
  ['performance', /\bperformance\b/],
  ['document', /\bdocument\b/],
  ['window', /\bwindow\b/],
  ['navigator', /\bnavigator\b/],
  ['localStorage', /\blocalStorage\b/],
  ['sessionStorage', /\bsessionStorage\b/],
  ['fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['crypto.getRandomValues', /\bcrypto\s*\.\s*getRandomValues\b/],
  ['setTimeout', /\bsetTimeout\b/],
  ['setInterval', /\bsetInterval\b/],
  ['requestAnimationFrame', /\brequestAnimationFrame\b/],
  ['require(', /\brequire\s*\(/],
  ['node: import', /(?:from|import)\s*\(?\s*['"]node:/],
]

// コメント（行/ブロック）を落として「コード本体だけ」を静的走査対象にする。
// 日本語の説明文に window 等の語が出ても誤検出しないため（IO 参照はコード側にしか現れない）。
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

export function assertUtil({ fn, cases, source, clone = defaultClone }: AssertUtilArgs): void {
  if (typeof source !== 'string') {
    throw new Error('assertUtil: source（生ソース文字列）は必須です')
  }

  if (fn) {
    if (typeof cases !== 'function') {
      throw new Error('assertUtil: fn を渡すときは cases（() => 引数タプル[]）が必須です')
    }
    const makeCases = cases

    it('決定性：同じ入力から常に同じ出力を返す', () => {
      const a = makeCases()
      const b = makeCases()
      a.forEach((args, i) => {
        expect(fn(...args)).toEqual(fn(...b[i]))
      })
    })

    it('非破壊：呼び出し後も引数（入力）が変わらない（読み取りのみ）', () => {
      makeCases().forEach((args) => {
        const before = clone(args)
        fn(...args)
        expect(clone(args)).toEqual(before)
      })
    })
  }

  it('副作用importなし：source に IO/DOM/クロック/乱数の参照が無い', () => {
    const code = stripComments(source)
    const hits = FORBIDDEN.filter(([, re]) => re.test(code)).map(([label]) => label)
    expect(hits, `禁止参照を検出: ${hits.join(', ')}`).toEqual([])
  })
}
