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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DictTypeView, WordTypeView, VersusBoardView } from '@tll/ui'
import MarathonView from '../marathon/MarathonView.container.jsx'
import { useDict } from '../../application/useDict.js'
import { useWords } from '../../application/useWords.js'
import { useMarathon } from '../../application/useMarathon.js'
import { toProgressPayload } from '../../application/versus/versusPlay.policy.js'
import { headwordFreqMap, sliceByHeadwordFreq } from '../../application/headwordFreqSlice.policy.js'
import { activeIds } from '../../domain/versus/peerRoster.service.js'
import { winners as computeWinners } from '../../domain/versus/matchScore.service.js'
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
// 相手は speed/elapsedSec を配信していない（progress payload に無い）ため 0 で表示する（数値のカンニング防止は担保）。
function buildMembers({ selfId, roster, self, progress, initialLives, limitSec }) {
  return activeIds(roster).map((id) => {
    if (id === selfId) {
      return {
        id,
        self: true,
        typed: self.typed,
        speed: self.speed,
        mistakes: self.mistakes,
        elapsedSec: self.elapsedSec,
        correct: self.correct,
        ...(limitSec != null ? { limitSec } : {}),
        ...(initialLives != null ? { lives: self.lives } : {}),
      }
    }
    const p = progress[id] ?? {}
    return {
      id,
      self: false,
      typed: p.typed ?? 0,
      speed: 0, // 相手の速度は未配信（progress payload に無い）→ 0 表示。#432 TODO: speed 配信は将来拡張。
      mistakes: p.mistakes ?? 0,
      elapsedSec: 0, // 相手の経過秒も未配信 → 0 表示。
      correct: p.correct ?? 0,
      ...(limitSec != null ? { limitSec } : {}),
      ...(initialLives != null ? { lives: p.lives ?? initialLives } : {}),
    }
  })
}

// 盤面（自分/相手カード＋勝敗バッジ）を組み立てて描画する共有 stage。play は自分のプレイ UI（children）。
function MatchStage({ selfId, roster, self, progress, phase, initialLives, limitSec, children }) {
  const members = buildMembers({ selfId, roster, self, progress, initialLives, limitSec })
  const finished = phase === 'finished'
  // 勝敗は correct（一発正解数）最多で判定（複数はドロー）。終了時のみ算出して盤面に渡す。
  const winnerIds = useMemo(() => {
    if (!finished) return undefined
    const scores = Object.fromEntries(members.map((m) => [m.id, { correct: m.correct }]))
    return computeWinners(scores)
    // members は毎レンダー新規参照だが finished 時のみ評価＝終了フレームで一度確定する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, progress, self.correct])
  return (
    <div className="vs vs-match">
      <VersusBoardView members={members} winners={winnerIds} finished={finished} />
      <div className="vs-match-play">{children}</div>
    </div>
  )
}

// 自分の完走/脱落を1回だけ配信するための共通フック。
//   finished  … プレイフック側の完走シグナル（dict/words は d.finished、wsent は onFinish で別途配信）。
//   lives     … 自分の残ライフ（サドンデスのみ・undefined ならライフ判定しない）。
//   progress  … 相手の受信進捗（誰か lives0 で自分も終了へ倒す最小サドンデス対応）。
//   typed/mistakes/elapsedSec … 完走配信に載せる手元の実績（effect 内で最新値を読む＝ref を render 中に書かない）。
// #432 要判断：store の suddenDeathEnd は useVersus 未配線のため、脱落検知時は sendFinished 相当で
// 全員完走へ収束させる最小対応にしている（本来はホストが全員へ終了を配布すべき）。
function useFinishBroadcast({ finished, lives, progress, initialLives, typed, mistakes, elapsedSec, sendFinished }) {
  const sentRef = useRef(false)
  useEffect(() => {
    if (sentRef.current) return
    const eliminated = initialLives != null && ((typeof lives === 'number' && lives <= 0) || anyoneEliminated(progress))
    if (!finished && !eliminated) return
    sentRef.current = true
    sendFinished({ keys: typed, mistakes, elapsedMs: Math.round(elapsedSec * 1000) })
  }, [finished, lives, progress, initialLives, typed, mistakes, elapsedSec, sendFinished])
}

// 手元スナップショット（onProgress 由来の correct/lives）を保持し、進捗を配信する共通フック。
// onProgress のたびに payload（correct/lives 込み）を作って sendProgress し、correct/lives を state に反映する。
function useProgressRelay({ sendProgress, total, initialLives }) {
  const [derived, setDerived] = useState({ correct: 0, lives: initialLives ?? 0 })
  const onProgress = useCallback(
    (snap) => {
      const payload = toProgressPayload({
        typed: snap.typed,
        total,
        mistakes: snap.mistakes,
        segStats: snap.segStats,
        currentMistakes: snap.currentMistakes,
        initialLives,
      })
      sendProgress(payload)
      // ハンドラ内 setState（effect ではない）＝cascading render 警告の対象外。
      setDerived({ correct: payload.correct, lives: payload.lives ?? initialLives ?? 0 })
    },
    [sendProgress, total, initialLives],
  )
  return { derived, onProgress }
}

// dict（英英）の対戦プレイエリア。useDict を seed 注入・cloze 固定で駆動する。
function DictPlayArea({ config, seed, content, selfId, roster, progress, phase, sendProgress, sendFinished }) {
  const { initialLives, limitSec, total } = matchParams(config.endCondition)
  const { derived, onProgress } = useProgressRelay({ sendProgress, total, initialLives })
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
  })
  useFinishBroadcast({ finished: d.finished, lives: derived.lives, progress, initialLives, typed: d.typedKeys, mistakes: d.mistakes, elapsedSec: d.elapsedSec, sendFinished })

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
  const { derived, onProgress } = useProgressRelay({ sendProgress, total, initialLives })
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
  })
  useFinishBroadcast({ finished: w.finished, lives: derived.lives, progress, initialLives, typed: w.typedKeys, mistakes: w.mistakes, elapsedSec: w.elapsedSec, sendFinished })

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
  const { derived, onProgress } = useProgressRelay({ sendProgress, total, initialLives })
  // onFinish（マラソンは finished フラグを持たず onFinish で完走を通知）→ 完走を1回だけ配信する。
  const finSentRef = useRef(false)
  const onFinish = useCallback(
    (record) => {
      if (finSentRef.current) return
      finSentRef.current = true
      sendFinished({ keys: record.keys, mistakes: record.mistakes, elapsedMs: record.elapsedMs })
    },
    [sendFinished],
  )
  const m = useMarathon({ active: true, onFinish, endCondition: config.endCondition, learningMode: 'cloze', onProgress })

  // マウント時に1回だけ出題を開始（全員同一 seed＝同一問題列）。
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    m.start(config.mode, config.level, 'wsent', content.pool, seed, config.theme, content.clamped)
    // start は content/seed/config で一意＝マウント1回のみ（依存は初期値で固定）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // サドンデス脱落での終了（onFinish は個人完走用）。誰か lives0 なら sendFinished で収束させる最小対応。
  useFinishBroadcast({ finished: false, lives: derived.lives, progress, initialLives, typed: m.typedKeys, mistakes: m.mistakes, elapsedSec: m.elapsedSec, sendFinished })

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

// 対戦本体。VersusConnect から useVersus の返り値を受け取り、content ロード→カウントダウン→プレイ→終了まで繋ぐ。
export default function VersusMatch({ config, seed, selfId, roster, progress, phase, sendProgress, sendFinished }) {
  const content = useVersusContent(config)
  const { initialLives, limitSec } = matchParams(config.endCondition)

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
        <p className="vs-lead vs-countdown-note">まもなく開始します…</p>
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
