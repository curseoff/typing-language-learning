import { it, expect, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderHook, cleanup } from '@testing-library/react'

// Context（ui の .context.jsx）の契約テスト用の再利用ヘルパ。#340（#322 契約テストシリーズ）。
// Context は「App が上で provide した値（コールバック等）を、props バケツリレー無しで深い consumer へ配る」
// だけの薄い配線＝createContext + Provider + useContext のトリオ。責務は「値を配る」ことに限られ、
// 業務ロジック（計算・状態・ドメイン参照）を持たない。既定値は「Provider の外（未配線＝単体テスト等）でも
// consumer が壊れない」よう妥当な null 相当にする（各 container はローカルへフォールバックできる）。
// describe(...) の中から呼ぶ想定（import 専用ヘルパ＝vitest は *.test.* しか実行しないためサフィックス不要）。
//
// 引数：
//   Provider     … 値を配る Provider コンポーネント（<Provider {valueProp}={v}>{children}</Provider>）。
//   valueProp    … Provider に値を渡す prop 名（例 'onReplay' / 'openDetail'）。
//   useValue     … () => value    consumer 側の読み取りフック（useContext ラッパ）。
//   sampleValue  … Provider に provide して consumer から読み戻す標本値（参照一致で検証＝関数など）。
//   defaultValue … Provider 外での既定（既定 null）。未配線でクラッシュしない・この値になることを検証。
//   source       … 当該 .context.jsx のソース文字列（省略時は静的検査をスキップ）。
export function assertContext({ Provider, valueProp, useValue, sampleValue, defaultValue = null, source }) {
  afterEach(cleanup)

  it('供給：Provider 配下では provide した値を consumer が受け取る', () => {
    const wrapper = ({ children }) => createElement(Provider, { [valueProp]: sampleValue }, children)
    const { result } = renderHook(() => useValue(), { wrapper })
    expect(result.current).toBe(sampleValue) // バケツリレー無しで同一値が届く
  })

  it('既定値：Provider の外でも throw せず既定値を返す（未配線で壊れない）', () => {
    let result
    expect(() => {
      result = renderHook(() => useValue()).result
    }).not.toThrow()
    expect(result.current).toBe(defaultValue) // 未配線＝container はローカルへフォールバックできる
  })

  if (source !== undefined) {
    assertContextThin({ source })
  }
}

// 静的 grep で禁じる「業務ロジック」の痕跡（Context は値を配るだけ＝状態も計算もドメイン参照も持たない）。
//   状態/副作用フック … useState/useEffect/useReducer/useMemo/useCallback/useRef を持たない。
//   ドメイン/アプリ/インフラ層への import … 値の中身を Context 内で組み立てない（配るだけ）。
const DEFAULT_FORBIDDEN = [
  /\buseState\b/,
  /\buseEffect\b/,
  /\buseReducer\b/,
  /\buseMemo\b/,
  /\buseCallback\b/,
  /\buseRef\b/,
  /\buseSyncExternalStore\b/,
  /from ['"][^'"]*\/domain\//,
  /from ['"][^'"]*\/application\//,
  /from ['"][^'"]*\/infrastructure\//,
]

// 行コメント（//…）とブロックコメント（/*…*/）を除去する。grep 前に必ず通す（コメント内トークンの誤検知回避）。
// http:// のような「: の直後の //」は URL とみなしてコメント扱いしない（policy.js 契約と同じ流儀）。
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // ブロックコメント
    .replace(/([^:]|^)\/\/.*$/gm, '$1') // 行コメント（行頭 or 直前が非 : のときだけ）
}

// ファイル単位の静的「業務ロジック不在」契約。source＝当該 .context.jsx のソース文字列を1回走査する。
// createContext/useContext を実際に使っている（＝Context モジュールである）ことも併せて確かめる。
export function assertContextThin({ source, forbidden = DEFAULT_FORBIDDEN }) {
  it('業務ロジック不在：状態/副作用フックや層 import を持たず値を配るだけ（静的）', () => {
    const code = stripComments(source)
    const hits = forbidden.filter((re) => re.test(code)).map(String)
    expect(hits).toEqual([])
  })

  it('Context 実体：createContext と useContext を用いて値を配線する（静的）', () => {
    const code = stripComments(source)
    expect(/\bcreateContext\b/.test(code)).toBe(true)
    expect(/\buseContext\b/.test(code)).toBe(true)
  })
}
