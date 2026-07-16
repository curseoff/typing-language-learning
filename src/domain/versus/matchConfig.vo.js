// #432 P2P 穴埋め対戦：対戦設定（MatchConfig）の Value Object。
// 両プレイヤーが同じ設定で対戦するための「合意された対戦条件」を表す不変・自己検証・値等価の VO。
// makeMatchConfig(input)  … trusted builder（自コード）。妥当なら正規化した凍結オブジェクトを返し、不正は throw。
// parseMatchConfig(obj)   … untrusted 入力（ワイヤ由来）。どんな入力でも throw せず、妥当なら正規化・不正なら null。
// matchConfigEquals(a, b) … 両者が妥当な MatchConfig で全フィールド一致なら true（throw しない）。
// 純ドメイン：React/DOM/乱数 非依存・副作用なし・決定的。endCondition は endCondition.vo.js を土台にする。
import { isEndCondition, endConditionEquals, makeEndCondition } from '../session/endCondition.vo.js'

// 許可する値の集合。
const GAME_TYPES = new Set(['wsent', 'words', 'dict'])
const MODES = new Set(['both', 'en', 'ja'])

// 1 以上の整数か（level・range の正整数用）。0/負/非整数/非数は false。
function isPositiveInt(v) {
  return Number.isInteger(v) && v >= 1
}

// フィールドを検証し「規定フィールドのみ」の凍結オブジェクトへ正規化する。不変条件違反は throw。
// makeMatchConfig（そのまま throw）と parseMatchConfig（try/catch で null 化）の共通コア。
function validateAndNormalize({ gameType, level, theme, range, mode, endCondition, learningMode }) {
  if (typeof gameType !== 'string' || !GAME_TYPES.has(gameType)) {
    throw new Error(`makeMatchConfig: gameType が不正: ${String(gameType)}`)
  }
  if (!isPositiveInt(level)) {
    throw new Error(`makeMatchConfig: level は 1 以上の整数が必要: ${String(level)}`)
  }
  if (typeof theme !== 'string' || theme.length === 0) {
    throw new Error(`makeMatchConfig: theme は非空文字列が必要: ${String(theme)}`)
  }
  if (!(range === null || isPositiveInt(range))) {
    throw new Error(`makeMatchConfig: range は null または 1 以上の整数が必要: ${String(range)}`)
  }
  if (typeof mode !== 'string' || !MODES.has(mode)) {
    throw new Error(`makeMatchConfig: mode が不正: ${String(mode)}`)
  }
  if (learningMode !== 'cloze') {
    throw new Error(`makeMatchConfig: learningMode は 'cloze' のみ許可: ${String(learningMode)}`)
  }
  if (!isEndCondition(endCondition) || endCondition.kind === 'endless') {
    throw new Error(`makeMatchConfig: endCondition は endless 以外の妥当な終了条件が必要`)
  }
  // endCondition は常に凍結 VO へ正規化する（ワイヤ形 {kind,value} も VO も同一表現になる）。
  const ec = makeEndCondition(endCondition.kind, endCondition.value)
  return Object.freeze({ gameType, level, theme, range, mode, endCondition: ec, learningMode })
}

// trusted builder。妥当なら凍結した正規化オブジェクト、不正は throw（makeEndCondition と同じ作法）。
export function makeMatchConfig(input) {
  return validateAndNormalize(input)
}

// untrusted 入力（ワイヤ由来）を検証/正規化する。どんな入力でも throw せず、不正なら null。
export function parseMatchConfig(obj) {
  // 非オブジェクト・null・配列は不正。
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return null
  try {
    return validateAndNormalize(obj)
  } catch {
    // 悪意入力（getter が throw する等）・不正値でも境界で握りつぶし null を返す。
    return null
  }
}

// 型ガード（throw しない）。x が妥当な MatchConfig の形なら true。
function isMatchConfig(x) {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return false
  try {
    return (
      GAME_TYPES.has(x.gameType) &&
      isPositiveInt(x.level) &&
      typeof x.theme === 'string' &&
      x.theme.length > 0 &&
      (x.range === null || isPositiveInt(x.range)) &&
      MODES.has(x.mode) &&
      x.learningMode === 'cloze' &&
      isEndCondition(x.endCondition) &&
      x.endCondition.kind !== 'endless'
    )
  } catch {
    return false
  }
}

// 値等価（throw しない）。両者が妥当な MatchConfig で全フィールド一致すれば true。
// endCondition は endConditionEquals で比較、他は厳密等価。不正/null は false。
export function matchConfigEquals(a, b) {
  if (!isMatchConfig(a) || !isMatchConfig(b)) return false
  return (
    a.gameType === b.gameType &&
    a.level === b.level &&
    a.theme === b.theme &&
    a.range === b.range &&
    a.mode === b.mode &&
    a.learningMode === b.learningMode &&
    endConditionEquals(a.endCondition, b.endCondition)
  )
}
