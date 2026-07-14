// マラソンの出題（パッセージ）生成。
import { buildUnits } from '../typing/units.service.js'
import { tagLearningBlocks } from '../session/learningSequence.service.js'
import { buildClozeSentence } from '../typing/cloze.service.js'

export const TARGET_KEYS = 600 // （旧）この文字数を打ち切ったら終了。現在は時間制（TIME_LIMIT_MS）。
export const TIME_LIMIT_MS = 60000 // 最初の打鍵から60秒で終了（全モード共通）

// 打ち切れないよう十分に長い出題を作るための目安文字数。
// 60秒×想定上限打速でも尽きないだけの長さ（≒2000打分）を生成する。
// 文字数制（chars）の最大値（1200打）でも尽きないよう 1200 以上を担保する（#208 段2a）。
export const PASSAGE_KEYS = 2000

// pool（出題対象の文配列。呼び出し側がレベル別に遅延読み込みして渡す）からセグメント列を作る。
// 各文は buildUnits でセグメント化し、sentenceIndex を付与して連結（target 文字を超えるまで）。
// 60秒制では尽きないよう target を大きく取る（既定 PASSAGE_KEYS）。
// #364 ordered:true→rng シャッフルせず pool 順のまま充填（固定範囲を毎回同じ並びで流す・決定的）。
// ordered:false（既定）→従来どおり rng シャッフル（非回帰）。
// #402 cloze（穴埋め）：cloze={maskRng} を渡すと 5問ブロックで normal→cloze を交互展開し、
//   cloze フェーズの英語 seg にだけ内容語の char レンジ（clozeRanges）を表示用メタとして載せる。
//   maskRng(item)＝その文の mask 選定用 rng（seed＋文キー由来で決定的にするのは呼び出し側の責務）。
//   照合（variants/canonical）は不変＝伏字は表示だけ。cloze 無し（既定）は従来と完全に同一。
export function buildPassage(mode, pool, { rng = Math.random, target = PASSAGE_KEYS, ordered = false, cloze = null } = {}) {
  const base = pool && pool.length ? pool : []
  if (base.length === 0) return []
  const sequence = ordered ? [...base] : [...base].sort(() => rng() - 0.5)
  // cloze 時は 5問ブロックで normal 全部→同じ順で cloze 全部（出力2×）。normal は素通り＝従来と同形。
  const problems = cloze
    ? tagLearningBlocks(sequence, { blockSize: 5 })
    : sequence.map((item) => ({ item, phase: 'normal' }))
  const segments = []
  let approx = 0
  let si = 0 // 文の通し番号
  let idx = 0
  while (approx < target + 60) {
    const { item, phase } = problems[idx % problems.length]
    for (const seg of buildUnits(item, mode, { rng })) {
      const out = { ...seg, sentenceIndex: si }
      // cloze フェーズの英語 seg にだけ内容語の char レンジを付ける（打鍵対象は文全体のまま）。
      if (cloze && phase === 'cloze' && seg.type === 'en') {
        const { ranges } = buildClozeSentence(item, 'en', { rng: cloze.maskRng(item) })
        if (ranges.length) out.clozeRanges = ranges
      }
      segments.push(out)
      approx += seg.canonical.length
    }
    si += 1
    idx += 1
  }
  return segments
}
