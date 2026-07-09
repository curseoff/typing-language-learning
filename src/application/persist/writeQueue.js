// #266 Phase3a: write-through 用の FIFO 直列キュー（純ロジック・exec は注入）。
// メモリ像を同期更新した後、その差分書き込みを Worker へ fire-and-forget で流す口。
// - FIFO 直列：前の exec が settle（成功/失敗どちらでも）してから次を実行する（単一ライター整合）。
// - fire-and-forget：enqueue は同期に返る（Promise を返さない）。書き込み完了は待たせない。
// - 失敗継続：exec が reject しても握りつぶして後続を止めない（1件の書き込み失敗で詰まらせない）。
// - ready-gate：not-ready の間は保留し、setReady(true) で保留分を投入順にドレインする
//   （起動時 hydration 完了までは書き込みを溜めておくため）。
export function createWriteQueue(exec) {
  const queue = []
  let ready = false
  let running = false
  const waiters = [] // flush() の解決待ち（キューが空かつ非実行になったら全て解決する）

  // 保留分を投入し終え、かつ実行中が無くなったら flush 待ちを一斉に解決する。
  function settleFlush() {
    if (running || queue.length > 0) return
    while (waiters.length) waiters.shift()()
  }

  function drain() {
    if (running || !ready || queue.length === 0) {
      settleFlush()
      return
    }
    running = true
    const op = queue.shift()
    // Promise.resolve().then で包み、exec の同期 throw も reject として拾って継続する。
    Promise.resolve()
      .then(() => exec(op))
      .catch(() => {})
      .finally(() => {
        running = false
        drain()
      })
  }

  return {
    enqueue(op) {
      queue.push(op)
      drain()
    },
    setReady(r) {
      ready = r
      if (ready) drain()
    },
    // 保留分を drain して「キューが空 & 非実行」になるまで待つ（#267 export 前の flush）。
    // 既に空なら即解決。not-ready で溜まっている場合は setReady(true) で消化後に解決する。
    flush() {
      if (!running && queue.length === 0) return Promise.resolve()
      return new Promise((resolve) => {
        waiters.push(resolve)
      })
    },
  }
}
