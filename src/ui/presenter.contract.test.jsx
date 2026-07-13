// @vitest-environment jsdom
// 既存の Presenter（src/ui/**/*.presenter.jsx＝packages/ui の .presenter.tsx を再エクスポートする薄板）を
// 共通契約（assertPresenter）に載せるメタテスト。#339（#322 契約テストシリーズ）。
// Presenter は「props → JSX の純粋な表示部品」＝(1)純描画・(2)決定性・(3)状態/副作用なし を満たす。
// 各 presenter が「何を描くか」は当該 *.test.jsx（例：shared/Text.test.jsx）が担い、ここでは DOM を
// 再エンコードしない（同義反復回避）。#330 DomainService・#334 Adapter 契約と対になる。
//
// 対象は src/ui の presenter“表面”＝src/ui/**/*.presenter.jsx が公開する各コンポーネント。実体は
// packages/ui/src/**/*.presenter.tsx にあり src/ui は薄板 shim で再エクスポートするので、src/ui 経由で
// import すれば shim＋実体の両方を通す。hooks の静的 grep は実体（.tsx）のソースを読んで判定する。
//
// 除外（純プレゼンターではない＝この契約の対象外・所見）：状態/副作用を“正当に”内包する presenter は
// 「props→JSX の純関数」ではない。src/ui の presenter 表面では以下2つが該当し、hooks を持つ：
//   - marathon/TopFlow.presenter … useMemo（派生計算のメモ化。フック依存）
//   - shared/Flow.presenter       … useLayoutEffect/useRef（ティッカーのエディタ式スクロール＝DOM 副作用）
// これらはテストを甘くせず契約から外し、所見として報告する（adapter 契約が Worker 系を除外理由付きで
// 外すのと同じ流儀）。将来これらを純化するなら本ファイルの対象へ移す。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { assertPresenter, FORBIDDEN_HOOK } from '../test/contracts/presenter.js'

// src/ui の presenter 表面（薄板 shim 経由で実体を通す）。
import SegStatsTable from './result/SegStatsTable.presenter.jsx'
import Passage from './marathon/Passage.presenter.jsx'
import TranslateView from './marathon/TranslateView.presenter.jsx'
import OptionJa from './shared/OptionJa.presenter.jsx'
import QuizOptionLabel from './shared/QuizOptionLabel.presenter.jsx'
import AboutView from './about/AboutView.presenter.jsx'
import {
  Chars,
  RubyChars,
  RubyTyped,
  RubyText,
  MaskedRubyText,
  Typed,
  MaskedText,
  Chips,
} from './shared/Text.presenter.jsx'
import { Stat, StatsRow } from './shared/Stats.presenter.jsx'

// 実体（.tsx）ソースを読むためのリポジトリルート（このファイル＝src/ui から2つ上）。
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const src = (rel) => readFileSync(join(REPO_ROOT, 'packages/ui/src', rel), 'utf-8')

// ───────────────────────────────────────────────────────────
// shared/Text.presenter：文字描画の共有部品（複数 export＝1ファイル）
// ───────────────────────────────────────────────────────────
describe('Presenter契約: shared/Text.presenter（Chars）', () =>
  assertPresenter({
    element: () => <Chars text="cat" done={1} cursor={1} />,
    source: src('shared/Text.presenter.tsx'),
  }))

describe('Presenter契約: shared/Text.presenter（RubyChars）', () =>
  assertPresenter({
    element: () => <RubyChars ja="太陽" kana="たいよう" done={1} cursor={1} kanaDone={2} />,
  }))

describe('Presenter契約: shared/Text.presenter（RubyTyped）', () =>
  assertPresenter({
    element: () => <RubyTyped ja="太陽" kana="たいよう" done={1} kanaDone={2} hasError />,
  }))

describe('Presenter契約: shared/Text.presenter（RubyText）', () =>
  assertPresenter({ element: () => <RubyText ja="太陽" kana="たいよう" /> }))

describe('Presenter契約: shared/Text.presenter（MaskedRubyText）', () =>
  assertPresenter({ element: () => <MaskedRubyText ja="太陽" kana="たいよう" /> }))

describe('Presenter契約: shared/Text.presenter（Typed）', () =>
  assertPresenter({ element: () => <Typed text="cat" done={1} hasError /> }))

describe('Presenter契約: shared/Text.presenter（MaskedText）', () =>
  assertPresenter({ element: () => <MaskedText text="cat" pos={1} /> }))

describe('Presenter契約: shared/Text.presenter（Chips）', () =>
  assertPresenter({
    element: () => (
      <Chips
        chips={[
          { text: 'apple', i: 0 },
          { text: 'りんご', i: 1, kana: 'りんご' },
        ]}
        used={1}
        curDone={1}
        curKanaDone={1}
      />
    ),
  }))

// ───────────────────────────────────────────────────────────
// shared/Stats.presenter
// ───────────────────────────────────────────────────────────
describe('Presenter契約: shared/Stats.presenter（Stat）', () =>
  assertPresenter({
    element: () => <Stat label="速度" value={120} />,
    source: src('shared/Stats.presenter.tsx'),
  }))

describe('Presenter契約: shared/Stats.presenter（StatsRow）', () =>
  assertPresenter({
    element: () => <StatsRow stats={[{ label: '速度', value: 120 }]} progress={0.5} />,
  }))

// ───────────────────────────────────────────────────────────
// shared/OptionJa.presenter（revealed / masked / 値なし＝null の3分岐）
// ───────────────────────────────────────────────────────────
describe('Presenter契約: shared/OptionJa.presenter（revealed）', () =>
  assertPresenter({
    element: () => <OptionJa ja="りんご" kana="りんご" revealed />,
    source: src('shared/OptionJa.presenter.tsx'),
  }))

describe('Presenter契約: shared/OptionJa.presenter（masked）', () =>
  assertPresenter({ element: () => <OptionJa ja="太陽" kana="たいよう" /> }))

// ───────────────────────────────────────────────────────────
// shared/QuizOptionLabel.presenter（英語プレフィックス着色 / 和訳ルビ着色）
// ───────────────────────────────────────────────────────────
describe('Presenter契約: shared/QuizOptionLabel.presenter（en）', () =>
  assertPresenter({
    element: () => <QuizOptionLabel opt={{ display: 'apple', variants: ['apple'] }} input="ap" picked={null} />,
    source: src('shared/QuizOptionLabel.presenter.tsx'),
  }))

describe('Presenter契約: shared/QuizOptionLabel.presenter（ja ルビ）', () =>
  assertPresenter({
    element: () => (
      <QuizOptionLabel
        opt={{ display: 'りんご', variants: ['ringo'], kana: 'りんご' }}
        input="ri"
        picked={null}
        hasError
      />
    ),
  }))

// ───────────────────────────────────────────────────────────
// marathon/Passage.presenter（en 済み / ja 入力中 / future の混在）
// ───────────────────────────────────────────────────────────
describe('Presenter契約: marathon/Passage.presenter', () =>
  assertPresenter({
    element: () => (
      <Passage
        segments={[
          { type: 'en', canonical: 'cat', variants: ['cat'] },
          { type: 'ja', ja: '太陽', kana: 'たいよう', canonical: 'taiyou' },
          { type: 'en', canonical: 'dog', variants: ['dog'] },
        ]}
        segIndex={1}
        segInput="ta"
        completed={{ 0: 'cat' }}
      />
    ),
    source: src('marathon/Passage.presenter.tsx'),
  }))

// ───────────────────────────────────────────────────────────
// marathon/TranslateView.presenter（英訳：原文にルビ＋チップ＋伏せ字）
// ───────────────────────────────────────────────────────────
describe('Presenter契約: marathon/TranslateView.presenter', () =>
  assertPresenter({
    element: () => (
      <TranslateView
        segments={[
          {
            type: 'en',
            ja: 'りんご',
            en: 'apple',
            kana: 'りんご',
            canonical: 'apple',
            variants: ['apple'],
            chips: [{ text: 'apple', i: 0 }],
          },
          {
            type: 'en',
            ja: 'いぬ',
            en: 'dog',
            kana: 'いぬ',
            canonical: 'dog',
            variants: ['dog'],
            chips: [{ text: 'dog', i: 0 }],
          },
        ]}
        segIndex={0}
        segInput="ap"
      />
    ),
    source: src('marathon/TranslateView.presenter.tsx'),
  }))

// ───────────────────────────────────────────────────────────
// result/SegStatsTable.presenter（4択クイズ系 / 入力系＋選択差し込み / 空＝null の分岐）
// ───────────────────────────────────────────────────────────
describe('Presenter契約: result/SegStatsTable.presenter（quiz）', () =>
  assertPresenter({
    element: () => (
      <SegStatsTable
        segStats={[
          { no: 1, label: 'apple / りんご', mistakes: 0, correct: true, answer: 'apple', picked: 'apple' },
          { no: 2, label: 'dog / いぬ', mistakes: 1, correct: false, answer: 'dog', pickedJa: 'ねこ', pickedEn: 'cat' },
        ]}
      />
    ),
    source: src('result/SegStatsTable.presenter.tsx'),
  }))

describe('Presenter契約: result/SegStatsTable.presenter（input＋choices）', () =>
  assertPresenter({
    element: () => (
      <SegStatsTable
        segStats={[
          { no: 1, label: 'x', mistakes: 1, type: 'ja', en: 'apple', ja: '太陽', kana: 'たいよう', speed: 120 },
        ]}
        choices={[{ ja: 'はい', en: 'yes', afterSeg: 1 }]}
      />
    ),
  }))

describe('Presenter契約: result/SegStatsTable.presenter（空＝null）', () =>
  assertPresenter({ element: () => <SegStatsTable segStats={[]} /> }))

// ───────────────────────────────────────────────────────────
// about/AboutView.presenter（導線ハンドラは props・純描画）
// ───────────────────────────────────────────────────────────
describe('Presenter契約: about/AboutView.presenter', () =>
  assertPresenter({
    element: () => <AboutView onStart={() => {}} />,
    source: src('about/AboutView.presenter.tsx'),
  }))

// ───────────────────────────────────────────────────────────
// 除外の明示（所見）：純プレゼンターでない2つが hooks を持つことを固定する。
// もし将来これらを純化（hooks 除去）したら、この it が赤くなって「純プレゼンター契約へ移すべき」と気づける。
// ＝除外を“甘い黙認”にせず、逸脱の現状をテストで可視化する（テストを甘くしない）。
// ───────────────────────────────────────────────────────────
// 検出は本体ヘルパの FORBIDDEN_HOOK（＝assertPresenter が使う正規表現）に一本化する（重複を1箇所へ）。
describe('Presenter契約: 除外の明示（純プレゼンターでない＝所見）', () => {
  it('marathon/TopFlow.presenter は hooks（useMemo）を持つ＝純プレゼンター契約の対象外', () => {
    // useMemo は state/副作用ではなく（メモ化）FORBIDDEN_HOOK の対象外＝別途この専用パターンで固定する。
    expect(/\buseMemo\s*\(/.test(src('marathon/TopFlow.presenter.tsx'))).toBe(true)
  })
  it('shared/Flow.presenter は hooks（useLayoutEffect/useRef）を持つ＝純プレゼンター契約の対象外', () => {
    expect(FORBIDDEN_HOOK.test(src('shared/Flow.presenter.tsx'))).toBe(true)
  })
})

// ───────────────────────────────────────────────────────────
// FORBIDDEN_HOOK 自体の性質テスト：TS/TSX のジェネリクス呼び出し形も必ず捕捉する（#339 reviewer 指摘）。
//   `useState<number>(0)` のように use◯◯ と `(` の間にジェネリクス `<…>` が挟まる形を素通りさせない。
//   対象ファイルを増やさず、正規表現の性質だけをここで固定する。
// ───────────────────────────────────────────────────────────
describe('Presenter契約: FORBIDDEN_HOOK は TS ジェネリクス呼び出し形も捕捉する', () => {
  it.each([
    ['useState<number>(0)', 'ジェネリクス引数付き useState'],
    ['useRef<HTMLDivElement>(null)', 'ジェネリクス引数付き useRef'],
    ['useReducer<Map<string, number>>(fn, init)', 'ネストしたジェネリクス useReducer'],
    ['useState < number > (0)', 'ジェネリクスと括弧の前後に空白'],
    ['useState(0)', 'ジェネリクスなし（従来形）'],
    ['useLayoutEffect(() => {}, [])', 'ジェネリクスなし副作用フック'],
  ])('%s を hooks 使用として検出する（%s）', (sample) => {
    expect(FORBIDDEN_HOOK.test(sample)).toBe(true)
    FORBIDDEN_HOOK.lastIndex = 0 // グローバルフラグは無いが念のため（再利用時の位置持ち越し防止）。
  })

  it.each([
    ['const useStateValue = 1', 'use◯◯ を含む単なる識別子（呼び出しでない）'],
    ['xuseState(0)', '\\b 境界外（前方に語中文字が続く＝小文字 use が語中）'],
    ['useThing<number>(0)', '禁止リスト外のフック名'],
  ])('%s は誤検出しない（%s）', (sample) => {
    expect(FORBIDDEN_HOOK.test(sample)).toBe(false)
    FORBIDDEN_HOOK.lastIndex = 0
  })
})

// ───────────────────────────────────────────────────────────
// ヘルパ自己テスト：assertPresenter が「準拠するダミー presenter」を通す
//   （純描画・決定性・hooks 無しの3 it をすべて緑にできることを示す）。adapter.contract.test 末尾の流儀。
// ───────────────────────────────────────────────────────────
function FakePresenter({ label }) {
  return <span className="fake">{label}</span>
}
describe('Presenter契約ヘルパ自己テスト: 準拠するダミー presenter を通す', () =>
  assertPresenter({
    element: () => <FakePresenter label="ok" />,
    source: 'export default function FakePresenter({ label }) { return <span>{label}</span> }',
  }))
