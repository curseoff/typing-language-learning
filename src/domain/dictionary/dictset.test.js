import { describe, it, expect } from 'vitest'
import {
  buildDictSet,
  levelEntries,
  makeDictQuiz,
  makeDictPick,
} from './dictset.service.js'
import { DICT_AVAILABLE_LEVELS, loadDict } from '../../content/dictionary.js'
import { mulberry32 } from '../rng.service.js'

const DICT = await loadDict()

describe('buildDictSet', () => {
  it('指定数のエントリを返す（不足は循環）', () => {
    const lv = DICT_AVAILABLE_LEVELS[0]
    expect(buildDictSet(DICT, lv, 'すべて', 12).length).toBe(12)
  })
})

describe('rng 注入（決定的）', () => {
  const lv = DICT_AVAILABLE_LEVELS[0]

  it('buildDictSet は同じ seed の rng で同じ並びを返す', () => {
    const a = buildDictSet(DICT, lv, 'すべて', 12, { rng: mulberry32(11) })
    const b = buildDictSet(DICT, lv, 'すべて', 12, { rng: mulberry32(11) })
    expect(a.map((e) => e.word)).toEqual(b.map((e) => e.word))
  })

  it('buildDictSet は seed が違えば並びが変わる', () => {
    const a = buildDictSet(DICT, lv, 'すべて', 12, { rng: mulberry32(1) })
    const b = buildDictSet(DICT, lv, 'すべて', 12, { rng: mulberry32(2) })
    expect(a.map((e) => e.word)).not.toEqual(b.map((e) => e.word))
  })

  it('makeDictQuiz は同じ seed の rng で同じ選択肢列を返す', () => {
    const set = buildDictSet(DICT, lv, 'すべて', 10, { rng: mulberry32(3) })
    const a = makeDictQuiz(set, levelEntries(DICT, lv), 10, 4, { rng: mulberry32(7) })
    const b = makeDictQuiz(set, levelEntries(DICT, lv), 10, 4, { rng: mulberry32(7) })
    expect(a.map((q) => q.options.map((o) => o.display))).toEqual(
      b.map((q) => q.options.map((o) => o.display)),
    )
  })

  it('makeDictPick は同じ seed の rng で同じ選択肢列を返す', () => {
    const set = buildDictSet(DICT, lv, 'すべて', 10, { rng: mulberry32(3) })
    const a = makeDictPick(set, levelEntries(DICT, lv), 10, 4, { rng: mulberry32(7) })
    const b = makeDictPick(set, levelEntries(DICT, lv), 10, 4, { rng: mulberry32(7) })
    expect(a.map((q) => q.options.map((o) => o.display))).toEqual(
      b.map((q) => q.options.map((o) => o.display)),
    )
  })
})

describe('makeDictPick の各 option は和訳(ja)と読み(kana)を持つ（#216）', () => {
  // def が互いに前方一致しないダミー辞書（誤答同士の衝突回避を素通しさせる）。
  const DUMMY = [
    { word: 'apple', def: 'a red fruit', ja: 'りんご', kana: 'りんご', level: 1, theme: '日常' },
    { word: 'banana', def: 'yellow long fruit', ja: 'ばなな', kana: 'ばなな', level: 1, theme: '日常' },
    { word: 'cat', def: 'small pet animal', ja: 'ねこ', kana: 'ねこ', level: 1, theme: '日常' },
    { word: 'dog', def: 'loyal companion here', ja: 'いぬ', kana: 'いぬ', level: 1, theme: '日常' },
    { word: 'egg', def: 'oval food from hen', ja: 'たまご', kana: 'たまご', level: 1, theme: '日常' },
  ]
  const byDef = Object.fromEntries(DUMMY.map((d) => [d.def, d]))

  it('各 option の ja/kana が「その option の元エントリ」の値と一致する', () => {
    const items = makeDictPick(DUMMY, DUMMY, 5, 4, { rng: mulberry32(42) })
    expect(items.length).toBe(5)
    for (const q of items) {
      expect(q.options.length).toBe(4)
      for (const o of q.options) {
        const src = byDef[o.display] // display=def から元エントリを引く
        expect(src).toBeDefined()
        // 誤答は正解の和訳を流用せず、自分自身の和訳/読みを持つ。
        expect(o.ja).toBe(src.ja)
        expect(o.kana).toBe(src.kana)
      }
    }
  })

  it('正解 option の ja/kana は正解エントリ(e)の ja/kana に一致する', () => {
    const items = makeDictPick(DUMMY, DUMMY, 5, 4, { rng: mulberry32(42) })
    for (const q of items) {
      const answer = q.options.find((o) => o.answer)
      const e = DUMMY.find((d) => d.word === q.prompt) // prompt=word
      expect(answer.ja).toBe(e.ja)
      expect(answer.kana).toBe(e.kana)
    }
  })

  it('既存フィールド（display/variants/answer）と問題形は不変', () => {
    const items = makeDictPick(DUMMY, DUMMY, 5, 4, { rng: mulberry32(42) })
    for (const q of items) {
      const e = DUMMY.find((d) => d.word === q.prompt)
      expect(q.prompt).toBe(e.word)
      expect(q.ja).toBe(e.ja)
      expect(q.answerDisplay).toBe(e.def)
      expect(q.options.filter((o) => o.answer).length).toBe(1)
      for (const o of q.options) {
        expect(typeof o.display).toBe('string')
        expect(o.variants).toEqual([o.display])
      }
    }
  })
})

describe('makeDictQuiz の各 option は英単語(en)/和訳(ja)/読み(kana)を持つ（#240）', () => {
  // word が互いに前方一致しないダミー辞書（誤答同士の衝突回避を素通しさせる）。
  const DUMMY = [
    { word: 'apple', def: 'a red fruit here', ja: 'りんご', kana: 'りんご', level: 1, theme: '日常' },
    { word: 'banana', def: 'yellow long', ja: 'ばなな', kana: 'ばなな', level: 1, theme: '日常' },
    { word: 'cat', def: 'small pet', ja: 'ねこ', kana: 'ねこ', level: 1, theme: '日常' },
    { word: 'dog', def: 'loyal one', ja: 'いぬ', kana: 'いぬ', level: 1, theme: '日常' },
    { word: 'egg', def: 'oval food', ja: 'たまご', kana: 'たまご', level: 1, theme: '日常' },
  ]
  const byWord = Object.fromEntries(DUMMY.map((d) => [d.word, d]))

  it('各 option の en/ja/kana が「その option の元エントリ」の値と一致する', () => {
    const items = makeDictQuiz(DUMMY, DUMMY, 5, 4, { rng: mulberry32(42) })
    expect(items.length).toBe(5)
    for (const q of items) {
      for (const o of q.options) {
        const src = byWord[o.display] // display=word から元エントリを引く
        expect(src).toBeDefined()
        expect(o.en).toBe(src.word)
        expect(o.ja).toBe(src.ja)
        expect(o.kana).toBe(src.kana)
      }
    }
  })
})

describe('pool のフォールバック（レベル×テーマで絞れないとき）', () => {
  // level1・theme=日常 のみのミニ辞書。フォールバック分岐をピンポイントで踏む。
  const MINI = [
    { word: 'apple', def: 'a red round fruit here', ja: 'りんご', kana: 'りんご', level: 1, theme: '日常' },
  ]

  it('レベルは在るがテーマが空なら同レベル全体へフォールバックする', () => {
    // theme='旅行' は level1 に存在しない → テーマ絞りが空 → 同レベル(level1)へ落ちる。
    const set = buildDictSet(MINI, 1, '旅行', 3)
    expect(set).toHaveLength(3)
    expect(set.every((e) => e.word === 'apple')).toBe(true)
  })

  it('同レベルも空ならデータ全体へフォールバックする', () => {
    // level5 の語は無い → テーマ絞りも同レベル絞りも空 → 全辞書へ落ちる。
    const set = buildDictSet(MINI, 5, 'すべて', 3)
    expect(set).toHaveLength(3)
    expect(set.every((e) => e.word === 'apple')).toBe(true)
  })
})

describe('makeDictQuiz は誤答同士の前方一致も避ける（word ベース）', () => {
  // 誤答候補の word が入れ子で前方一致するクラスタ（be ⊂ bee ⊂ beef）。
  // どれか1つしか採れず、以降は衝突スキップ（continue）が必ず走る。
  const COLLIDE = [
    { word: 'zebra', def: 'a striped wild animal', ja: 'しまうま', kana: 'しまうま', level: 1, theme: '日常' },
    { word: 'be', def: 'aaa def one', ja: 'ある', kana: 'びー', level: 1, theme: '日常' },
    { word: 'bee', def: 'bbb def two', ja: 'はち', kana: 'びー', level: 1, theme: '日常' },
    { word: 'beef', def: 'ccc def three', ja: 'ぎゅうにく', kana: 'びーふ', level: 1, theme: '日常' },
  ]

  it('前方一致で埋まらない分は捨て、残った選択肢は互いに前方一致しない', () => {
    const items = makeDictQuiz([COLLIDE[0]], COLLIDE, 3, 4, { rng: mulberry32(9) })
    expect(items.length).toBe(3)
    for (const q of items) {
      // be クラスタからは1語しか採れないので正解+誤答1の計2択に収まる。
      expect(q.options.length).toBeLessThanOrEqual(2)
      expect(q.options.filter((o) => o.answer).length).toBe(1)
      for (const a of q.options) {
        for (const b of q.options) {
          if (a === b) continue
          expect(a.display.startsWith(b.display) || b.display.startsWith(a.display)).toBe(false)
        }
      }
    }
  })
})

describe('makeDictPick は誤答同士の前方一致も避ける（def ベース）', () => {
  // 誤答候補の def が相互に前方一致するクラスタ。
  const COLLIDE_DEF = [
    { word: 'apple', def: 'red round sweet fruit', ja: 'りんご', kana: 'りんご', level: 1, theme: '日常' },
    { word: 'w1', def: 'aaa base', ja: 'いち', kana: 'いち', level: 1, theme: '日常' },
    { word: 'w2', def: 'aaa base longer', ja: 'に', kana: 'に', level: 1, theme: '日常' },
    { word: 'w3', def: 'aaa base longer more', ja: 'さん', kana: 'さん', level: 1, theme: '日常' },
  ]

  it('前方一致で埋まらない分は捨て、残った定義は互いに前方一致しない', () => {
    const items = makeDictPick([COLLIDE_DEF[0]], COLLIDE_DEF, 3, 4, { rng: mulberry32(4) })
    expect(items.length).toBe(3)
    for (const q of items) {
      expect(q.options.length).toBeLessThanOrEqual(2)
      expect(q.options.filter((o) => o.answer).length).toBe(1)
      for (const a of q.options) {
        for (const b of q.options) {
          if (a === b) continue
          expect(a.display.startsWith(b.display) || b.display.startsWith(a.display)).toBe(false)
        }
      }
    }
  })
})

describe('makeDictQuiz', () => {
  it('定義→英単語の4択。選択肢に正解を含み、前方一致が衝突しない', () => {
    const lv = DICT_AVAILABLE_LEVELS[0]
    const qs = makeDictQuiz(buildDictSet(DICT, lv, 'すべて', 10), levelEntries(DICT, lv), 10)
    expect(qs.length).toBe(10)
    for (const q of qs) {
      expect(typeof q.prompt).toBe('string') // 英語の定義
      expect(typeof q.ja).toBe('string') // 回答後に見せる和訳
      expect(q.options.filter((o) => o.answer).length).toBe(1)
      for (const a of q.options) {
        for (const b of q.options) {
          if (a === b) continue
          const va = a.variants[0]
          const vb = b.variants[0]
          expect(va.startsWith(vb) || vb.startsWith(va)).toBe(false)
        }
      }
    }
  })
})

describe('buildDictSet の固定範囲 range（#364）', () => {
  // range 有り → 出題エントリを poolForRangeBy(dict, level, theme, range, 100, freqOf, keyOf) に
  //   差し替える（freq 順・rng 不使用・決定的）。誤答プールは別引数（levelEntries）なので range で
  //   絞らず、4択は range 外からも埋まる。range 無しは従来どおり（rng シャッフル・非回帰）。
  // dict は freq を持たないため freqOf/keyOf を外部 freqMap から与える。
  const dEntry = (word, def) => ({ word, def, ja: `${word}訳`, kana: 'あ', level: 1, theme: '日常' })

  // level1/日常 を 120 件（freq 順＝d000..d119 に安定化）。
  const MANY = Array.from({ length: 120 }, (_, i) =>
    dEntry(`d${String(i).padStart(3, '0')}`, `def ${i} unique text`),
  )
  const freqMap = new Map(MANY.map((e, i) => [e.word, i + 1]))
  const freqOf = (e) => freqMap.get(e.word) ?? null
  const keyOf = (e) => e.word

  it('range 指定で該当 100 件を freq 順・決定的に返す（rng 不使用）', () => {
    const a = buildDictSet(MANY, 1, '日常', 100, { range: 1, freqOf, keyOf })
    expect(a).toHaveLength(100)
    expect(a[0].word).toBe('d000')
    expect(a[99].word).toBe('d099')
    // freq 昇順（外部 freqMap）で単調
    const freqs = a.map((e) => freqMap.get(e.word))
    expect(freqs).toEqual([...freqs].sort((x, y) => x - y))
    // 同 range を2回呼んで一致（決定的）
    const b = buildDictSet(MANY, 1, '日常', 100, { range: 1, freqOf, keyOf })
    expect(a.map((e) => e.word)).toEqual(b.map((e) => e.word))
  })

  it('range 指定は該当範囲外の語を含まない（range2 は d100..d119 の 20 件）', () => {
    const r2 = buildDictSet(MANY, 1, '日常', 100, { range: 2, freqOf, keyOf })
    // 該当範囲は 20 件だが count=100 → 循環で 100 件（すべて d100..d119 のいずれか）
    const inRange = new Set(
      Array.from({ length: 20 }, (_, i) => `d${String(100 + i).padStart(3, '0')}`),
    )
    expect(r2.every((e) => inRange.has(e.word))).toBe(true)
    expect(r2[0].word).toBe('d100')
  })

  it('誤答プール（levelEntries）は range で絞らず、4択が range 外からも埋まる', () => {
    // level1/日常=3件（apple/banana/cherry）＋ level1/旅行=4件（dog/egg/fig/grape）。
    const dict = [
      { word: 'apple', def: 'aaa def one', ja: 'りんご', kana: 'りんご', level: 1, theme: '日常' },
      { word: 'banana', def: 'bbb def two', ja: 'ばなな', kana: 'ばなな', level: 1, theme: '日常' },
      { word: 'cherry', def: 'ccc def three', ja: 'さくらんぼ', kana: 'さくらんぼ', level: 1, theme: '日常' },
      { word: 'dog', def: 'ddd def four', ja: 'いぬ', kana: 'いぬ', level: 1, theme: '旅行' },
      { word: 'egg', def: 'eee def five', ja: 'たまご', kana: 'たまご', level: 1, theme: '旅行' },
      { word: 'fig', def: 'fff def six', ja: 'いちじく', kana: 'いちじく', level: 1, theme: '旅行' },
      { word: 'grape', def: 'ggg def seven', ja: 'ぶどう', kana: 'ぶどう', level: 1, theme: '旅行' },
    ]
    const fmap = new Map(dict.map((e, i) => [e.word, i + 1]))
    const fOf = (e) => fmap.get(e.word) ?? null
    const kOf = (e) => e.word
    const 旅行 = new Set(['dog', 'egg', 'fig', 'grape'])

    // 出題セットは日常 range1（3件）を循環→apple,banana,cherry,apple,banana（freq 順・決定的）
    const set = buildDictSet(dict, 1, '日常', 5, { range: 1, freqOf: fOf, keyOf: kOf })
    expect(set.map((e) => e.word)).toEqual(['apple', 'banana', 'cherry', 'apple', 'banana'])

    // 誤答は level1 全体（旅行含む）から。日常語は3種のみ→4択のどれかは必ず旅行（range 外）。
    const qs = makeDictQuiz(set, levelEntries(dict, 1), 5, 4, { rng: mulberry32(7) })
    expect(qs.length).toBe(5)
    for (const q of qs) {
      expect(q.options.length).toBe(4)
      expect(q.options.some((o) => 旅行.has(o.en))).toBe(true)
    }
  })

  it('range 無しは従来どおり（freqOf/keyOf を無視し rng シャッフルに従う・非回帰）', () => {
    const a = buildDictSet(MANY, 1, '日常', 5, { rng: mulberry32(9) })
    const b = buildDictSet(MANY, 1, '日常', 5, { rng: mulberry32(9), freqOf, keyOf })
    // range 無しなら freqOf/keyOf は結果に影響しない（従来経路のまま）
    expect(a.map((e) => e.word)).toEqual(b.map((e) => e.word))
    expect(a).toHaveLength(5)
  })
})
