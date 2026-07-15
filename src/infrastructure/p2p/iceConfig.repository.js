// #426 対戦基盤スライス2：ICE 構成（LAN / STUN）の永続化と、モードごとの RTCIceServer 変換。
// 同一 LAN 内なら STUN 不要（'lan'＝サーバ無し）、別 NAT を跨ぐ検証用に公開 STUN を使う（'stun'）。
// soundSettings.repository.js と同型：既定へ安全側フォールバック・読み書きは例外を握りつぶす
// ベストエフォート（設定の失敗で対戦を妨げない）。純データ変換 iceServersFor は localStorage 非依存。

const STORAGE_KEY = 'versus-ice-mode'

// 妥当な ICE モードの集合。既定は 'lan'（STUN なし＝同一 LAN 前提）。
const VALID_MODES = new Set(['lan', 'stun'])
const DEFAULT_MODE = 'lan'

// 現在の ICE モードを返す。未設定・破損値・localStorage 不在なら既定 'lan'（安全側）。
export function getIceMode() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return VALID_MODES.has(raw) ? raw : DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
  }
}

// ICE モードを保存する。'lan'|'stun' 以外は無視（既存値を変えない）。保存失敗は握りつぶす。
export function setIceMode(mode) {
  if (!VALID_MODES.has(mode)) return
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // 保存できなくてもセッション内の呼び出し側の指定は活きる（ベストエフォート）。
  }
}

// モードから RTCPeerConnection へ渡す iceServers 配列を導出する（純データ変換）。
//   'lan'  → [] （STUN/TURN なし＝ホスト候補のみ＝同一 LAN 内で直結）
//   'stun' → 公開 STUN 2 冗長（別 NAT 越えの疎通確認用。TURN は使わない＝リレー無し）
export function iceServersFor(mode) {
  if (mode === 'stun') {
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ]
  }
  return []
}
