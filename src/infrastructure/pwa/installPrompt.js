// PWA インストール導線の薄い配線（infrastructure）。React/DOM ロジックに依存しない
// ブラウザ API 購読ユーティリティ。beforeinstallprompt を捕捉して deferredPrompt を保持し、
// 任意のタイミングでネイティブのインストールプロンプトを出せるようにする。
//
// module 評価時（トップレベル）に早期購読する：beforeinstallprompt は load 前後に発火し得るため、
// コンポーネント mount を待つと取りこぼす（SW 登録漏れ #169 の教訓）。window/matchMedia 不在
// （SSR/テスト）では安全に no-op（＝導線なし）。

// 直近の beforeinstallprompt イベント。prompt() を呼べる間だけ保持し、消費したら null に戻す。
let deferredPrompt = null

// 状態変化（canInstall の true/false 切り替わり）を購読するリスナ集合。
const listeners = new Set()

// 全リスナへ変化を通知する。
function notify() {
  for (const listener of listeners) listener()
}

// 既にインストール済みで起動しているか（standalone 表示）。true なら導線は不要。
function isStandalone() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(display-mode: standalone)').matches
}

// deferredPrompt を破棄して状態変化を通知する（導線を消す）。
function discard() {
  if (deferredPrompt === null) return
  deferredPrompt = null
  notify()
}

// module 評価時にトップレベルで購読する。addEventListener が無い環境（SSR/テスト）では no-op。
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  // beforeinstallprompt：既定の自動プロンプトを抑止し、イベントを保持して任意発火に回す。
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    // standalone 起動中（インストール済み）は導線を出さない。
    if (isStandalone()) return
    deferredPrompt = event
    notify()
  })
  // インストール完了後は導線を消す。
  window.addEventListener('appinstalled', () => {
    discard()
  })
}

// 現在インストール導線を出せるか（deferredPrompt を保持しているか）を返す。
export function canInstall() {
  return deferredPrompt !== null
}

// canInstall の変化を購読し、変化のたびに listener() を呼ぶ。戻り値は購読解除関数。
export function subscribeInstall(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// ネイティブのインストールプロンプトを表示する。prompt()→userChoice を待ち、結果に関わらず
// deferredPrompt を消費して null 化＋購読者へ通知（導線は消える）。戻り値は outcome 文字列
// （'accepted' / 'dismissed'）。導線が無い場合は何もせず null を返す。
export async function promptInstall() {
  const prompt = deferredPrompt
  if (prompt === null) return null
  prompt.prompt()
  const choice = await prompt.userChoice
  discard() // 一度使ったプロンプトは再利用不可。消費して導線を消す。
  return choice?.outcome ?? null
}
