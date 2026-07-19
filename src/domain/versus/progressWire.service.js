// #439 バグA：progress 送信のフィールド選別を純ドメインへ切り出す。
// useVersus.sendProgress が手動ホワイトリストで payload を再構築する際、#439 で足した
// qIndex/typedSide/curPos を取りこぼしていた（相手カードの複製が実環境で出ない）ため、
// 「どのキーを転送するか」を1箇所に集約して取りこぼしの再発を防ぐ。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的・入力非破壊。

// 転送するフィールドのホワイトリスト（peerId/at は呼び出し側＝useVersus が付与する）。
const WIRE_KEYS = [
  'typed',
  'total',
  'mistakes',
  'correct',
  'lives',
  'speed',
  'elapsedMs',
  'cells',
  'miss',
  'qIndex',
  'typedSide',
  'curPos',
]

// 入力から定義済み（!== undefined）のホワイトリストキーだけを写した新オブジェクトを返す。
// 0/false は保持し（!== undefined 判定）、未定義キーとホワイトリスト外キーは省く。入力非破壊。
export function pickProgressFields(input) {
  const src = input && typeof input === 'object' ? input : {}
  const out = {}
  for (const key of WIRE_KEYS) {
    if (src[key] !== undefined) out[key] = src[key]
  }
  return out
}
