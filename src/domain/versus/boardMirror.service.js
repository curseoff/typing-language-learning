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
  // en（既定）：打鍵文字数を語長で clamp。
  const enLen = [...(typeof seg.en === 'string' ? seg.en : '')].length
  const curPos = clamp([...input].length, 0, enLen)
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
