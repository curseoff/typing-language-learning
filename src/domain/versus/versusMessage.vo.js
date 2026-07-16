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
