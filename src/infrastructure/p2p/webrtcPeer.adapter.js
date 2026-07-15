// #426 対戦基盤スライス2：RTCPeerConnection + RTCDataChannel の薄い配線（ブラウザ API アダプタ）。
// 責務分離：ここは SDP を「素の記述オブジェクト（RTCSessionDescriptionInit）」で受け渡すだけで、
// 貼り付け用の文字列コーデックは manualSignaling.adapter.js が担う（webrtcPeer はコード文字列を知らない）。
// non-trickle：ICE 候補を trickle せず、gathering 完了まで待った localDescription を丸ごと相手へ渡す
// （手動シグナリング＝1 往復のコピペで済ませるため）。
//
// jsdom/node に RTCPeerConnection は無く実挙動を単体計測できない＝coverage 除外（vite.config.js）。
// 実挙動（offer/answer 交換・DataChannel open・送受信・切断）は pwa-verifier の実ブラウザ検証で担保する。

// ICE gathering が complete になるまで待つ（non-trickle 用）。既に complete なら即解決。
function waitForIceGathering(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    // 収集完了か、フェイルセーフのタイムアウト（環境によっては complete に至らないことがある）で解決。
    const done = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', done)
        clearTimeout(timer)
        resolve()
      }
    }
    const timer = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', done)
      resolve()
    }, 3000)
    pc.addEventListener('icegatheringstatechange', done)
  })
}

// DataChannel に open/close/message のハンドラを配線する共通処理。
function wireDataChannel(channel, { onMessage, onOpen, onClose }) {
  channel.onopen = () => onOpen?.()
  channel.onclose = () => onClose?.()
  channel.onmessage = (ev) => onMessage?.(ev.data)
}

// ピアを生成する。iceServers はモードに応じて iceConfig.iceServersFor(mode) から渡す。
//   onMessage(data) … DataChannel 受信（生の string）
//   onOpen()/onClose() … 接続の確立/切断
export function createPeer({ iceServers = [], onMessage, onOpen, onClose } = {}) {
  const pc = new RTCPeerConnection({ iceServers })
  // ホストが作る DataChannel をここに保持する（send/close で参照）。
  let channel = null

  // 接続状態の変化でも切断を拾う（DataChannel の close 前に落ちる場合の保険）。
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') onClose?.()
  }

  return {
    // ホスト：DataChannel を作り offer を生成、ICE 収集完了まで待って localDescription を返す。
    async createOffer() {
      channel = pc.createDataChannel('versus')
      wireDataChannel(channel, { onMessage, onOpen, onClose })
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await waitForIceGathering(pc)
      return pc.localDescription
    },

    // ホスト：相手の answer を受理して接続を確立する。
    async acceptAnswer(desc) {
      await pc.setRemoteDescription(desc)
    },

    // ゲスト：offer を受理→answer を生成、ICE 収集完了まで待って localDescription を返す。
    // DataChannel は ondatachannel で受け取り配線する。
    async acceptOffer(desc) {
      pc.ondatachannel = (ev) => {
        channel = ev.channel
        wireDataChannel(channel, { onMessage, onOpen, onClose })
      }
      await pc.setRemoteDescription(desc)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await waitForIceGathering(pc)
      return pc.localDescription
    },

    // DataChannel 経由で文字列メッセージを送る。未確立/クローズ済みなら黙って捨てる（送信は best-effort）。
    send(msg) {
      if (channel && channel.readyState === 'open') channel.send(msg)
    },

    // 接続を閉じる（DataChannel と PeerConnection の両方）。
    close() {
      try {
        channel?.close()
      } catch {
        // 既に閉じている等は無視。
      }
      try {
        pc.close()
      } catch {
        // 同上。
      }
    },
  }
}
