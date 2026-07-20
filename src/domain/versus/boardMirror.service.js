// #439 対戦：相手カードに盤面複製（伏字）＝方式B（構造送信）の純ドメイン。
// 答えの文字はワイヤーにも戻り値にも一切載せない（長さ情報＝マス数のみ）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的・入力非破壊。
//   boardCursor({ seg, segInput })                … 送信側で「打っている側」と表示単位進捗を導く（en=char / ja=kana）。
//   maskStructure({ typedSide, en, kana })        … 答え側の「語ごとのマス数」配列（文字は落とす）。
//   maskBoardCells({ answerShape, curPos, miss }) … 受信側で語構造を filled/pending/space マス列に展開。
import { kanaConsumed } from '@tll/core'

// 値を [lo, hi] に丸める（防御 clamp）。NaN/非数は lo に寄せる。
function clamp(n, lo, hi) {
  if (!(typeof n === 'number' && Number.isFinite(n))) return lo
  if (n < lo) return lo
  if (n > hi) return hi
  return n
}

// 契約①：送信側カーソル。typedSide=seg.type、en=char 数（語長で clamp）/ ja=kanaConsumed。
// 戻り値は { typedSide, curPos } の2キーのみ＝綴り/かなの文字を一切含めない。
export function boardCursor({ seg, segInput }) {
  const typedSide = seg.type
  const input = typeof segInput === 'string' ? segInput : ''
  if (typedSide === 'ja') {
    const kana = typeof seg.kana === 'string' ? seg.kana : ''
    const kanaLen = [...kana].length
    const curPos = clamp(kanaConsumed(kana, input), 0, kanaLen)
    return { typedSide: 'ja', curPos }
  }
  // en（既定）：打鍵の「非空白」文字数を、答え側の非空白文字数で clamp。
  //   maskBoardCells は space を進捗にカウントせず char セルで filled を数えるため、
  //   空白込みで数えると空白を打つたび伏字が1マス先走る（#439 バグB）。単位を非空白 char で揃える。
  const nonSpace = (s) => [...(typeof s === 'string' ? s : '')].filter((ch) => !/\s/.test(ch)).length
  const enLen = nonSpace(seg.en)
  const curPos = clamp(nonSpace(input), 0, enLen)
  return { typedSide: 'en', curPos }
}

// 契約②：答え側の「語ごとのマス数」配列（文字は落とす＝長さのみ）。
//   en=空白分割し各語の文字数（空語を作らない）。ja=kana 長の単一要素（空なら []）。
export function maskStructure({ typedSide, en, kana }) {
  if (typedSide === 'ja') {
    const s = typeof kana === 'string' ? kana : ''
    const len = [...s].length
    return len > 0 ? [len] : []
  }
  const s = typeof en === 'string' ? en : ''
  return s
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => [...w].length)
}

// 契約④：送信側 board ペイロード組み立て（純ドメイン）。
//   ワイヤーへ出すのは「人に見せてよい」word/wordJa/hint（非答え側の実テキスト）と answerShape（長さ配列）だけ。
//   答え側の綴り/かなは maskStructure で長さ配列へ落とし、文字は一切載せない（答え非漏洩の要）。
//   hint は打っていない側（en を打つなら日本語ヒント／ja を打つなら英語ヒント）の実テキスト。
//   wordJa（見出し和訳）は en モードでは表示可だが、ja モード（和訳が答え）では付けない。
//   peerId は container が selfId から外付けする（本関数は純関数・入力非破壊）。
export function buildBoardPayload({ qIndex, typedSide, word, en, ja, kana, wordJa }) {
  const answerShape = maskStructure({ typedSide, en, kana })
  const hint =
    typedSide === 'en'
      ? { side: 'ja', text: ja ?? '', ...(kana != null ? { kana } : {}) }
      : { side: 'en', text: en ?? '' }
  const payload = { qIndex, typedSide, word, hint, answerShape }
  if (typedSide !== 'ja' && typeof wordJa === 'string' && wordJa) payload.wordJa = wordJa
  return payload
}

// 契約③：受信側の伏字マス列。語を順に展開し、語間に space マスを1つ挿入。
//   文字マス（filled/pending）を先頭から curPos 個 filled・残り pending（space はカウント外）。
export function maskBoardCells({ answerShape, curPos, miss }) {
  if (!Array.isArray(answerShape) || answerShape.length === 0) return []
  const missFlag = miss === true
  const sum = answerShape.reduce((a, b) => a + b, 0)
  const filledCount = clamp(curPos, 0, sum)
  const cells = []
  let charIndex = 0
  answerShape.forEach((wordLen, wi) => {
    if (wi > 0) cells.push({ kind: 'space', miss: missFlag })
    for (let i = 0; i < wordLen; i += 1) {
      const kind = charIndex < filledCount ? 'filled' : 'pending'
      cells.push({ kind, miss: missFlag })
      charIndex += 1
    }
  })
  return cells
}
