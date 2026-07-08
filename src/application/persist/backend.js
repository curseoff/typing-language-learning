// #266 Phase3a: 永続化バックエンドの選択（純関数・DOM/infra 非依存）。
// resolvePersistBackend＝入力ソース（url/ls/env）の優先順で希望バックエンドを決める。
// chooseBackend＝希望と実行環境の能力フラグから、実際に使えるバックエンドへ縮退する。
// 既定は 'local'（挙動不変のキルスイッチ）。

// 受理する値は 'local' | 'sqlite' のみ。trim＋小文字化して判定し、無効値は null（＝スキップ）。
const VALID = new Set(['local', 'sqlite'])

function normalize(v) {
  if (typeof v !== 'string') return null
  const t = v.trim().toLowerCase()
  return VALID.has(t) ? t : null
}

// url > ls > env の優先順で最初に有効な値を採用し、全て無効なら既定 'local'。
export function resolvePersistBackend({ url, ls, env } = {}) {
  return normalize(url) ?? normalize(ls) ?? normalize(env) ?? 'local'
}

// desired が sqlite でも、OPFS/Worker/Web Locks の能力が1つでも欠ければ local へ縮退する。
// desired が local なら能力に関係なく local（キルスイッチで確実に現行維持）。
export function chooseBackend({ desired, opfsOk, workerOk, locksSupported }) {
  if (desired === 'sqlite' && opfsOk && workerOk && locksSupported) return 'sqlite'
  return 'local'
}
