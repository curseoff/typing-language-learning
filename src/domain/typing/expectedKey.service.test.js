import { describe, it, expect } from 'vitest'
// 未実装モジュール（#446）。coder が Green にする対象。
// 2ブラウザ E2E ドライバが「次に打てば正解になるキー」「必ずミスになるキー」を知るための純ドメイン関数。
import { nextKeyFor, wrongKeyFor } from './expectedKey.service.js'
import { acceptsRomaji, isKanaComplete } from '../romaji/input.service.js'

// かな入力の代表ケース（既存 acceptsRomaji の仕様に沿う範囲で選ぶ）。
// 綴りが複数ある（し=shi/si/ci、っ=xtu/ltu 等）ものは「どれを返すか」ではなく
// 「返したキーが受理されるか」で検証する＝実装をなぞる同義反復にしない。
const KANA_CASES = [
  ['か', ''], // 清音（ka/ca）
  ['か', 'k'],
  ['し', ''], // 複数綴り（shi/si/ci）
  ['し', 's'],
  ['し', 'sh'],
  ['あ', ''],
  ['ん', ''], // 撥音（nn/n'）
  ['ん', 'n'],
  ['っ', ''], // 促音（xtu/ltu）
  ['っか', ''], // 促音＋子音重ね（kka/xtuka/…）
  ['っか', 'k'],
  ['んか', ''], // 撥音＋後続（nka/nnka/n'ka/…）
  ['んか', 'nn'],
  ['きゃ', ''], // 拗音
  ['きゃ', 'ky'],
]

describe('nextKeyFor（かな入力＝次に打てば正解になる1キー）', () => {
  it.each(KANA_CASES)('kana=%s input=%s のとき、返したキーは acceptsRomaji に受理される', (kana, input) => {
    const key = nextKeyFor({ target: kana, kana, input })
    expect(typeof key).toBe('string')
    expect(key).toHaveLength(1)
    expect(acceptsRomaji(kana, input + key)).toBe(true)
  })

  it('次に打てるキーが1つしかないかなは、その1キーを返す', () => {
    // か は ka/ca だが 'k' の続きは 'a' のみ／きゃ は kya のみ／ん は nn・n' で先頭は 'n' のみ
    expect(nextKeyFor({ target: 'か', kana: 'か', input: 'k' })).toBe('a')
    expect(nextKeyFor({ target: 'あ', kana: 'あ', input: '' })).toBe('a')
    expect(nextKeyFor({ target: 'ん', kana: 'ん', input: '' })).toBe('n')
    expect(nextKeyFor({ target: 'きゃ', kana: 'きゃ', input: 'ky' })).toBe('a')
    expect(nextKeyFor({ target: 'し', kana: 'し', input: 'sh' })).toBe('i')
    expect(nextKeyFor({ target: 'っか', kana: 'っか', input: 'k' })).toBe('k') // 子音重ね
  })

  it('返したキーを継ぎ足していくと、かなを最後まで打ち切れる', () => {
    for (const kana of ['か', 'し', 'ん', 'っ', 'っか', 'んか', 'きゃ', 'あ']) {
      let input = ''
      for (let i = 0; i < 12 && !isKanaComplete(kana, input); i++) {
        const key = nextKeyFor({ target: kana, kana, input })
        expect(key).not.toBeNull()
        input += key
      }
      expect(isKanaComplete(kana, input)).toBe(true)
    }
  })

  it('input 未指定は空入力として扱う', () => {
    expect(nextKeyFor({ target: 'あ', kana: 'あ' })).toBe('a')
  })
})

describe('nextKeyFor（素の文字列入力＝kana 無し）', () => {
  it('target の未入力位置の1文字を返す', () => {
    expect(nextKeyFor({ target: 'apple', input: '' })).toBe('a')
    expect(nextKeyFor({ target: 'apple', input: 'ap' })).toBe('p')
    expect(nextKeyFor({ target: 'apple', input: 'appl' })).toBe('e')
  })

  it('kana が空文字列/null/undefined なら素の文字列入力として扱う', () => {
    expect(nextKeyFor({ target: 'apple', kana: '', input: 'a' })).toBe('p')
    expect(nextKeyFor({ target: 'apple', kana: null, input: 'a' })).toBe('p')
    expect(nextKeyFor({ target: 'apple', kana: undefined, input: 'a' })).toBe('p')
  })

  it('input 未指定は空入力として扱う', () => {
    expect(nextKeyFor({ target: 'apple' })).toBe('a')
  })
})

describe('wrongKeyFor（必ずミスになる1キー）', () => {
  it.each(KANA_CASES)('kana=%s input=%s のとき、返したキーは acceptsRomaji に受理されない', (kana, input) => {
    const key = wrongKeyFor({ target: kana, kana, input })
    expect(typeof key).toBe('string')
    expect(key).toHaveLength(1)
    expect(acceptsRomaji(kana, input + key)).toBe(false)
  })

  it('素の文字列入力では、その位置の正解文字とは異なる1文字を返す', () => {
    for (const input of ['', 'a', 'ap', 'appl']) {
      const key = wrongKeyFor({ target: 'apple', input })
      expect(key).toHaveLength(1)
      expect(key).not.toBe('apple'[input.length])
    }
  })

  it('nextKeyFor が返すキーとは必ず異なる', () => {
    for (const [kana, input] of KANA_CASES) {
      expect(wrongKeyFor({ target: kana, kana, input })).not.toBe(nextKeyFor({ target: kana, kana, input }))
    }
    expect(wrongKeyFor({ target: 'apple', input: 'ap' })).not.toBe(nextKeyFor({ target: 'apple', input: 'ap' }))
  })

  it('input 未指定は空入力として扱う', () => {
    expect(acceptsRomaji('あ', wrongKeyFor({ target: 'あ', kana: 'あ' }))).toBe(false)
    expect(wrongKeyFor({ target: 'apple' })).not.toBe('a')
  })
})

describe('端ケース（null を返す）', () => {
  it('かなを打ち切り済みなら null', () => {
    for (const [kana, input] of [['か', 'ka'], ['し', 'si'], ['ん', 'nn'], ['きゃ', 'kya'], ['っか', 'kka']]) {
      expect(isKanaComplete(kana, input)).toBe(true) // 前提の確認
      expect(nextKeyFor({ target: kana, kana, input })).toBeNull()
      expect(wrongKeyFor({ target: kana, kana, input })).toBeNull()
    }
  })

  it('素の文字列入力で入力が target 長に達していたら null', () => {
    expect(nextKeyFor({ target: 'apple', input: 'apple' })).toBeNull()
    expect(wrongKeyFor({ target: 'apple', input: 'apple' })).toBeNull()
    expect(nextKeyFor({ target: 'apple', input: 'applepie' })).toBeNull()
    expect(wrongKeyFor({ target: 'apple', input: 'applepie' })).toBeNull()
  })

  it('target が空や非文字列なら null', () => {
    for (const target of ['', null, undefined, 123, {}, []]) {
      expect(nextKeyFor({ target, input: '' })).toBeNull()
      expect(wrongKeyFor({ target, input: '' })).toBeNull()
    }
  })

  it('引数そのものが無くても落ちずに null', () => {
    expect(nextKeyFor({})).toBeNull()
    expect(wrongKeyFor({})).toBeNull()
  })

  it('どの候補も受理されない不正な入力途中なら null', () => {
    // 'z' は か のどの綴りの前方一致でもない＝以後どのキーを足しても受理されない
    expect(acceptsRomaji('か', 'z')).toBe(false) // 前提の確認
    expect(nextKeyFor({ target: 'か', kana: 'か', input: 'z' })).toBeNull()
    // 仮定: 「正解キーが存在しない」状態では wrongKeyFor も null を返す（契約の端ケース記述に合わせる）
    expect(wrongKeyFor({ target: 'か', kana: 'か', input: 'z' })).toBeNull()
  })
})

describe('純粋性・決定性', () => {
  it('同じ引数なら常に同じ結果を返す', () => {
    for (const [kana, input] of KANA_CASES) {
      const args = { target: kana, kana, input }
      expect(nextKeyFor(args)).toBe(nextKeyFor(args))
      expect(wrongKeyFor(args)).toBe(wrongKeyFor(args))
    }
    expect(nextKeyFor({ target: 'apple', input: 'ap' })).toBe(nextKeyFor({ target: 'apple', input: 'ap' }))
    expect(wrongKeyFor({ target: 'apple', input: 'ap' })).toBe(wrongKeyFor({ target: 'apple', input: 'ap' }))
  })

  it('引数オブジェクトを破壊しない', () => {
    const args = Object.freeze({ target: 'し', kana: 'し', input: 's' })
    expect(() => nextKeyFor(args)).not.toThrow()
    expect(() => wrongKeyFor(args)).not.toThrow()
    expect(args).toEqual({ target: 'し', kana: 'し', input: 's' })
  })
})
