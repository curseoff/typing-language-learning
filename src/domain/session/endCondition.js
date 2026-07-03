// セッションの終了条件を判定する純粋関数群（#208 段0）。
// endCondition={kind,value}、progress={elapsedMs,keys,items,mistakes}。
// React/DOM/Date/performance 非依存・副作用なし・決定的に保つ（時間の計測は呼び出し側で行い、
// この層は渡された progress の数値だけで判定する）。
//
// kind の意味：
//   time    … value 秒の経過で終了（elapsedMs はミリ秒）
//   chars   … value 文字の打鍵で終了（keys）
//   items   … value 問題の消化で終了（items）
//   life    … value 回のミスで終了（mistakes）＝ライフ制
//   endless … 終了条件なし（常に false）

// 既定の終了条件（60 秒）。
const DEFAULT_END_CONDITION = { kind: 'time', value: 60 }

// 終了に達したか。未知 kind は false（勝手に終了させないフェイルセーフ）。
export function shouldFinish(endCondition, progress) {
  const { kind, value } = endCondition
  const elapsedMs = progress.elapsedMs ?? 0
  const keys = progress.keys ?? 0
  const items = progress.items ?? 0
  const mistakes = progress.mistakes ?? 0
  switch (kind) {
    case 'time':
      return elapsedMs >= value * 1000
    case 'chars':
      return keys >= value
    case 'items':
      return items >= value
    case 'life':
      return mistakes >= value
    case 'endless':
      return false
    default:
      return false
  }
}

// 入力を終了条件へ正規化する。null/undefined は既定に落とす。
export function normalizeEndCondition(input) {
  if (input == null) return { ...DEFAULT_END_CONDITION }
  return { kind: input.kind, value: input.value }
}

// カウントダウンタイマーの制限時間(ms)。時間制は value 秒＝value*1000、
// それ以外の kind は当面は既定60秒相当（#208 段1a・items/life/chars/endless は後段で対応）。
export function endLimitMs(input) {
  const { kind, value } = normalizeEndCondition(input)
  if (kind === 'time') return value * 1000
  return DEFAULT_END_CONDITION.value * 1000
}

// 0..1 の進捗率。value<=0・endless・欠損は 0（ゼロ除算回避）、超過は 1 に clamp。
export function progressRatio(endCondition, progress) {
  const { kind, value } = endCondition
  const elapsedMs = progress.elapsedMs ?? 0
  const keys = progress.keys ?? 0
  const items = progress.items ?? 0
  const mistakes = progress.mistakes ?? 0
  let ratio
  switch (kind) {
    case 'time':
      ratio = value > 0 ? elapsedMs / (value * 1000) : 0
      break
    case 'chars':
      ratio = value > 0 ? keys / value : 0
      break
    case 'items':
      ratio = value > 0 ? items / value : 0
      break
    case 'life':
      ratio = value > 0 ? mistakes / value : 0
      break
    default:
      // endless・未知 kind は進捗率の概念が無い。
      return 0
  }
  return Math.min(1, Math.max(0, ratio))
}
