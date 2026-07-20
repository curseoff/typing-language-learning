import { describe, it, expect } from 'vitest'
// #439 対戦：相手カードに盤面複製（伏字）＝方式B（構造送信）の純ドメイン。
// 本体 src/domain/versus/boardMirror.service.js は coder が Green で作る（現状未実装＝import で落ちる Red）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。答えの文字を戻り値に一切含めない。
//   boardCursor({ seg, segInput })                … 送信側で「打っている側」と表示単位進捗を導く（en=char / ja=kana）。
//   maskStructure({ typedSide, en, kana })        … 答え側の「語ごとのマス数」配列（文字は落とす）。
//   maskBoardCells({ answerShape, curPos, miss }) … 受信側で語構造を filled/pending/space マス列に展開。
import { boardCursor, maskStructure, maskBoardCells, buildBoardPayload } from './boardMirror.service.js'

// ============================================================================
// 契約① boardCursor（送信側）：typedSide=seg.type、en=char 数 / ja=kanaConsumed。
// ============================================================================
describe('boardCursor（#439・送信側カーソル：typedSide/curPos）', () => {
  it('en：入力途中は打鍵文字数（apple/app → curPos:3）', () => {
    const seg = { type: 'en', en: 'apple' }
    expect(boardCursor({ seg, segInput: 'app' })).toEqual({ typedSide: 'en', curPos: 3 })
  })

  it('en：完了は語長（apple/apple → curPos:5）', () => {
    const seg = { type: 'en', en: 'apple' }
    expect(boardCursor({ seg, segInput: 'apple' })).toEqual({ typedSide: 'en', curPos: 5 })
  })

  it('en：過入力は語長で clamp（ab/abcd → curPos:2）', () => {
    const seg = { type: 'en', en: 'ab' }
    expect(boardCursor({ seg, segInput: 'abcd' })).toEqual({ typedSide: 'en', curPos: 2 })
  })

  // ==========================================================================
  // #439 バグB：複数語（英英定義）の en curPos は「空白を除いた文字数」で数える。
  //   maskBoardCells は space を進捗にカウントせず char セルで filled を数えるため、
  //   curPos が空白込みだと空白を打つたびに伏字が1つ先行して埋まる（単位不一致）。
  //   → en の curPos を空白除外の char 数へ統一する（ja=kanaConsumed は不変）。
  // ==========================================================================
  it('en 複数語：空白を除いた文字数で数える（"to make food"/"to m" → curPos:3＝t,o,m）', () => {
    const seg = { type: 'en', en: 'to make food' }
    // 現状実装は [...'to m'].length=4 を返す＝赤。空白を除くと 't','o','m'=3。
    expect(boardCursor({ seg, segInput: 'to m' })).toEqual({ typedSide: 'en', curPos: 3 })
  })

  it('en 複数語：末尾空白は進捗に数えない（"to make food"/"to make " → curPos:6＝to2+make4）', () => {
    const seg = { type: 'en', en: 'to make food' }
    expect(boardCursor({ seg, segInput: 'to make ' })).toEqual({ typedSide: 'en', curPos: 6 })
  })

  it('en 複数語：完了は空白を除いた総 char 数（"to make food" 完了 → curPos:10）', () => {
    const seg = { type: 'en', en: 'to make food' }
    expect(boardCursor({ seg, segInput: 'to make food' })).toEqual({ typedSide: 'en', curPos: 10 })
  })

  it('en 複数語：未打鍵は curPos:0', () => {
    const seg = { type: 'en', en: 'to make food' }
    expect(boardCursor({ seg, segInput: '' })).toEqual({ typedSide: 'en', curPos: 0 })
  })

  it('en 複数語：過入力は空白除外の総 char 数で clamp（"to make food xx" → curPos:10）', () => {
    const seg = { type: 'en', en: 'to make food' }
    expect(boardCursor({ seg, segInput: 'to make food xx' })).toEqual({ typedSide: 'en', curPos: 10 })
  })

  it('ja：kana 消費数で数える（太陽/たいよう・tai → curPos:2＝た・い）', () => {
    const seg = { type: 'ja', ja: '太陽', kana: 'たいよう' }
    expect(boardCursor({ seg, segInput: 'tai' })).toEqual({ typedSide: 'ja', curPos: 2 })
  })

  it('ja：未打鍵は curPos:0', () => {
    const seg = { type: 'ja', ja: '太陽', kana: 'たいよう' }
    expect(boardCursor({ seg, segInput: '' })).toEqual({ typedSide: 'ja', curPos: 0 })
  })

  it('ja：kana を全部打ち切ると curPos は kana 長（たいよう/taiyou → curPos:4）', () => {
    const seg = { type: 'ja', ja: '太陽', kana: 'たいよう' }
    expect(boardCursor({ seg, segInput: 'taiyou' })).toEqual({ typedSide: 'ja', curPos: 4 })
  })

  it('不変条件：戻り値は typedSide/curPos の2キーのみで、答えの文字（en/kana の綴り）を一切含めない', () => {
    const seg = { type: 'en', en: 'apple' }
    const out = boardCursor({ seg, segInput: 'app' })
    expect(Object.keys(out).sort()).toEqual(['curPos', 'typedSide'])
    expect(typeof out.curPos).toBe('number')
    // 綴りが値として混入していないこと（構造送信＝伏字の要）。
    expect(JSON.stringify(out)).not.toContain('apple')
    expect(JSON.stringify(out)).not.toContain('app')

    const jaSeg = { type: 'ja', ja: '太陽', kana: 'たいよう' }
    const jaOut = boardCursor({ seg: jaSeg, segInput: 'tai' })
    expect(JSON.stringify(jaOut)).not.toContain('たい')
    expect(JSON.stringify(jaOut)).not.toContain('太陽')
  })

  it('純粋：入力オブジェクトを破壊しない', () => {
    const seg = { type: 'en', en: 'apple' }
    const frozen = Object.freeze(seg)
    expect(() => boardCursor({ seg: frozen, segInput: 'ap' })).not.toThrow()
    expect(seg).toEqual({ type: 'en', en: 'apple' })
  })
})

// ============================================================================
// 契約② maskStructure（送信側）：答え側の語ごとマス数（文字を落とす）。
//   en=空白分割し各語 char 数（空語を作らない）。ja=kana 長の単一要素 [[...kana].length]。
// ============================================================================
describe('maskStructure（#439・答え側の語長構造・文字は落とす）', () => {
  it('en：語ごとの文字数配列（to make food → [2,4,4]）', () => {
    expect(maskStructure({ typedSide: 'en', en: 'to make food' })).toEqual([2, 4, 4])
  })

  it('en：単語1つは1要素（apple → [5]）', () => {
    expect(maskStructure({ typedSide: 'en', en: 'apple' })).toEqual([5])
  })

  it('en：空文字は空配列（→ []）', () => {
    expect(maskStructure({ typedSide: 'en', en: '' })).toEqual([])
  })

  it('en：連続空白・前後空白は空語を作らない（"  a  b " → [1,1]）', () => {
    expect(maskStructure({ typedSide: 'en', en: '  a  b ' })).toEqual([1, 1])
  })

  it('ja：kana 長の単一要素（たいよう → [4]）', () => {
    expect(maskStructure({ typedSide: 'ja', kana: 'たいよう' })).toEqual([4])
  })

  it('ja：kana 空は空配列（記号のみ等 → []）', () => {
    expect(maskStructure({ typedSide: 'ja', kana: '' })).toEqual([])
  })

  it('不変条件：戻り値は正整数のみ（0 や 0 長語を含めない）', () => {
    const shape = maskStructure({ typedSide: 'en', en: '  to   make  food  ' })
    expect(shape.every((n) => Number.isInteger(n) && n > 0)).toBe(true)
  })

  it('不変条件：綴り/かなの文字を戻り値に一切含めない（長さ情報のみ）', () => {
    const enShape = maskStructure({ typedSide: 'en', en: 'to make food' })
    expect(JSON.stringify(enShape)).not.toContain('make')
    expect(JSON.stringify(enShape)).not.toContain('food')
    const jaShape = maskStructure({ typedSide: 'ja', kana: 'たいよう' })
    expect(JSON.stringify(jaShape)).not.toContain('たい')
  })
})

// ============================================================================
// 契約③ maskBoardCells（受信側）：語を順に展開し語間に space マス1つ。
//   文字マスを先頭から curPos 個 filled・残り pending（space はカウント外）。
// ============================================================================
describe('maskBoardCells（#439・受信側の伏字マス列：filled/pending/space）', () => {
  // 文字マス（space 以外）だけ抽出するヘルパ。
  const charCells = (cells) => cells.filter((c) => c.kind !== 'space')

  it('shape=[2,4,4], curPos=0：全マス pending・語間に space が2つ', () => {
    const cells = maskBoardCells({ answerShape: [2, 4, 4], curPos: 0 })
    // 総マス数 = 2 + space + 4 + space + 4 = 12。
    expect(cells).toHaveLength(12)
    expect(cells.filter((c) => c.kind === 'space')).toHaveLength(2)
    expect(charCells(cells)).toHaveLength(10)
    expect(charCells(cells).every((c) => c.kind === 'pending')).toBe(true)
  })

  it('shape=[2,4,4], curPos=3：文字マスの先頭3つが filled・space は跨いでもカウントしない', () => {
    const cells = maskBoardCells({ answerShape: [2, 4, 4], curPos: 3 })
    const chars = charCells(cells)
    expect(chars.filter((c) => c.kind === 'filled')).toHaveLength(3)
    expect(chars.filter((c) => c.kind === 'pending')).toHaveLength(7)
    // 先頭3文字マスが filled、その後が pending の順序。
    expect(chars.slice(0, 3).every((c) => c.kind === 'filled')).toBe(true)
    expect(chars.slice(3).every((c) => c.kind === 'pending')).toBe(true)
  })

  it('shape=[2,4,4], curPos=10（満杯）：全文字マスが filled', () => {
    const cells = maskBoardCells({ answerShape: [2, 4, 4], curPos: 10 })
    expect(charCells(cells).every((c) => c.kind === 'filled')).toBe(true)
  })

  it('shape=[2,4,4], curPos=99（過大）：clamp で全文字マスが filled', () => {
    const cells = maskBoardCells({ answerShape: [2, 4, 4], curPos: 99 })
    const chars = charCells(cells)
    expect(chars.every((c) => c.kind === 'filled')).toBe(true)
    expect(chars).toHaveLength(10)
  })

  it('shape=[5], curPos=2, miss=true：filled2・pending3・全マスに miss:true フラグ・space なし', () => {
    const cells = maskBoardCells({ answerShape: [5], curPos: 2, miss: true })
    expect(cells.filter((c) => c.kind === 'space')).toHaveLength(0)
    expect(cells.filter((c) => c.kind === 'filled')).toHaveLength(2)
    expect(cells.filter((c) => c.kind === 'pending')).toHaveLength(3)
    expect(cells.every((c) => c.miss === true)).toBe(true)
  })

  it('miss 未指定なら各マスの miss は false', () => {
    const cells = maskBoardCells({ answerShape: [3], curPos: 1 })
    expect(cells.every((c) => c.miss === false)).toBe(true)
  })

  it('shape=[]（複製保留）：空配列を返す', () => {
    expect(maskBoardCells({ answerShape: [], curPos: 0 })).toEqual([])
  })

  it('不変条件：文字マス総数=sum(shape)・space 数=max(0,len-1)・filled 数=clamp(curPos,0,sum)', () => {
    const samples = [
      { answerShape: [2, 4, 4], curPos: 0 },
      { answerShape: [2, 4, 4], curPos: 3 },
      { answerShape: [2, 4, 4], curPos: 99 },
      { answerShape: [5], curPos: 2 },
      { answerShape: [1, 1, 1, 1], curPos: 2 },
      { answerShape: [], curPos: 5 },
    ]
    for (const s of samples) {
      const cells = maskBoardCells(s)
      const sum = s.answerShape.reduce((a, b) => a + b, 0)
      const chars = charCells(cells)
      expect(chars).toHaveLength(sum)
      expect(cells.filter((c) => c.kind === 'space')).toHaveLength(Math.max(0, s.answerShape.length - 1))
      const expectedFilled = Math.max(0, Math.min(s.curPos, sum))
      expect(cells.filter((c) => c.kind === 'filled')).toHaveLength(expectedFilled)
    }
  })

  it('不変条件：各マスは kind と miss のみ持ち、答えの文字（value/char）を持たない', () => {
    const cells = maskBoardCells({ answerShape: [2, 4, 4], curPos: 3 })
    for (const c of cells) {
      expect(['filled', 'pending', 'space']).toContain(c.kind)
      expect(typeof c.miss).toBe('boolean')
      expect(c).not.toHaveProperty('char')
      expect(c).not.toHaveProperty('value')
      expect(c).not.toHaveProperty('text')
    }
  })
})

// ============================================================================
// 契約④ buildBoardPayload（#439・送信側 board ペイロード組み立て：純ドメイン）
//   VersusMatch.container.jsx の inline 実装を純ドメインへ切り出す前提。
//   シグネチャ：buildBoardPayload({ qIndex, typedSide, word, en, ja, kana, wordJa })
//            → { qIndex, typedSide, word, wordJa?, hint, answerShape }
//   意図（答え非漏洩の要）：
//     - hint は「打っていない側（非アクティブ側）」の実テキストのみ。
//     - answerShape は答え側を maskStructure で長さ配列へ落とす（文字は載せない）。
//     - ja モード（和訳＝答え）では wordJa（見出し和訳）を出力に含めない。
//   ※ container は selfId→peerId 付与・gloss→wordJa 解決を外側で行う想定（本関数は純関数）。
// ============================================================================
describe('buildBoardPayload（#439・送信側 board ペイロード：答え非漏洩・hint 側選択・ja で wordJa 抑止）', () => {
  it('typedSide=en：hint は非答え側の日本語（text=ja, kana）／answerShape=maskStructure(en)／wordJa は保持', () => {
    const out = buildBoardPayload({
      qIndex: 0,
      typedSide: 'en',
      word: 'cook',
      en: 'to make food',
      ja: '熱を使って食材を調理する',
      kana: 'ねつをつかってしょくざいをちょうりする',
      wordJa: '料理する',
    })
    expect(out).toEqual({
      qIndex: 0,
      typedSide: 'en',
      word: 'cook',
      wordJa: '料理する',
      hint: { side: 'ja', text: '熱を使って食材を調理する', kana: 'ねつをつかってしょくざいをちょうりする' },
      answerShape: [2, 4, 4],
    })
  })

  it('typedSide=en・不変条件：答え側 en の実テキストが出力のどのフィールドにも現れない（word/wordJa/hint/answerShape）', () => {
    const out = buildBoardPayload({
      qIndex: 0,
      typedSide: 'en',
      word: 'cook',
      en: 'to make food',
      ja: '熱を使って食材を調理する',
      kana: 'ねつをつかってしょくざいをちょうりする',
      wordJa: '料理する',
    })
    const dump = JSON.stringify(out)
    // 答えは en。綴りは長さ配列 [2,4,4] にしか反映されない＝実テキストは載らない。
    expect(dump).not.toContain('to make food')
    expect(dump).not.toContain('make')
    expect(dump).not.toContain('food')
    // answerShape は正整数のみ（文字を持たない）。
    expect(out.answerShape.every((n) => Number.isInteger(n) && n > 0)).toBe(true)
  })

  it('typedSide=ja：hint は非答え側の英語（text=en・kana 無し）／wordJa キー無し／answerShape=maskStructure(kana)', () => {
    const out = buildBoardPayload({
      qIndex: 3,
      typedSide: 'ja',
      word: 'cook',
      en: 'to make food',
      ja: '熱を使って調理',
      kana: 'ねつをつかって', // 7 かな＝[7]
      wordJa: '料理する',
    })
    expect(out).toEqual({
      qIndex: 3,
      typedSide: 'ja',
      word: 'cook',
      hint: { side: 'en', text: 'to make food' },
      answerShape: [7],
    })
    // ja モードでは wordJa（見出し和訳＝答えになり得る）を出力に含めない。
    expect(out).not.toHaveProperty('wordJa')
    // hint に kana（読み＝答え）を含めない。
    expect(out.hint).not.toHaveProperty('kana')
  })

  it('typedSide=ja・不変条件：答え側 ja/kana の実テキストが出力のどのフィールドにも現れない', () => {
    const out = buildBoardPayload({
      qIndex: 3,
      typedSide: 'ja',
      word: 'cook',
      en: 'to make food',
      ja: '熱を使って調理',
      kana: 'ねつをつかって',
      wordJa: '料理する',
    })
    const dump = JSON.stringify(out)
    // 答えは ja/kana。どちらの実テキストも載らない（answerShape=長さ配列のみ）。
    expect(dump).not.toContain('ねつをつかって')
    expect(dump).not.toContain('熱を使って調理')
    expect(dump).not.toContain('料理する') // wordJa も答えになり得るため抑止。
    expect(out.answerShape).toEqual([7])
  })

  it('word は typedSide に関わらず常に保持し、qIndex/typedSide は透過する', () => {
    const en = buildBoardPayload({ qIndex: 5, typedSide: 'en', word: 'apple', en: 'a fruit', ja: '果物', kana: 'くだもの', wordJa: 'りんご' })
    expect(en.word).toBe('apple')
    expect(en.qIndex).toBe(5)
    expect(en.typedSide).toBe('en')
    const ja = buildBoardPayload({ qIndex: 7, typedSide: 'ja', word: 'apple', en: 'a fruit', ja: '果物', kana: 'くだもの', wordJa: 'りんご' })
    expect(ja.word).toBe('apple')
    expect(ja.qIndex).toBe(7)
    expect(ja.typedSide).toBe('ja')
  })

  it('防御：kana 欠落（en-only 文）でも throw せず、hint に kana キーを付けない', () => {
    const out = buildBoardPayload({ qIndex: 1, typedSide: 'en', word: 'run', en: 'to move fast', ja: '速く動く', wordJa: '走る' })
    expect(out.hint).toEqual({ side: 'ja', text: '速く動く' })
    expect(out.hint).not.toHaveProperty('kana')
    // en の答え構造は kana 非依存で算出できる。
    expect(out.answerShape).toEqual([2, 4, 4])
  })

  it('防御：wordJa 欠落（単語種目など見出し和訳なし）でも throw せず、wordJa キーを付けない', () => {
    const out = buildBoardPayload({ qIndex: 2, typedSide: 'en', word: 'sun', en: 'a star', ja: '恒星', kana: 'こうせい' })
    expect(out).not.toHaveProperty('wordJa')
    expect(out.word).toBe('sun')
    expect(out.hint).toEqual({ side: 'ja', text: '恒星', kana: 'こうせい' })
  })

  it('純粋：入力オブジェクトを破壊しない（凍結入力でも throw しない）', () => {
    const input = Object.freeze({ qIndex: 0, typedSide: 'en', word: 'cook', en: 'to make food', ja: '調理', kana: 'ちょうり', wordJa: '料理する' })
    const snapshot = { ...input }
    expect(() => buildBoardPayload(input)).not.toThrow()
    expect(input).toEqual(snapshot)
  })
})

// ============================================================================
// #439 バグB 結合回帰：boardCursor → maskBoardCells の単位一致。
//   空白込み curPos だと空白を打つたび伏字が先走る（filled 過多）。en の curPos を
//   空白除外に統一すれば「filled 数＝実際に打った非空白文字数」で char セルと一致する。
// ============================================================================
describe('boardCursor→maskBoardCells 結合（#439・filled 数＝非空白打鍵文字数で単位一致）', () => {
  const charCells = (cells) => cells.filter((c) => c.kind !== 'space')

  it('shape=[2,4,4], en "to make food" を "to m" まで → filled=3（空白は進捗に数えない）', () => {
    const seg = { type: 'en', en: 'to make food' }
    const { typedSide, curPos } = boardCursor({ seg, segInput: 'to m' })
    const answerShape = maskStructure({ typedSide, en: seg.en })
    expect(answerShape).toEqual([2, 4, 4])
    const cells = maskBoardCells({ answerShape, curPos })
    // 実際に打った非空白文字は t,o,m の3つ＝伏字も3マスだけ filled（先走らない）。
    expect(charCells(cells).filter((c) => c.kind === 'filled')).toHaveLength(3)
  })

  it('shape=[2,4,4], "to make " まで（末尾空白）→ filled=6（空白でカーソルが前進しない）', () => {
    const seg = { type: 'en', en: 'to make food' }
    const { typedSide, curPos } = boardCursor({ seg, segInput: 'to make ' })
    const answerShape = maskStructure({ typedSide, en: seg.en })
    const cells = maskBoardCells({ answerShape, curPos })
    expect(charCells(cells).filter((c) => c.kind === 'filled')).toHaveLength(6)
  })
})
