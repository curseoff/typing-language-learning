// #432 P2P穴埋め対戦：対戦本体（container）。
// 合意済み設定(config)＋共有 seed で穴埋めタイピング（learningMode='cloze' 固定）を回し、
// 自分のプレイを既存 presenter で描画しつつ、盤面（VersusBoardView）に自分/相手の進捗を数値で並べる。
// P2P へは打鍵のたびに進捗を配信（sendProgress）し、終了条件到達で完走を配信（sendFinished）、
// 全員完走 or サドンデス脱落で対戦終了→勝敗（correct 最多）を判定して盤面にバッジを出す。
//
// カンニング防止：相手には数値（typed/mistakes/correct/lives）だけを配信し、盤面カードにも
// 問題テキストは一切渡さない（自分の問題はプレイ画面側だけが描く）。相手の答えは自画面に出さない。
//
// 流用方針：進捗を外へ出すため、既存プレイフック（useDict/useWords/useMarathon）へは
// 後方互換の任意コールバック onProgress（打鍵ごとに { typed, mistakes, segStats, currentMistakes } を
// ハンドラ内＝ref 読み許可の場所から通知）だけを足し、判定/採点ロジックは触っていない。
// content ロードは App.jsx の開始経路（startDict/startWords/startWsent）を最小移植する。
import { useCallback, useEffect, useRef, useState } from 'react'
import { DictTypeView, WordTypeView, VersusBoardView } from '@tll/ui'
import MarathonView from '../marathon/MarathonView.container.jsx'
import { useDict } from '../../application/useDict.js'
import { useWords } from '../../application/useWords.js'
import { useMarathon } from '../../application/useMarathon.js'
import { toProgressPayload } from '../../application/versus/versusPlay.policy.js'
import { headwordFreqMap, sliceByHeadwordFreq } from '../../application/headwordFreqSlice.policy.js'
import { activeIds, allFinished } from '../../domain/versus/peerRoster.service.js'
import { rankMap } from '../../domain/versus/matchScore.service.js'
import { anyoneEliminated } from '../../domain/versus/suddenDeath.service.js'
import { filterWsentByTheme } from '../../domain/words/wsentSet.service.js'
import { rangeCount } from '../../domain/words/wordRange.service.js'
import { hudEndFor } from '../../domain/session/learningSequence.service.js'
import { endHudStat } from '../../content/endConditions.js'
import { modeLabel } from '../../content/modes.js'
import { loadDict, DICT_COUNTS } from '../../content/dictionary.js'
import { loadWords, loadWordGloss, loadWordRuby, WORD_COUNTS } from '../../content/words.js'
import { loadWsentLevel, loadWsentThemes, WSENT_COUNTS } from '../../content/wordSentences/index.js'

// 範囲（range）を収録数の範囲へ丸める（範囲外/未指定は null＝全体出題）。App.jsx の clampRange と同じ規則。
const clampToCount = (range, count) => (range != null && range >= 1 && range <= count ? range : null)

// 種目ごとの収録数から range をクランプする（App.jsx の *RangeCount と同じ算出）。
function clampRangeFor(gameType, level, theme, range) {
  const counts = gameType === 'dict' ? DICT_COUNTS : gameType === 'wsent' ? WSENT_COUNTS : WORD_COUNTS
  return clampToCount(range, rangeCount(counts[level]?.[theme] ?? 0))
}

// endCondition から派生する対戦パラメータ。
//   initialLives … サドンデス（life 制）の初期ライフ。それ以外は undefined（ライフ非表示）。
//   limitSec     … 時間制の制限秒（カード時間欄の分母）。それ以外は undefined。
//   total        … 進捗メッセージの total（表示には使わないが素の進捗として透過）。
function matchParams(endCondition) {
  const { kind, value } = endCondition
  return {
    initialLives: kind === 'life' ? value : undefined,
    limitSec: kind === 'time' ? value : undefined,
    total: value,
  }
}

// config.gameType に応じて content を遅延ロードする（App.jsx の開始経路を最小移植）。
// 初回バンドルに教材データを含めないため、実データは各 loader の動的 import 経由で取得する。
// ready になるまで呼び出し側はスピナー/準備中を出す。失敗は error に載せる。
function useVersusContent(config) {
  const [state, setState] = useState({ ready: false, error: null, data: null })
  const { gameType, level, theme, range } = config

  useEffect(() => {
    let alive = true
    const clamped = clampRangeFor(gameType, level, theme, range)
    const run = async () => {
      if (gameType === 'dict') {
        const loads = [loadDict(level), loadWordGloss(), loadWordRuby()]
        if (clamped != null) loads.push(loadWords(level))
        const [dict, gloss, wordRuby, words] = await Promise.all(loads)
        return { dict, gloss, wordRuby, freqMap: clamped != null ? headwordFreqMap(words) : null, clamped }
      }
      if (gameType === 'words') {
        const words = await loadWords(level)
        return { words, clamped }
      }
      // wsent（単語例文）：例文プール＋和訳＋テーマ表を並行ロードし、テーマで絞って（range 時は freq 順スライス）
      // useMarathon.start へ渡すプール（sliced）を作る。
      const loads = [loadWsentLevel(level), loadWordGloss(), loadWsentThemes()]
      if (clamped != null) loads.push(loadWords(level))
      const [pool, gloss, themes, words] = await Promise.all(loads)
      const themeMap = themes[level] ?? {}
      const filtered = filterWsentByTheme(pool, theme, themeMap)
      const freqMap = clamped != null ? headwordFreqMap(words) : null
      const sliced = sliceByHeadwordFreq(filtered, clamped, freqMap)
      return { gloss, pool: sliced, clamped }
    }
    run()
      .then((data) => alive && setState({ ready: true, error: null, data }))
      .catch(() => alive && setState({ ready: false, error: '教材の読み込みに失敗しました', data: null }))
    return () => {
      alive = false
    }
  }, [gameType, level, theme, range])

  return state
}

// 盤面カード配列（ProgressCardData[]）を組み立てる。自分＝手元の live 値、相手＝受信した progress の数値のみ。
// #432 相手の速度(speed)・経過(elapsedMs)も progress で配信するようになったため、あれば反映（無ければ 0）。
// 数値のみ（問題テキストは渡さない）＝カンニング防止は担保。finished は roster から各参加者ぶんを取る。
function buildMembers({ selfId, roster, self, progress, initialLives, limitSec }) {
  return activeIds(roster).map((id) => {
    const finished = roster.peers[id]?.finished ?? false
    if (id === selfId) {
      return {
        id,
        self: true,
        typed: self.typed,
        speed: self.speed,
        mistakes: self.mistakes,
        elapsedSec: self.elapsedSec,
        correct: self.correct,
        finished,
        ...(limitSec != null ? { limitSec } : {}),
        ...(initialLives != null ? { lives: self.lives } : {}),
      }
    }
    const p = progress[id] ?? {}
    return {
      id,
      self: false,
      typed: p.typed ?? 0,
      // 相手の速度・経過は progress の speed/elapsedMs から反映（未配信＝旧クライアント時は 0）。
      speed: p.speed ?? 0,
      mistakes: p.mistakes ?? 0,
      elapsedSec: p.elapsedMs != null ? Math.round(p.elapsedMs / 1000) : 0,
      correct: p.correct ?? 0,
      finished,
      ...(limitSec != null ? { limitSec } : {}),
      ...(initialLives != null ? { lives: p.lives ?? initialLives } : {}),
    }
  })
}

// 盤面（自分/相手カード）を組み立てて描画する共有 stage。play は自分のプレイ UI（children）。
// 終了後は各カード内に順位（rankMap＝competition ranking）を出す（上部の勝敗バッジは廃止＝#432 E）。
// 自分が完了して相手待ちのときは、相手の完了を待つ案内を出す（#432 D）。
function MatchStage({ selfId, roster, self, progress, phase, initialLives, limitSec, children }) {
  const members = buildMembers({ selfId, roster, self, progress, initialLives, limitSec })
  const finished = phase === 'finished'
  // 終了後のみ、correct（一発正解数）から順位を算出して各カードへ載せる（同点は同順位）。
  const ranked = finished
    ? (() => {
        const scores = Object.fromEntries(members.map((m) => [m.id, { correct: m.correct }]))
        const ranks = rankMap(scores)
        return members.map((m) => ({ ...m, rank: ranks[m.id] }))
      })()
    : members
  // 自分が完了かつ全員は未完了（＝相手待ち）のとき、待機案内を出す。
  const waitingForOthers = (roster.peers[selfId]?.finished ?? false) && !allFinished(roster)
  return (
    <div className="vs vs-match">
      {waitingForOthers && (
        <p className="vs-lead vs-match-waiting" role="status">
          相手の完了を待っています…
        </p>
      )}
      <VersusBoardView members={ranked} />
      <div className="vs-match-play">{children}</div>
    </div>
  )
}

// 自分の完走/脱落を1回だけ配信するための共通フック。
//   finished  … プレイフック側の完走シグナル（dict/words は d.finished、wsent は onFinish で別途配信）。
//   lives     … 自分の残ライフ（サドンデスのみ・undefined ならライフ判定しない）。
//   progress  … 相手の受信進捗（誰か lives0 で自分も終了へ倒す最小サドンデス対応）。
//   typed/mistakes/elapsedSec … 完走配信に載せる手元の実績（effect 内で最新値を読む＝ref を render 中に書かない）。
//   correct   … 手元の一発正解数（最終 progress に載せる）。speed … 手元の live 速度（同上）。
// #432 完走時は sendFinished の直前に「最終 progress」を1回配信する（相手カードの完了表示が最終
// typed/mistakes/correct/lives/speed/elapsedMs になり、0 秒/0 速度で止まらない）。
// #432 要判断：store の suddenDeathEnd は useVersus 未配線のため、脱落検知時は sendFinished 相当で
// 全員完走へ収束させる最小対応にしている（本来はホストが全員へ終了を配布すべき）。
function useFinishBroadcast({ finished, lives, progress, initialLives, typed, total, mistakes, correct, speed, elapsedSec, sendProgress, sendFinished }) {
  const sentRef = useRef(false)
  useEffect(() => {
    if (sentRef.current) return
    const eliminated = initialLives != null && ((typeof lives === 'number' && lives <= 0) || anyoneEliminated(progress))
    if (!finished && !eliminated) return
    sentRef.current = true
    const elapsedMs = Math.round(elapsedSec * 1000)
    // 最終 progress（透過値そのまま・correct/lives/speed/elapsedMs 込み）を1回だけ配信する。
    sendProgress({ typed, total, mistakes, correct, speed, elapsedMs, ...(initialLives != null ? { lives } : {}) })
    sendFinished({ keys: typed, mistakes, elapsedMs })
  }, [finished, lives, progress, initialLives, typed, total, mistakes, correct, speed, elapsedSec, sendProgress, sendFinished])
}

// 手元スナップショット（onProgress 由来の correct/lives）を保持し、進捗を配信する共通フック。
// onProgress のたびに payload（correct/lives 込み）を作って sendProgress し、correct/lives を state に反映する。
// #432 相手カードの速度・時間：live 速度・経過を liveRef（各 PlayArea が effect で更新する最新値ホルダー）
// から読み、payload に speed/elapsedMs を載せて配信する（render 中に ref を書かない＝effect 更新の1フレーム遅れは表示上許容）。
function useProgressRelay({ sendProgress, total, initialLives, liveRef }) {
  const [derived, setDerived] = useState({ correct: 0, lives: initialLives ?? 0 })
  const onProgress = useCallback(
    (snap) => {
      const live = liveRef.current
      const payload = toProgressPayload({
        typed: snap.typed,
        total,
        mistakes: snap.mistakes,
        segStats: snap.segStats,
        currentMistakes: snap.currentMistakes,
        initialLives,
        speed: live.speed,
        elapsedMs: live.elapsedMs,
      })
      sendProgress(payload)
      // ハンドラ内 setState（effect ではない）＝cascading render 警告の対象外。
      setDerived({ correct: payload.correct, lives: payload.lives ?? initialLives ?? 0 })
    },
    [sendProgress, total, initialLives, liveRef],
  )
  return { derived, onProgress }
}

// live 速度・経過の最新値ホルダー（ref）を作る。プレイフックより先に生成が要る（onProgress へ渡すため）。
function useLiveRef() {
  return useRef({ speed: 0, elapsedMs: 0 })
}

// プレイフックの live 速度・経過を最新値ホルダー（ref）へ反映する（render 中に書かず effect で更新）。
// onProgress/finish の effect が読む「1フレーム遅れの最新値」＝表示上は許容。
function useLiveRefSync(liveRef, speed, elapsedSec) {
  useEffect(() => {
    liveRef.current = { speed: speed ?? 0, elapsedMs: Math.round((elapsedSec ?? 0) * 1000) }
  }, [liveRef, speed, elapsedSec])
}

// dict（英英）の対戦プレイエリア。useDict を seed 注入・cloze 固定で駆動する。
function DictPlayArea({ config, seed, content, selfId, roster, progress, phase, sendProgress, sendFinished }) {
  const { initialLives, limitSec, total } = matchParams(config.endCondition)
  const liveRef = useLiveRef()
  const { derived, onProgress } = useProgressRelay({ sendProgress, total, initialLives, liveRef })
  const d = useDict({
    dict: content.dict,
    level: config.level,
    theme: config.theme,
    mode: config.mode,
    seed,
    endCondition: config.endCondition,
    range: content.clamped,
    freqMap: content.freqMap,
    learningMode: 'cloze',
    onExit: () => {},
    onProgress,
    // 対戦はレース開始（この PlayArea のマウント＝カウントダウン終了）と同時に計時を始める（初回打鍵を待たない）。
    autoStart: true,
  })
  // live 速度・経過を最新値ホルダーへ反映（onProgress/finish の effect が読む）。
  useLiveRefSync(liveRef, d.liveSpeed, d.elapsedSec)
  useFinishBroadcast({ finished: d.finished, lives: derived.lives, progress, initialLives, typed: d.typedKeys, total, mistakes: d.mistakes, correct: derived.correct, speed: d.liveSpeed, elapsedSec: d.elapsedSec, sendProgress, sendFinished })

  const self = { typed: d.typedKeys, speed: d.liveSpeed, mistakes: d.mistakes, correct: derived.correct, lives: derived.lives, elapsedSec: d.elapsedSec }
  const hudEnd = hudEndFor(config.endCondition, 'cloze')
  const endStat = endHudStat(hudEnd, { elapsedSec: d.elapsedSec, keys: d.typedKeys, items: d.segIndex, missedItems: d.missedItems })

  return (
    <MatchStage selfId={selfId} roster={roster} self={self} progress={progress} phase={phase} initialLives={initialLives} limitSec={limitSec}>
      <DictTypeView
        levelLabel={`L${config.level}`}
        metaSub={`英英 / ${modeLabel(config.mode)} / ${config.theme}`}
        finished={false}
        resultNode={null}
        typedKeys={d.typedKeys}
        liveSpeed={d.liveSpeed}
        mistakes={d.mistakes}
        endStatLabel={endStat.label}
        endStatValue={endStat.value}
        progress={endStat.progress}
        word={d.word}
        wordJa={d.word ? content.gloss?.[d.word] : undefined}
        hintLead={config.mode === 'ja' ? '見出し語の和訳を入力。' : '見出し語の英語の定義を入力。'}
        segments={d.segments}
        segIndex={d.segIndex}
        segInput={d.segInput}
        hasError={d.hasError}
        clozeRevealed={d.clozeRevealed}
      />
    </MatchStage>
  )
}

// words（単語）の対戦プレイエリア。useWords を seed 注入・cloze 固定で駆動する。
function WordsPlayArea({ config, seed, content, selfId, roster, progress, phase, sendProgress, sendFinished }) {
  const { initialLives, limitSec, total } = matchParams(config.endCondition)
  const liveRef = useLiveRef()
  const { derived, onProgress } = useProgressRelay({ sendProgress, total, initialLives, liveRef })
  const w = useWords({
    allWords: content.words,
    level: config.level,
    theme: config.theme,
    mode: config.mode,
    seed,
    endCondition: config.endCondition,
    range: content.clamped,
    learningMode: 'cloze',
    onExit: () => {},
    onProgress,
    // 対戦はレース開始（マウント）と同時に計時開始（初回打鍵を待たない）。
    autoStart: true,
  })
  useLiveRefSync(liveRef, w.liveSpeed, w.elapsedSec)
  useFinishBroadcast({ finished: w.finished, lives: derived.lives, progress, initialLives, typed: w.typedKeys, total, mistakes: w.mistakes, correct: derived.correct, speed: w.liveSpeed, elapsedSec: w.elapsedSec, sendProgress, sendFinished })

  const self = { typed: w.typedKeys, speed: w.liveSpeed, mistakes: w.mistakes, correct: derived.correct, lives: derived.lives, elapsedSec: w.elapsedSec }
  const hudEnd = hudEndFor(config.endCondition, 'cloze')
  const endStat = endHudStat(hudEnd, { elapsedSec: w.elapsedSec, keys: w.typedKeys, items: w.segIndex, missedItems: w.missedItems })
  const barProgress = config.endCondition.kind === 'time' ? w.progress : endStat.progress

  return (
    <MatchStage selfId={selfId} roster={roster} self={self} progress={progress} phase={phase} initialLives={initialLives} limitSec={limitSec}>
      <WordTypeView
        levelLabel={`W${config.level}`}
        metaSub={`${modeLabel(config.mode)} / ${config.theme}`}
        finished={false}
        resultNode={null}
        typedKeys={w.typedKeys}
        liveSpeed={w.liveSpeed}
        mistakes={w.mistakes}
        endStatLabel={endStat.label}
        endStatValue={endStat.value}
        progress={barProgress}
        segments={w.segments}
        segIndex={w.segIndex}
        segInput={w.segInput}
        hasError={w.hasError}
        clozeRevealed={w.clozeRevealed}
      />
    </MatchStage>
  )
}

// wsent（単語例文）の対戦プレイエリア。useMarathon を start() で駆動する（segments は start で注入）。
function WsentPlayArea({ config, seed, content, selfId, roster, progress, phase, sendProgress, sendFinished }) {
  const { initialLives, limitSec, total } = matchParams(config.endCondition)
  const liveRef = useLiveRef()
  const { derived, onProgress } = useProgressRelay({ sendProgress, total, initialLives, liveRef })
  // 最新の derived（correct/lives）を effect で ref へ控える（onFinish の最終 progress が読む）。
  const derivedRef = useRef(derived)
  useEffect(() => {
    derivedRef.current = derived
  }, [derived])
  // onFinish（マラソンは finished フラグを持たず onFinish で完走を通知）→ 最終 progress→完走を1回だけ配信する。
  const finSentRef = useRef(false)
  const onFinish = useCallback(
    (record) => {
      if (finSentRef.current) return
      finSentRef.current = true
      // 相手カードが最終値になるよう、最終 progress を1回配信してから完走を送る（#432）。
      sendProgress({
        typed: record.keys,
        total,
        mistakes: record.mistakes,
        correct: derivedRef.current.correct,
        speed: liveRef.current.speed,
        elapsedMs: record.elapsedMs,
        ...(initialLives != null ? { lives: derivedRef.current.lives } : {}),
      })
      sendFinished({ keys: record.keys, mistakes: record.mistakes, elapsedMs: record.elapsedMs })
    },
    [sendProgress, sendFinished, total, initialLives, liveRef],
  )
  // 対戦はレース開始（マウント）と同時に計時開始（初回打鍵を待たない）。
  const m = useMarathon({ active: true, onFinish, endCondition: config.endCondition, learningMode: 'cloze', onProgress, autoStart: true })

  // マウント時に1回だけ出題を開始（全員同一 seed＝同一問題列）。
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    m.start(config.mode, config.level, 'wsent', content.pool, seed, config.theme, content.clamped)
    // start は content/seed/config で一意＝マウント1回のみ（依存は初期値で固定）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLiveRefSync(liveRef, m.liveSpeed, m.elapsedSec)
  // サドンデス脱落での終了（onFinish は個人完走用）。誰か lives0 なら 最終 progress→sendFinished で収束させる最小対応。
  useFinishBroadcast({ finished: false, lives: derived.lives, progress, initialLives, typed: m.typedKeys, total, mistakes: m.mistakes, correct: derived.correct, speed: m.liveSpeed, elapsedSec: m.elapsedSec, sendProgress, sendFinished })

  const self = { typed: m.typedKeys, speed: m.liveSpeed, mistakes: m.mistakes, correct: derived.correct, lives: derived.lives, elapsedSec: m.elapsedSec }

  return (
    <MatchStage selfId={selfId} roster={roster} self={self} progress={progress} phase={phase} initialLives={initialLives} limitSec={limitSec}>
      <MarathonView
        mode={config.mode}
        endCondition={config.endCondition}
        learningMode="cloze"
        rankText={`単語例文 L${config.level}`}
        gloss={content.gloss}
        segments={m.segments}
        segIndex={m.segIndex}
        segInput={m.segInput}
        completed={m.completed}
        hasError={m.hasError}
        clozeRevealed={m.clozeRevealed}
        typedKeys={m.typedKeys}
        mistakes={m.mistakes}
        missedItems={m.missedItems}
        liveSpeed={m.liveSpeed}
        elapsedSec={m.elapsedSec}
      />
    </MatchStage>
  )
}

// 種目ごとのプレイエリアへ振り分ける。
function PlayArea(props) {
  if (props.config.gameType === 'dict') return <DictPlayArea {...props} />
  if (props.config.gameType === 'words') return <WordsPlayArea {...props} />
  return <WsentPlayArea {...props} />
}

// カウントダウン中の表示。残り秒（3・2・1）を大きな数字で見せ、100ms 間隔で再描画して減らす。
// 残り秒 = ceil((localStartAt - Date.now())/1000)＝localStartAt は Date.now() 基準（このブランチの壁掛け時計）。
// localStartAt が null の間（開始時刻未確定）は従来どおり「まもなく開始します…」だけを出す。
// 残り秒（remain）は state に持ち、interval コールバック内でのみ Date.now() から再計算する
// （render 中に Date.now() を読むと react-hooks/purity に触れる／effect 本体で同期 setState もしない）。
// remain が null の間（localStartAt 未確定 or 初回 tick 前）は補助文言だけを出す。0 到達 or phase→running で
// 親（VersusMatch）が本コンポーネントを外し、プレイ画面へ遷移する。
function CountdownNote({ localStartAt }) {
  const [remain, setRemain] = useState(null)
  useEffect(() => {
    if (localStartAt == null) return
    const id = setInterval(() => setRemain(Math.max(0, Math.ceil((localStartAt - Date.now()) / 1000))), 100)
    return () => clearInterval(id)
  }, [localStartAt])
  if (remain == null) {
    return <p className="vs-lead vs-countdown-note">まもなく開始します…</p>
  }
  return (
    <div className="vs-countdown" role="status" aria-live="polite">
      <span className="vs-countdown-num">{remain}</span>
      <p className="vs-lead vs-countdown-note">まもなく開始します…</p>
    </div>
  )
}

// 対戦本体。VersusConnect から useVersus の返り値を受け取り、content ロード→カウントダウン→プレイ→終了まで繋ぐ。
export default function VersusMatch({ config, seed, selfId, role, roster, progress, phase, localStartAt, sendProgress, sendFinished, endMatch, onReturnToLobby }) {
  const content = useVersusContent(config)
  const { initialLives, limitSec } = matchParams(config.endCondition)

  // Esc で対戦を抜けてルール選択ロビーへ戻す（#432 ナビ改善：接続は維持したまま resetMatch）。
  // capture 段で stopPropagation し、プレイフック（useDict/useMarathon）の Esc 処理（escFinish）が
  // 二重発火しないよう最小限で preempt する。onReturnToLobby は接続維持のロビー復帰を担う（VersusConnect）。
  useEffect(() => {
    if (!onReturnToLobby) return
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      onReturnToLobby()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onReturnToLobby])

  // #432 ホスト権威の対戦終了収束：ホストだけが v.endMatch（matchEnd 配布＝冪等）で全員を結果へ倒す。
  // 時間制：レース開始（running）したら「開始時刻(localStartAt)＋制限秒」に達したら終了する締切タイマーを
  // 1本張る。ゲストや非時間制では張らない。phase 変化/アンマウントで clear（abort/matchEnd 受信もここで止まる）。
  const isHost = role === 'host'
  const endKind = config.endCondition.kind
  useEffect(() => {
    if (!isHost || !endMatch || endKind !== 'time' || phase !== 'running' || localStartAt == null) return
    // localStartAt は Date.now() 基準（壁掛け時計）なので締切も Date.now() で測る（performance.now() と混ぜない）。
    const delay = Math.max(0, localStartAt + config.endCondition.value * 1000 - Date.now())
    const id = setTimeout(() => endMatch(), delay)
    return () => clearTimeout(id)
  }, [isHost, endMatch, endKind, phase, localStartAt, config.endCondition.value])

  // 問題数/文字数/サドンデス（items/chars/life）：最初の完走 or 脱落で全員終了する。
  // roster の finished がどれか true になったら（自分の完走/脱落も useFinishBroadcast→sendFinished で
  // roster.self.finished を立てる想定）ホストが終了を配布する。dispatch を render 位相に持ち込まないよう
  // setTimeout(…,0) で遅延実行する（endMatch は冪等＝二重でも無害）。
  const anyFinished = activeIds(roster).some((id) => roster.peers[id]?.finished)
  useEffect(() => {
    if (!isHost || !endMatch || endKind === 'time' || phase !== 'running' || !anyFinished) return
    const id = setTimeout(() => endMatch(), 0)
    return () => clearTimeout(id)
  }, [isHost, endMatch, endKind, phase, anyFinished])

  if (content.error) {
    return (
      <div className="vs vs-match">
        <p className="vs-error" role="alert">
          {content.error}
        </p>
      </div>
    )
  }
  if (!content.ready) {
    return (
      <div className="vs vs-match">
        <p className="vs-lead">対戦の準備中…</p>
      </div>
    )
  }

  // カウントダウン中はプレイフックをまだ動かさない（打鍵が対戦前に計上されないよう）。盤面だけ先に見せる。
  if (phase === 'countdown') {
    const self = { typed: 0, speed: 0, mistakes: 0, correct: 0, lives: initialLives ?? 0, elapsedSec: 0 }
    return (
      <MatchStage selfId={selfId} roster={roster} self={self} progress={progress} phase={phase} initialLives={initialLives} limitSec={limitSec}>
        <CountdownNote localStartAt={localStartAt} />
      </MatchStage>
    )
  }

  // running / finished：プレイフックを動かして対戦する（終了後もフレームを維持し、盤面に勝敗バッジを出す）。
  return (
    <PlayArea
      config={config}
      seed={seed}
      content={content.data}
      selfId={selfId}
      roster={roster}
      progress={progress}
      phase={phase}
      sendProgress={sendProgress}
      sendFinished={sendFinished}
    />
  )
}
