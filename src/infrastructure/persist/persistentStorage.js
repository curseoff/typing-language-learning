// #267 [#264 Phase4] 耐久＝navigator.storage.persist() で eviction（ストレージ回収）を抑止する。
// 起動時（sqlite 経路の hydrate 前後）に一度だけ永続化を明示取得し、可否をログに残す。
// 取得できなくてもアプリは止めない（縮退）＝戻り値は「永続化されているか」の bool のみ。
// ブラウザ API（navigator.storage）の薄い配線なので coverage 対象外（registerSW.js と同種）。
export async function ensurePersistentStorage() {
  try {
    const storage = navigator.storage
    if (!storage || typeof storage.persist !== 'function') return false
    // 既に永続化済みなら再取得しない（プロンプト無し・多重呼び出しを避ける）。
    if (typeof storage.persisted === 'function' && (await storage.persisted())) {
      return true
    }
    const granted = await storage.persist()
    console.info(`[persist] navigator.storage.persist() = ${granted}`)
    return granted
  } catch (e) {
    // 取得失敗は致命ではない（eviction のリスクが残るだけ）＝警告のみで続行。
    console.warn('[persist] 永続ストレージの取得に失敗（続行します）。', e)
    return false
  }
}
