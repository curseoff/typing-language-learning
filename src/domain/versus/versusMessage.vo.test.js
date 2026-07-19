import { describe, it, expect } from 'vitest'
// #426 対戦基盤スライス1：P2P 受信メッセージの検証/整形（信頼境界＝untrusted 入力）。
// 本体 src/domain/versus/versusMessage.vo.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// parseMessage(obj)  … 受信（untrusted）。不正入力は throw せず null。正常は正規化した message。
// buildMessage(type, payload) … 送信（自コード＝trusted）。不正 type は throw。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。
import { parseMessage, buildMessage } from './versusMessage.vo.js'

// ---- 正常系（各メッセージ型を parse できる） ----
describe('parseMessage：正常系（各型を正規化して返す）', () => {
  it('progress を保持して返す', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 12345 })
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 12345 })
  })

  it('progress の下限値（typed=0・mistakes=0・total=1）を通す', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 0, total: 1, mistakes: 0, at: 0 })
    expect(m).not.toBeNull()
    expect(m.type).toBe('progress')
  })

  it('countdown を保持して返す', () => {
    const m = parseMessage({ type: 'countdown', startAt: 987654 })
    expect(m).toMatchObject({ type: 'countdown', startAt: 987654 })
  })

  it('finished を保持して返す', () => {
    const m = parseMessage({ type: 'finished', peerId: 'a', keys: 120, mistakes: 4, elapsedMs: 45000 })
    expect(m).toMatchObject({ type: 'finished', peerId: 'a', keys: 120, mistakes: 4, elapsedMs: 45000 })
  })

  it('finished の下限値（keys=0・mistakes=0・elapsedMs=0）を通す', () => {
    const m = parseMessage({ type: 'finished', peerId: 'a', keys: 0, mistakes: 0, elapsedMs: 0 })
    expect(m).not.toBeNull()
  })

  it('peerLeft を保持して返す', () => {
    const m = parseMessage({ type: 'peerLeft', peerId: 'a' })
    expect(m).toMatchObject({ type: 'peerLeft', peerId: 'a' })
  })

  it('hello を保持して返す（name 省略可）', () => {
    const m = parseMessage({ type: 'hello', peerId: 'a' })
    expect(m).toMatchObject({ type: 'hello', peerId: 'a' })
  })

  it('hello は name があれば保持する', () => {
    const m = parseMessage({ type: 'hello', peerId: 'a', name: 'アリス' })
    expect(m).toMatchObject({ type: 'hello', peerId: 'a', name: 'アリス' })
  })
})

// ---- 不正入力は null（表駆動で網羅） ----
describe('parseMessage：不正入力は null を返す（throw しない）', () => {
  const invalidCases = [
    ['null', null],
    ['undefined', undefined],
    ['数値（非オブジェクト）', 42],
    ['文字列（非オブジェクト）', 'progress'],
    ['配列', [{ type: 'progress' }]],
    ['type 欠落', { peerId: 'a', typed: 1, total: 2, mistakes: 0, at: 1 }],
    ['未知 type', { type: 'ping', peerId: 'a' }],
    // progress
    ['progress: peerId 欠落', { type: 'progress', typed: 1, total: 2, mistakes: 0, at: 1 }],
    ['progress: peerId 空文字', { type: 'progress', peerId: '', typed: 1, total: 2, mistakes: 0, at: 1 }],
    ['progress: peerId 非文字列', { type: 'progress', peerId: 5, typed: 1, total: 2, mistakes: 0, at: 1 }],
    ['progress: typed 負', { type: 'progress', peerId: 'a', typed: -1, total: 2, mistakes: 0, at: 1 }],
    ['progress: typed 非数', { type: 'progress', peerId: 'a', typed: '1', total: 2, mistakes: 0, at: 1 }],
    ['progress: total<1', { type: 'progress', peerId: 'a', typed: 0, total: 0, mistakes: 0, at: 1 }],
    ['progress: total NaN', { type: 'progress', peerId: 'a', typed: 0, total: NaN, mistakes: 0, at: 1 }],
    ['progress: mistakes 負', { type: 'progress', peerId: 'a', typed: 1, total: 2, mistakes: -1, at: 1 }],
    ['progress: at Infinity', { type: 'progress', peerId: 'a', typed: 1, total: 2, mistakes: 0, at: Infinity }],
    ['progress: at 欠落', { type: 'progress', peerId: 'a', typed: 1, total: 2, mistakes: 0 }],
    // countdown
    ['countdown: startAt 欠落', { type: 'countdown' }],
    ['countdown: startAt NaN', { type: 'countdown', startAt: NaN }],
    ['countdown: startAt Infinity', { type: 'countdown', startAt: Infinity }],
    ['countdown: startAt 非数', { type: 'countdown', startAt: '10000' }],
    // finished
    ['finished: peerId 空', { type: 'finished', peerId: '', keys: 1, mistakes: 0, elapsedMs: 1 }],
    ['finished: keys 負', { type: 'finished', peerId: 'a', keys: -1, mistakes: 0, elapsedMs: 1 }],
    ['finished: mistakes 負', { type: 'finished', peerId: 'a', keys: 1, mistakes: -1, elapsedMs: 1 }],
    ['finished: elapsedMs 負', { type: 'finished', peerId: 'a', keys: 1, mistakes: 0, elapsedMs: -1 }],
    ['finished: elapsedMs NaN', { type: 'finished', peerId: 'a', keys: 1, mistakes: 0, elapsedMs: NaN }],
    ['finished: keys 欠落', { type: 'finished', peerId: 'a', mistakes: 0, elapsedMs: 1 }],
    // peerLeft
    ['peerLeft: peerId 欠落', { type: 'peerLeft' }],
    ['peerLeft: peerId 空', { type: 'peerLeft', peerId: '' }],
    // hello
    ['hello: peerId 欠落', { type: 'hello' }],
    ['hello: peerId 空', { type: 'hello', peerId: '' }],
  ]

  it.each(invalidCases)('%s → null', (_label, input) => {
    expect(parseMessage(input)).toBeNull()
  })
})

// ---- parseMessage は決して throw しない（fuzz 的な悪意入力） ----
describe('parseMessage：どんな入力でも throw しない（信頼境界）', () => {
  const hostile = [
    null,
    undefined,
    NaN,
    Symbol('x'),
    () => {},
    { type: {} },
    { type: 'progress', peerId: { toString() { throw new Error('boom') } } },
    { type: 'progress', typed: Infinity, total: -Infinity },
    [],
    new Map(),
    123n,
  ]

  it.each(hostile.map((v, i) => [i, v]))('悪意入力 #%i でも throw せず null/オブジェクトを返す', (_i, input) => {
    let result
    expect(() => {
      result = parseMessage(input)
    }).not.toThrow()
    // 不正入力なので原則 null（少なくとも throw しないことが最重要）。
    expect(result === null || typeof result === 'object').toBe(true)
  })
})

// ---- buildMessage：自コード用の整形（不正 type は throw） ----
describe('buildMessage：正常生成と不正 type の throw', () => {
  it('progress を組み立てる（type と payload をまとめた object を返す）', () => {
    const m = buildMessage('progress', { peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 12345 })
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 12345 })
  })

  it('countdown を組み立てる', () => {
    const m = buildMessage('countdown', { startAt: 987654 })
    expect(m).toMatchObject({ type: 'countdown', startAt: 987654 })
  })

  it('hello を組み立てる', () => {
    const m = buildMessage('hello', { peerId: 'a', name: 'アリス' })
    expect(m).toMatchObject({ type: 'hello', peerId: 'a' })
  })

  it('未知 type は throw する（自コード＝trusted）', () => {
    expect(() => buildMessage('ping', { peerId: 'a' })).toThrow()
  })

  it('type が空文字は throw する', () => {
    expect(() => buildMessage('', { peerId: 'a' })).toThrow()
  })
})

// ============================================================================
// #432 P2P 穴埋め対戦：progress 拡張（correct/lives）＋ propose/vote/start の追加。
//   本体 versusMessage.vo.js に型追加する前提の「失敗テスト（Red）」。
//   config は parseMatchConfig で検証する想定＝ここではワイヤ形（endCondition={kind,value}）で渡す。
// ============================================================================

// ワイヤ由来の妥当な MatchConfig（propose/start の config に使う）。
function validWireConfig(overrides = {}) {
  return {
    gameType: 'wsent',
    level: 3,
    theme: '日常',
    range: null,
    mode: 'both',
    endCondition: { kind: 'chars', value: 60 },
    learningMode: 'cloze',
    ...overrides,
  }
}

// ---- progress 拡張：correct / lives の後方互換 ----
describe('parseMessage：progress 拡張（correct/lives は後方互換の任意フィールド）', () => {
  it('correct/lives を省いた既存形は従来どおり通る（後方互換）', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5 })
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5 })
    expect(m).not.toHaveProperty('correct')
    expect(m).not.toHaveProperty('lives')
  })

  it('correct（非負有限数）と lives（整数）が妥当なら保持する', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, correct: 2, lives: 3 })
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', correct: 2, lives: 3 })
  })

  it('correct=0 / lives=0（下限）を保持する', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 0, total: 1, mistakes: 0, at: 0, correct: 0, lives: 0 })
    expect(m.correct).toBe(0)
    expect(m.lives).toBe(0)
  })

  it('correct が型不正なら省略して基本 progress は有効（任意フィールドは落とす）', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, correct: '2' })
    expect(m).not.toBeNull()
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', typed: 3 })
    expect(m).not.toHaveProperty('correct')
  })

  it('correct が負なら省略して基本 progress は有効', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, correct: -1 })
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('correct')
  })

  it('lives が非整数なら省略して基本 progress は有効', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, lives: 2.5 })
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('lives')
  })
})

// ---- progress 拡張：speed / elapsedMs の後方互換（#432 相手カードの速度・時間が0 の修正） ----
// 相手カードの速度・時間を出すため、progress に速度(speed)・経過時間(elapsedMs)を後方互換で載せる。
// 方針は correct/lives と同じ：非負有限数なら保持、不正（負・非数・NaN・Infinity）は省略し、基本 progress は無効化しない。
describe('parseMessage：progress 拡張（speed/elapsedMs は後方互換の任意フィールド）', () => {
  it('speed/elapsedMs を省いた既存形はキーを持たない（後方互換）', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5 })
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('speed')
    expect(m).not.toHaveProperty('elapsedMs')
  })

  it('speed（非負有限数）と elapsedMs（非負有限数）が妥当なら保持する', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, speed: 180, elapsedMs: 4200 })
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', speed: 180, elapsedMs: 4200 })
  })

  it('speed=0 / elapsedMs=0（下限）を保持する', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 0, total: 1, mistakes: 0, at: 0, speed: 0, elapsedMs: 0 })
    expect(m.speed).toBe(0)
    expect(m.elapsedMs).toBe(0)
  })

  it('小数の speed（例：150.5）も非負有限数なら保持する', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, speed: 150.5 })
    expect(m.speed).toBe(150.5)
  })

  const invalidSpeed = [
    ['負', -1],
    ['非数（文字列）', '180'],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ]
  it.each(invalidSpeed)('speed が %s なら省略して基本 progress は有効', (_label, speed) => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, speed })
    expect(m).not.toBeNull()
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', typed: 3 })
    expect(m).not.toHaveProperty('speed')
  })

  const invalidElapsed = [
    ['負', -1],
    ['非数（文字列）', '4200'],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ]
  it.each(invalidElapsed)('elapsedMs が %s なら省略して基本 progress は有効', (_label, elapsedMs) => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, elapsedMs })
    expect(m).not.toBeNull()
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', typed: 3 })
    expect(m).not.toHaveProperty('elapsedMs')
  })

  it('buildMessage で speed/elapsedMs を含む progress を組み立てられる', () => {
    const m = buildMessage('progress', { peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, speed: 180, elapsedMs: 4200 })
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', speed: 180, elapsedMs: 4200 })
  })
})

// ---- progress 拡張：cells / miss の後方互換（#437 伏せ字マスバーのワイヤ形） ----
// 相手のリアルタイム入力進捗を伏せ字マスで見せるため、量子化済みの cells（0..cap 整数）と
// ミス中フラグ miss（厳格 boolean）を progress に後方互換で載せる。curLen 実長はワイヤに流さない。
// 方針：cells は非負整数なら保持・不正は省略、miss は厳格 boolean なら保持・それ以外は省略。
// いずれも基本 progress は無効化しない（correct/lives/speed/elapsedMs と同方針）。
describe('parseMessage：progress 拡張（cells/miss は後方互換の任意フィールド・#437）', () => {
  it('cells/miss を省いた既存形はキーを持たない（後方互換）', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5 })
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('cells')
    expect(m).not.toHaveProperty('miss')
  })

  it('cells（非負整数）が妥当なら保持する', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, cells: 4 })
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', cells: 4 })
  })

  it('cells=0（下限）を保持する', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 0, total: 1, mistakes: 0, at: 0, cells: 0 })
    expect(m.cells).toBe(0)
  })

  const invalidCells = [
    ['非整数（小数）', 4.5],
    ['非数（文字列）', '4'],
    ['負', -1],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ]
  it.each(invalidCells)('cells が %s なら省略して基本 progress は有効', (_label, cells) => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, cells })
    expect(m).not.toBeNull()
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', typed: 3 })
    expect(m).not.toHaveProperty('cells')
  })

  it('cells 欠落でも progress は有効（cells キーを持たない）', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5 })
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('cells')
  })

  it.each([true, false])('miss=%s（厳格 boolean）を保持する', (miss) => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, miss })
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', miss })
  })

  const invalidMiss = [
    ['数値 1', 1],
    ['文字列 "true"', 'true'],
    ['null', null],
  ]
  it.each(invalidMiss)('miss が %s なら省略して基本 progress は有効', (_label, miss) => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, miss })
    expect(m).not.toBeNull()
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', typed: 3 })
    expect(m).not.toHaveProperty('miss')
  })

  it('miss 欠落でも progress は有効（miss キーを持たない）', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5 })
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('miss')
  })

  it('buildMessage で cells/miss を含む progress を組み立てられる', () => {
    const m = buildMessage('progress', { peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, cells: 4, miss: true })
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', cells: 4, miss: true })
  })
})

// ---- propose：対戦設定の提案 ----
describe('parseMessage：propose（config は parseMatchConfig 検証・seed は非負整数）', () => {
  it('妥当な propose を正規化して返す', () => {
    const m = parseMessage({ type: 'propose', peerId: 'a', config: validWireConfig(), seed: 12345 })
    expect(m).not.toBeNull()
    expect(m).toMatchObject({ type: 'propose', peerId: 'a', seed: 12345 })
    expect(m.config).toMatchObject({ gameType: 'wsent', level: 3, theme: '日常', mode: 'both', learningMode: 'cloze' })
    expect(m.config.endCondition).toMatchObject({ kind: 'chars', value: 60 })
  })

  it('seed=0（下限）を許可する', () => {
    const m = parseMessage({ type: 'propose', peerId: 'a', config: validWireConfig(), seed: 0 })
    expect(m).not.toBeNull()
    expect(m.seed).toBe(0)
  })

  const invalid = [
    ['peerId 空', { type: 'propose', peerId: '', config: validWireConfig(), seed: 1 }],
    ['peerId 欠落', { type: 'propose', config: validWireConfig(), seed: 1 }],
    ['config 不正（gameType 集合外）', { type: 'propose', peerId: 'a', config: validWireConfig({ gameType: 'x' }), seed: 1 }],
    ['config が endless', { type: 'propose', peerId: 'a', config: validWireConfig({ endCondition: { kind: 'endless', value: null } }), seed: 1 }],
    ['config 欠落', { type: 'propose', peerId: 'a', seed: 1 }],
    ['seed 負', { type: 'propose', peerId: 'a', config: validWireConfig(), seed: -1 }],
    ['seed 非整数', { type: 'propose', peerId: 'a', config: validWireConfig(), seed: 1.5 }],
    ['seed 非数', { type: 'propose', peerId: 'a', config: validWireConfig(), seed: '1' }],
    ['seed 欠落', { type: 'propose', peerId: 'a', config: validWireConfig() }],
  ]
  it.each(invalid)('%s → null', (_label, input) => {
    expect(parseMessage(input)).toBeNull()
  })
})

// ---- vote：提案への賛否（accept は厳格 boolean） ----
describe('parseMessage：vote（accept は厳格 boolean）', () => {
  it.each([true, false])('accept=%s を保持する', (accept) => {
    const m = parseMessage({ type: 'vote', peerId: 'a', accept })
    expect(m).toMatchObject({ type: 'vote', peerId: 'a', accept })
  })

  const invalid = [
    ['peerId 空', { type: 'vote', peerId: '', accept: true }],
    ['accept が数値', { type: 'vote', peerId: 'a', accept: 1 }],
    ['accept が文字列', { type: 'vote', peerId: 'a', accept: 'true' }],
    ['accept が null', { type: 'vote', peerId: 'a', accept: null }],
    ['accept 欠落', { type: 'vote', peerId: 'a' }],
  ]
  it.each(invalid)('%s → null', (_label, input) => {
    expect(parseMessage(input)).toBeNull()
  })
})

// ---- start：確定した対戦設定の冪等配布 ----
describe('parseMessage：start（config=parseMatchConfig 検証・seed は非負整数）', () => {
  it('妥当な start を正規化して返す', () => {
    const m = parseMessage({ type: 'start', config: validWireConfig(), seed: 999 })
    expect(m).not.toBeNull()
    expect(m).toMatchObject({ type: 'start', seed: 999 })
    expect(m.config).toMatchObject({ gameType: 'wsent', mode: 'both', learningMode: 'cloze' })
  })

  const invalid = [
    ['config 不正（mode 集合外）', { type: 'start', config: validWireConfig({ mode: 'mix' }), seed: 1 }],
    ['config が endless', { type: 'start', config: validWireConfig({ endCondition: { kind: 'endless', value: null } }), seed: 1 }],
    ['config 欠落', { type: 'start', seed: 1 }],
    ['seed 負', { type: 'start', config: validWireConfig(), seed: -1 }],
    ['seed 非整数', { type: 'start', config: validWireConfig(), seed: 2.5 }],
    ['seed 欠落', { type: 'start', config: validWireConfig() }],
  ]
  it.each(invalid)('%s → null', (_label, input) => {
    expect(parseMessage(input)).toBeNull()
  })
})

// ---- buildMessage：新 type を許可（未知はなお throw） ----
describe('buildMessage：propose/vote/start を組み立てる（未知はなお throw）', () => {
  it('propose を組み立てる', () => {
    const m = buildMessage('propose', { peerId: 'a', config: validWireConfig(), seed: 12345 })
    expect(m).toMatchObject({ type: 'propose', peerId: 'a', seed: 12345 })
  })

  it('vote を組み立てる', () => {
    const m = buildMessage('vote', { peerId: 'a', accept: true })
    expect(m).toMatchObject({ type: 'vote', peerId: 'a', accept: true })
  })

  it('start を組み立てる', () => {
    const m = buildMessage('start', { config: validWireConfig(), seed: 999 })
    expect(m).toMatchObject({ type: 'start', seed: 999 })
  })

  it('未知 type はなお throw する', () => {
    expect(() => buildMessage('ping', { peerId: 'a' })).toThrow()
  })
})

// ============================================================================
// #432 対戦マッチ制御メッセージ：abort（ESCでロビー復帰の同期）＋ matchEnd（ホスト権威の終了配布）。
//   本体 versusMessage.vo.js に KNOWN_TYPES/PARSERS を追加する前提の「失敗テスト（Red）」。
// ============================================================================

// ---- abort：ESC でロビーへ戻ったことを相手へ通知（peerId 必須） ----
describe('parseMessage：abort（peerId 非空文字列を検証）', () => {
  it('妥当な abort を正規化して返す', () => {
    const m = parseMessage({ type: 'abort', peerId: 'a' })
    expect(m).toEqual({ type: 'abort', peerId: 'a' })
  })

  it('余計なフィールドは落とす（peerId だけを保持）', () => {
    const m = parseMessage({ type: 'abort', peerId: 'a', extra: 'x', reason: 'esc' })
    expect(m).toEqual({ type: 'abort', peerId: 'a' })
  })

  const invalid = [
    ['peerId 欠落', { type: 'abort' }],
    ['peerId 空文字', { type: 'abort', peerId: '' }],
    ['peerId 非文字列', { type: 'abort', peerId: 5 }],
    ['peerId null', { type: 'abort', peerId: null }],
  ]
  it.each(invalid)('%s → null', (_label, input) => {
    expect(parseMessage(input)).toBeNull()
  })
})

// ---- matchEnd：ホストが対戦終了を全員へ配布（ペイロードなし） ----
describe('parseMessage：matchEnd（ペイロードなし・余計なフィールドは落とす）', () => {
  it('妥当な matchEnd を { type: "matchEnd" } に正規化して返す', () => {
    const m = parseMessage({ type: 'matchEnd' })
    expect(m).toEqual({ type: 'matchEnd' })
  })

  it('余計なフィールドは落として { type: "matchEnd" } のみ返す', () => {
    const m = parseMessage({ type: 'matchEnd', peerId: 'a', extra: 1 })
    expect(m).toEqual({ type: 'matchEnd' })
  })
})

// ---- buildMessage：abort/matchEnd を許可（未知はなお throw） ----
describe('buildMessage：abort/matchEnd を組み立てる（未知はなお throw）', () => {
  it('abort を組み立てる（type と peerId をまとめた object を返す）', () => {
    const m = buildMessage('abort', { peerId: 'a' })
    expect(m).toMatchObject({ type: 'abort', peerId: 'a' })
  })

  it('matchEnd を組み立てる（ペイロードなし）', () => {
    const m = buildMessage('matchEnd')
    expect(m).toMatchObject({ type: 'matchEnd' })
  })
})

// ============================================================================
// #439 対戦：相手カードに盤面複製（伏字）＝方式B（構造送信）。
//   契約④ progress へ qIndex/typedSide/curPos を後方互換追加（不正はキー省略・cells 受理は残す）。
//   契約⑤ 新メッセージ board を追加（peerId/qIndex/typedSide/word/wordJa?/hint/answerShape・untrusted 検証）。
//   本体 versusMessage.vo.js に PARSERS.progress 拡張・KNOWN_TYPES/PARSERS.board 追加する前提の Red。
//   不変条件：どのフィールドにも答えの文字（定義文/和訳/例文の綴り・かな）を含めない。
// ============================================================================

// ---- 契約④ progress 拡張：qIndex / typedSide / curPos の後方互換 ----
describe('parseMessage：progress 拡張（qIndex/typedSide/curPos は後方互換の任意フィールド・#439）', () => {
  it('qIndex/typedSide/curPos を省いた既存形はキーを持たない（後方互換）', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5 })
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('qIndex')
    expect(m).not.toHaveProperty('typedSide')
    expect(m).not.toHaveProperty('curPos')
  })

  it('qIndex(非負整数)/typedSide(en|ja)/curPos(非負整数)/miss が妥当なら全部保持する', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, qIndex: 2, typedSide: 'en', curPos: 3, miss: false })
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', qIndex: 2, typedSide: 'en', curPos: 3, miss: false })
  })

  it('qIndex=0 / curPos=0（下限）を保持する', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 0, total: 1, mistakes: 0, at: 0, qIndex: 0, curPos: 0 })
    expect(m.qIndex).toBe(0)
    expect(m.curPos).toBe(0)
  })

  it.each(['en', 'ja'])('typedSide=%s を保持する', (typedSide) => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, typedSide })
    expect(m.typedSide).toBe(typedSide)
  })

  it('typedSide が集合外（"x"）なら typedSide だけ省略し他は保持', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, typedSide: 'x', qIndex: 1 })
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('typedSide')
    expect(m.qIndex).toBe(1)
  })

  const invalidQIndex = [
    ['負', -1],
    ['非整数（小数）', 1.5],
    ['非数（文字列）', '2'],
    ['NaN', NaN],
  ]
  it.each(invalidQIndex)('qIndex が %s なら qIndex だけ省略して基本 progress は有効', (_label, qIndex) => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, qIndex })
    expect(m).not.toBeNull()
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', typed: 3 })
    expect(m).not.toHaveProperty('qIndex')
  })

  const invalidCurPos = [
    ['負', -1],
    ['非整数（小数）', 2.5],
    ['非数（文字列）', '3'],
    ['Infinity', Infinity],
  ]
  it.each(invalidCurPos)('curPos が %s なら curPos だけ省略して基本 progress は有効', (_label, curPos) => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, curPos })
    expect(m).not.toBeNull()
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', typed: 3 })
    expect(m).not.toHaveProperty('curPos')
  })

  it('cells 併存でも progress は有効（cells 受理は残す＝旧クライアント無害）', () => {
    const m = parseMessage({ type: 'progress', peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, cells: 4, qIndex: 1, typedSide: 'ja', curPos: 2 })
    expect(m).not.toBeNull()
    expect(m).toMatchObject({ type: 'progress', qIndex: 1, typedSide: 'ja', curPos: 2, cells: 4 })
  })

  it('buildMessage で qIndex/typedSide/curPos を含む progress を組み立てられる', () => {
    const m = buildMessage('progress', { peerId: 'a', typed: 3, total: 10, mistakes: 1, at: 5, qIndex: 2, typedSide: 'en', curPos: 3 })
    expect(m).toMatchObject({ type: 'progress', peerId: 'a', qIndex: 2, typedSide: 'en', curPos: 3 })
  })
})

// 妥当な board のワイヤ形（overrides で各フィールドを差し替えて端ケースを作る）。
function validWireBoard(overrides = {}) {
  return {
    type: 'board',
    peerId: 'a',
    qIndex: 2,
    typedSide: 'ja',
    word: 'apple',
    wordJa: 'りんご',
    hint: { side: 'en', text: 'a round fruit' },
    answerShape: [2, 4, 4],
    ...overrides,
  }
}

// ---- 契約⑤ board：構造送信メッセージ（untrusted 検証・答え文字を含めない） ----
describe('parseMessage：board（#439・盤面複製の構造メッセージ・untrusted 検証）', () => {
  it('正常な board を正規化して返す（必須＋任意すべて保持）', () => {
    const m = parseMessage(validWireBoard())
    expect(m).not.toBeNull()
    expect(m).toMatchObject({
      type: 'board',
      peerId: 'a',
      qIndex: 2,
      typedSide: 'ja',
      word: 'apple',
      wordJa: 'りんご',
      answerShape: [2, 4, 4],
    })
    expect(m.hint).toMatchObject({ side: 'en', text: 'a round fruit' })
  })

  it('qIndex=0（下限）を許可する', () => {
    const m = parseMessage(validWireBoard({ qIndex: 0 }))
    expect(m).not.toBeNull()
    expect(m.qIndex).toBe(0)
  })

  it.each(['en', 'ja'])('typedSide=%s を許可する', (typedSide) => {
    const m = parseMessage(validWireBoard({ typedSide }))
    expect(m).not.toBeNull()
    expect(m.typedSide).toBe(typedSide)
  })

  it('wordJa 省略時は wordJa 無しで board を保持（ja モード＝和訳が答え）', () => {
    const board = validWireBoard()
    delete board.wordJa
    const m = parseMessage(board)
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('wordJa')
    expect(m.type).toBe('board')
  })

  it('wordJa が非文字列なら wordJa だけ落として board を保持', () => {
    const m = parseMessage(validWireBoard({ wordJa: 123 }))
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('wordJa')
  })

  it('hint に kana があれば保持する（ja ヒントのルビ用）', () => {
    const m = parseMessage(validWireBoard({ typedSide: 'en', hint: { side: 'ja', text: 'りんご', kana: 'りんご' } }))
    expect(m).not.toBeNull()
    expect(m.hint).toMatchObject({ side: 'ja', text: 'りんご', kana: 'りんご' })
  })

  it('hint が不正（side/text 欠落）なら hint キーを落として board は生存', () => {
    const m = parseMessage(validWireBoard({ hint: { side: 'en' } }))
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('hint')
    expect(m.type).toBe('board')
  })

  it('hint.side が集合外なら hint キーを落として board は生存', () => {
    const m = parseMessage(validWireBoard({ hint: { side: 'xx', text: 'foo' } }))
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('hint')
  })

  it('hint.kana が非文字列なら kana だけ落として hint 本体は保持', () => {
    const m = parseMessage(validWireBoard({ hint: { side: 'ja', text: 'りんご', kana: 5 } }))
    expect(m).not.toBeNull()
    expect(m.hint).toMatchObject({ side: 'ja', text: 'りんご' })
    expect(m.hint).not.toHaveProperty('kana')
  })

  it('answerShape に 0/負/非整数が混入したら answerShape を落として board は生存', () => {
    const m = parseMessage(validWireBoard({ answerShape: [2, 0, 4] }))
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('answerShape')
    expect(m.type).toBe('board')
  })

  it('answerShape が配列でない（数値）なら answerShape を落として board は生存', () => {
    const m = parseMessage(validWireBoard({ answerShape: 5 }))
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('answerShape')
  })

  it('answerShape が上限(64)超なら落として board は生存（防御）', () => {
    const m = parseMessage(validWireBoard({ answerShape: new Array(65).fill(1) }))
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('answerShape')
  })

  it('answerShape がちょうど 64 要素なら保持する（境界）', () => {
    const shape = new Array(64).fill(1)
    const m = parseMessage(validWireBoard({ answerShape: shape }))
    expect(m).not.toBeNull()
    expect(m.answerShape).toHaveLength(64)
  })

  it('余計なフィールドは落として規定キーのみ返す', () => {
    const m = parseMessage(validWireBoard({ extra: 'x', letters: 'apple' }))
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('extra')
    expect(m).not.toHaveProperty('letters')
  })

  const invalid = [
    ['peerId 欠落', validWireBoard({ peerId: undefined })],
    ['peerId 空文字', validWireBoard({ peerId: '' })],
    ['peerId 非文字列', validWireBoard({ peerId: 5 })],
    ['qIndex 負', validWireBoard({ qIndex: -1 })],
    ['qIndex 非整数', validWireBoard({ qIndex: 1.5 })],
    ['qIndex 非数', validWireBoard({ qIndex: '2' })],
    ['typedSide 集合外', validWireBoard({ typedSide: 'x' })],
    ['typedSide 欠落', validWireBoard({ typedSide: undefined })],
    ['word 非文字列', validWireBoard({ word: 123 })],
    ['word 欠落', validWireBoard({ word: undefined })],
  ]
  it.each(invalid)('%s → null（必須欠落は board 全体 null）', (_label, input) => {
    expect(parseMessage(input)).toBeNull()
  })

  it('不変条件：board は答えの文字（かな/綴り）をフィールドに含めない＝answerShape は長さ情報のみ', () => {
    // ja モード（typedSide=ja・答えはかな）：hint は英語側の実テキスト、答え側はマス数のみ。
    const m = parseMessage(validWireBoard({ typedSide: 'ja', word: 'apple', wordJa: undefined, hint: { side: 'en', text: 'a round fruit' }, answerShape: [3] }))
    expect(m).not.toBeNull()
    // answerShape は数値配列＝答えのかな綴りを含まない。
    expect(m.answerShape.every((n) => typeof n === 'number')).toBe(true)
  })

  it('board は決して throw しない（悪意入力：getter が throw する answerShape 等）', () => {
    const hostile = { type: 'board', peerId: 'a', qIndex: 2, typedSide: 'en', word: 'x', get answerShape() { throw new Error('boom') } }
    let result
    expect(() => {
      result = parseMessage(hostile)
    }).not.toThrow()
    expect(result === null || typeof result === 'object').toBe(true)
  })
})

// ---- buildMessage：board を許可（未知はなお throw） ----
describe('buildMessage：board を組み立てる（KNOWN_TYPES に board 追加・未知はなお throw）', () => {
  it('board を組み立てる（type と payload をまとめた object を返す）', () => {
    const m = buildMessage('board', { peerId: 'a', qIndex: 2, typedSide: 'ja', word: 'apple', hint: { side: 'en', text: 'a round fruit' }, answerShape: [2, 4, 4] })
    expect(m).toMatchObject({ type: 'board', peerId: 'a', qIndex: 2, typedSide: 'ja', word: 'apple' })
  })
})
