// #426 対戦基盤スライス1：P2P メッセージの検証/整形（信頼境界＝untrusted 入力）の Value Object。
// parseMessage(obj)          … 受信（untrusted）。不正入力は決して throw せず null。正常は正規化した message。
// buildMessage(type, payload) … 送信（自コード＝trusted）。不正/未知/空 type は throw。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。
import { parseMatchConfig } from './matchConfig.vo.js'

// 送受信で扱うメッセージ型の集合。#432 で穴埋め対戦の propose/vote/start を追加。
const KNOWN_TYPES = new Set([
  'progress',
  'countdown',
  'finished',
  'peerLeft',
  'hello',
  'propose',
  'vote',
  'start',
  'abort',
  'matchEnd',
  'board',
])

// 非空文字列か（peerId 等の識別子用）。
function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0
}

// 非負の有限数か（typed/mistakes/keys/elapsedMs/at 等のカウンタ・時刻用）。
function isNonNegFinite(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

// 非負の整数か（seed 用。0 可）。
function isNonNegInt(v) {
  return Number.isInteger(v) && v >= 0
}

// 各型ごとのバリデータ＋正規化。妥当なら「規定フィールドのみ」の新オブジェクトを返し、不正なら null。
// untrusted 入力なので余計なフィールドは落とす（安全側）。
const PARSERS = {
  progress(obj) {
    if (!isNonEmptyString(obj.peerId)) return null
    if (!isNonNegFinite(obj.typed)) return null
    if (!(isNonNegFinite(obj.total) && obj.total >= 1)) return null
    if (!isNonNegFinite(obj.mistakes)) return null
    if (!isNonNegFinite(obj.at)) return null
    const out = {
      type: 'progress',
      peerId: obj.peerId,
      typed: obj.typed,
      total: obj.total,
      mistakes: obj.mistakes,
      at: obj.at,
    }
    // #432 任意フィールド：妥当なら保持、型不正は省略（基本 progress は無効化しない＝後方互換）。
    if (isNonNegFinite(obj.correct)) out.correct = obj.correct
    if (Number.isInteger(obj.lives)) out.lives = obj.lives
    // #432 相手カードの速度・時間：非負有限数なら保持、不正は省略（correct/lives と同方針）。
    if (isNonNegFinite(obj.speed)) out.speed = obj.speed
    if (isNonNegFinite(obj.elapsedMs)) out.elapsedMs = obj.elapsedMs
    // #437 伏せ字マスバー：量子化済み cells（非負整数）と miss（厳格 boolean）を後方互換で保持。
    if (Number.isInteger(obj.cells) && obj.cells >= 0) out.cells = obj.cells
    if (typeof obj.miss === 'boolean') out.miss = obj.miss
    // #439 盤面複製（方式B）：board との突合キー qIndex・打鍵側 typedSide・表示単位進捗 curPos を後方互換で保持。
    // 不正はキー省略・progress 自体は無効化しない（cells/miss と同方針）。答えの文字は載せない。
    if (isNonNegInt(obj.qIndex)) out.qIndex = obj.qIndex
    if (obj.typedSide === 'en' || obj.typedSide === 'ja') out.typedSide = obj.typedSide
    if (isNonNegInt(obj.curPos)) out.curPos = obj.curPos
    return out
  },
  countdown(obj) {
    if (!isNonNegFinite(obj.startAt)) return null
    return { type: 'countdown', startAt: obj.startAt }
  },
  finished(obj) {
    if (!isNonEmptyString(obj.peerId)) return null
    if (!isNonNegFinite(obj.keys)) return null
    if (!isNonNegFinite(obj.mistakes)) return null
    if (!isNonNegFinite(obj.elapsedMs)) return null
    return {
      type: 'finished',
      peerId: obj.peerId,
      keys: obj.keys,
      mistakes: obj.mistakes,
      elapsedMs: obj.elapsedMs,
    }
  },
  peerLeft(obj) {
    if (!isNonEmptyString(obj.peerId)) return null
    return { type: 'peerLeft', peerId: obj.peerId }
  },
  hello(obj) {
    if (!isNonEmptyString(obj.peerId)) return null
    const out = { type: 'hello', peerId: obj.peerId }
    // name は省略可。文字列のときだけ保持する。
    if (typeof obj.name === 'string') out.name = obj.name
    return out
  },
  // #432 対戦設定の提案。config は parseMatchConfig で検証（null なら propose 全体を無効化）。
  propose(obj) {
    if (!isNonEmptyString(obj.peerId)) return null
    if (!isNonNegInt(obj.seed)) return null
    const config = parseMatchConfig(obj.config)
    if (config === null) return null
    return { type: 'propose', peerId: obj.peerId, config, seed: obj.seed }
  },
  // #432 提案への賛否。accept は厳格 boolean（1/'true'/null 等は不正）。
  vote(obj) {
    if (!isNonEmptyString(obj.peerId)) return null
    if (typeof obj.accept !== 'boolean') return null
    return { type: 'vote', peerId: obj.peerId, accept: obj.accept }
  },
  // #432 確定した対戦設定の冪等配布（peerId は持たない）。config は parseMatchConfig で検証。
  start(obj) {
    if (!isNonNegInt(obj.seed)) return null
    const config = parseMatchConfig(obj.config)
    if (config === null) return null
    return { type: 'start', config, seed: obj.seed }
  },
  // #432 ESC でロビーへ戻ったことを相手へ通知（peerId 必須・余計なフィールドは落とす）。
  abort(obj) {
    if (!isNonEmptyString(obj.peerId)) return null
    return { type: 'abort', peerId: obj.peerId }
  },
  // #432 ホストが対戦終了を全員へ配布（ペイロードなし・余計なフィールドは落とす）。
  matchEnd() {
    return { type: 'matchEnd' }
  },
  // #439 盤面複製（方式B）：問題境界（qIndex/typedSide 変化時）で送る低頻度の構造メッセージ。
  // 答えの文字（定義文/和訳/例文の綴り・かな）は一切含めず、answerShape は長さ情報のみ。
  board(obj) {
    // 必須（いずれか不正なら board 全体 null）。
    if (!isNonEmptyString(obj.peerId)) return null
    if (!isNonNegInt(obj.qIndex)) return null
    if (!(obj.typedSide === 'en' || obj.typedSide === 'ja')) return null
    if (typeof obj.word !== 'string') return null
    const out = { type: 'board', peerId: obj.peerId, qIndex: obj.qIndex, typedSide: obj.typedSide, word: obj.word }
    // wordJa（表示可・任意）：文字列のときだけ保持（ja モードは送られない＝和訳が答え）。
    if (typeof obj.wordJa === 'string') out.wordJa = obj.wordJa
    // hint（表示する側の実テキスト）：オブジェクトで side∈{en,ja} かつ text 文字列のときだけ保持。
    // 不正なら hint キーを落として board は生存（ヒント無しでもマス複製は出る）。
    const h = obj.hint
    if (h && typeof h === 'object' && (h.side === 'en' || h.side === 'ja') && typeof h.text === 'string') {
      const hint = { side: h.side, text: h.text }
      // kana（ja ヒントのルビ用）は文字列のときだけ保持。
      if (typeof h.kana === 'string') hint.kana = h.kana
      out.hint = hint
    }
    // answerShape（答え側の語ごとマス数）：配列かつ全要素が正整数かつ長さ≤64 のときだけ保持。
    // それ以外は落として board 生存（65以上は丸ごと落とす＝切詰めない）。
    const shape = obj.answerShape
    if (
      Array.isArray(shape) &&
      shape.length <= 64 &&
      shape.every((n) => Number.isInteger(n) && n > 0)
    ) {
      out.answerShape = shape
    }
    return out
  },
}

// 受信メッセージを検証/正規化する。どんな入力でも throw せず、不正なら null を返す。
export function parseMessage(obj) {
  // 非オブジェクト・null・配列は不正。
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return null
  const parser = PARSERS[obj.type]
  if (!parser) return null
  try {
    return parser(obj)
  } catch {
    // 悪意入力（getter が throw する等）でも境界で握りつぶし null を返す。
    return null
  }
}

// 送信メッセージを組み立てる（自コード＝trusted）。未知/空 type は throw。
export function buildMessage(type, payload = {}) {
  if (!isNonEmptyString(type) || !KNOWN_TYPES.has(type)) {
    throw new Error(`buildMessage: 未知または不正な type: ${String(type)}`)
  }
  return { type, ...payload }
}
