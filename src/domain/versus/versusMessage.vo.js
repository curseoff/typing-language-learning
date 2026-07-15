// #426 対戦基盤スライス1：P2P メッセージの検証/整形（信頼境界＝untrusted 入力）の Value Object。
// parseMessage(obj)          … 受信（untrusted）。不正入力は決して throw せず null。正常は正規化した message。
// buildMessage(type, payload) … 送信（自コード＝trusted）。不正/未知/空 type は throw。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。

// 送受信で扱うメッセージ型の集合。
const KNOWN_TYPES = new Set(['progress', 'countdown', 'finished', 'peerLeft', 'hello'])

// 非空文字列か（peerId 等の識別子用）。
function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0
}

// 非負の有限数か（typed/mistakes/keys/elapsedMs/at 等のカウンタ・時刻用）。
function isNonNegFinite(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
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
    return {
      type: 'progress',
      peerId: obj.peerId,
      typed: obj.typed,
      total: obj.total,
      mistakes: obj.mistakes,
      at: obj.at,
    }
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
