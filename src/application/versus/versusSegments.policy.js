// #439 道Y PR-B（Green）：受信側で「相手の問題列（初回バッチ）」を決定的に再構成する。
//
// 対戦（方式B・盤面複製）では、相手の進捗 onProgress は qIndex（問題の通し番号）で届く。
// 受信側はその qIndex を「相手が実際に解いている問題」へ解決するために、相手と同じ設定
// （MatchConfig）・同じ seed・同じ教材（content）から、各プレイフックの「初回バッチ segments」を
// そっくり再構成する。これが本 buildMirrorSegments の責務。
//
// 決定性の核：各フック（useDict/useWords/useMarathon）の初回ビルド式と一字一句同じ式で seg 列を作る。
//   ・乱数は mulberry32(seed) のみ（Math.random 不使用）＝端末/タブに依らず同一出力。
//   ・range は content.clamped を正とする（container が clamp 済みの値を各フックの range に渡すため）。
//   ・versus は全モード learningMode:'cloze' 固定（VersusMatch.container）なので cloze で組む。
//
// DRY の方針（MVP 妥協・planner 承認）：フック側のビルド args 組み立てを共有 helper へ抽出すると 3 つの
//   solo フック（既定出力不変が絶対要件）を触ることになり回帰リスクが高い。よって当面は各フックの初回
//   ビルド式を本ファイルへ複製し、drift（式のズレ）は versusSegments.policy.test.js の「実フックの初回
//   segments と要素同値」で検知する。式を変えるときは必ずフック側とテストを突き合わせること。
//
// 純粋・非破壊：入力（config/content）を一切書き換えない。React/DOM 非依存（application 層の純ロジック）。
import { buildPassage } from '../../domain/marathon/passage.service.js'
import { buildWordPassage } from '../../domain/words/wordset.service.js'
import { selectPool } from '../../domain/dictionary/dictset.service.js'
import { wordsInRangeBy, RANGE_SIZE } from '../../domain/words/wordRange.service.js'
import { buildUnits } from '../../domain/typing/units.service.js'
import { buildClozeUnits, clozeSideFor, clozeMaskRng } from '../../domain/typing/cloze.service.js'
import { tagLearningBlocks } from '../../domain/session/learningSequence.service.js'
import { mulberry32 } from '../../domain/rng.service.js'

// --- dict：useDict の初回ビルド式（toDictSeg/dictPool/dictRangePool/maskRngFactory）を複製 ---
// dict エントリを buildPassage の pool 形式 {word, en, ja, kana, jaWords} へ整える（useDict.js:45）。
const toDictSeg = (e) => ({ word: e.word, en: e.def, ja: e.ja, kana: e.kana, jaWords: e.jaWords })

// dict を level/theme で絞り pool 形式へ（selectPool fallback→全件、useDict.js:49-53）。
function dictPool(dict, level, theme) {
  let p = selectPool(dict, level, theme, { fallback: true })
  if (p.length === 0) p = dict
  return p.map(toDictSeg)
}

// #364 range 時：strict な level×theme を freq 順で 100 件区切りにスライスした範囲プール
// （決定的。dict は freq を持たないため freqMap から freqOf/keyOf を組む）。空スライス（無効 range）は
// null＝呼び出し側で従来プールへフォールバック（useDict.js:58-63）。
function dictRangePool(dict, level, theme, range, freqMap) {
  const freqOf = (e) => freqMap?.get(e.word) ?? null
  const strict = selectPool(dict, level, theme)
  const sliced = wordsInRangeBy(strict, range, RANGE_SIZE, freqOf, (e) => e.word)
  return sliced.length > 0 ? sliced.map(toDictSeg) : null
}

// 定義文（item.en）ごとに決定的な mask 用 rng を返す（useDict.js:41 / useMarathon.js:39）。
const maskRngFactory = (seed) => (item) => clozeMaskRng(seed, item.en)

// dict の初回 segments を再構成（useDict.js:88-106 と同式・cloze 固定）。
function dictMirror({ config, seed, content }) {
  const { level, theme, mode } = config
  const range = content.clamped // container は clamp 済み range を渡す
  const rangePool = range != null ? dictRangePool(content.dict, level, theme, range, content.freqMap) : null
  const pool = rangePool ?? dictPool(content.dict, level, theme)
  if (pool.length === 0) return [] // pool 空は手前でガード（空 pool ビルドを避ける）
  const ordered = rangePool != null // 範囲プール適用時のみ pool 順で固定
  return buildPassage(mode, pool, {
    rng: mulberry32(seed),
    ordered,
    cloze: { maskRng: maskRngFactory(seed) },
  })
}

// --- words：useWords の初回ビルド式（toProblems/clozeSideOf/unitsOf/buildPassage）を複製 ---
// words の初回 segments を再構成（useWords.js:72-89,121-124 と同式・cloze 固定）。
function wordsMirror({ config, seed, content }) {
  const { level, theme, mode } = config
  const range = content.clamped
  if (content.words.length === 0) return [] // 空 pool は buildWordPassage クラッシュ回避で手前ガード
  // cloze：5問ブロックで normal→cloze を交互展開（出力 2×・{item,phase}）。
  const toProblems = (items) => tagLearningBlocks(items, { blockSize: 5 })
  // both×cloze で「英語 or 読み」どちらを伏せるかを語ごとに seed 由来で決める（both 以外は不要）。
  const clozeSideOf = (item) => (mode !== 'both' ? undefined : clozeSideFor(seed, item.en))
  const unitsOf = (p) =>
    p.phase === 'cloze'
      ? buildClozeUnits(p.item, mode, { clozeSide: clozeSideOf(p.item) })
      : buildUnits(p.item, mode)
  const words = toProblems(buildWordPassage(content.words, level, theme, mode, { rng: mulberry32(seed), range }))
  return words.flatMap((w, wi) => unitsOf(w).map((s) => ({ ...s, sentenceIndex: wi })))
}

// --- wsent：useMarathon.start の初回ビルド式（opts 組み立て＋buildPassage）を複製 ---
// wsent の初回 segments を再構成（useMarathon.js:95-102 と同式・cloze 固定）。
function wsentMirror({ config, seed, content }) {
  const { mode } = config
  const range = content.clamped
  const pool = content.pool
  if (pool.length === 0) return []
  // range 時は pool 順で固定（ordered）。それ以外は seed で決定的（mulberry32）。
  const opts = range != null ? { ordered: true } : { rng: mulberry32(seed) }
  opts.cloze = { maskRng: maskRngFactory(seed ?? 0) }
  return buildPassage(mode, pool, opts)
}

// gameType ごとの再構成器。mirror 非対象（quiz 等）は未登録＝[] を返す。
const MIRROR_BY_GAME = {
  dict: dictMirror,
  words: wordsMirror,
  wsent: wsentMirror,
}

// 受信側で相手の初回バッチ問題列（TopSeg[]）を決定的に再構成する。
//   gameType … 'dict' | 'words' | 'wsent'（未対応は []）
//   config   … MatchConfig（level/theme/range/mode 等・両者合意の対戦設定）
//   seed     … 相手と共有する乱数シード（mulberry32 のみ・Math.random 不使用）
//   content  … useVersusContent（container）の出力（dict/words/pool・clamped 等）
export function buildMirrorSegments({ gameType, config, seed, content }) {
  const mirror = MIRROR_BY_GAME[gameType]
  if (!mirror) return []
  return mirror({ config, seed, content })
}
