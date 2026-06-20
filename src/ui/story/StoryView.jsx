// 物語モードの画面（プレゼンテーション）。状態は useStory から受け取る。
import { useStory } from '../../application/useStory.js'
import { STORY } from '../../content/story.js'
import { lookahead } from '../../domain/story/navigation.js'
import { segMatches } from '../../domain/typing/units.js'
import { consumedWords, guideText, kanjiDone } from '../../domain/typing/progress.js'
import { Chars, Chips, Flow, MaskedText, StatsRow } from '../shared/index.js'

// 現在打っているセグメントの表示
function ActiveSegment({ seg, input, hasError }) {
  if (seg.translate) {
    const source = seg.type === 'en' ? seg.ja : seg.en
    const target = guideText(seg, input)
    const used = consumedWords(seg, input) // 打ち終えた単語数
    return (
      <>
        <p className="story-prompt">{source}</p>
        {seg.chips && <Chips chips={seg.chips} used={used} />}
        <div className="story-en masked">
          <MaskedText text={target} pos={input.length} hasError={hasError} />
        </div>
      </>
    )
  }
  if (seg.type === 'ja') {
    const done = kanjiDone(seg, input)
    return (
      <div className="story-en">
        <Chars text={seg.ja} done={done} cursor={done} hasError={hasError} />
      </div>
    )
  }
  // en（そのまま）
  return (
    <div className="story-en">
      <Chars text={seg.en} done={input.length} cursor={input.length} hasError={hasError} />
    </div>
  )
}

export default function StoryView({ mode, modeLabel, start, onExit }) {
  const {
    nodes,
    node,
    stage,
    units,
    unitIndex,
    input,
    hasError,
    found,
    lang,
    choiceSegs,
    typedKeys,
    mistakes,
    liveSpeed,
    elapsedSec,
    restart,
  } = useStory({ mode, start, onExit })

  // バー＝現在の行（または入力中の選択肢）の進捗
  let barTarget = ''
  if (stage === 'text') barTarget = guideText(units[unitIndex], input)
  else if (stage === 'choice') {
    const s = choiceSegs.find((cs) => segMatches(cs, input))
    barTarget = s ? guideText(s, input) : ''
  }
  const barProgress = barTarget.length ? Math.min(1, input.length / barTarget.length) : 0

  // 英語/日本語フロー（翻訳モード以外で表示）
  const isTranslate = mode === 'en-tr' || mode === 'ja-tr'
  const activeType = units[unitIndex]?.type
  const flowItems = [node, ...lookahead(node, nodes)]
  let enDone = 0
  let jaDone = 0
  if (stage === 'choice') {
    enDone = node.en.length
    jaDone = [...node.ja].length
  } else {
    if (activeType === 'en') enDone = Math.min(input.length, node.en.length)
    else if (mode === 'both') enDone = node.en.length // 英語は入力済み、和文入力中
    if (activeType === 'ja') jaDone = kanjiDone({ ja: node.ja, kana: node.kana }, input)
  }

  return (
    <div className="story">
      <div className="play-meta">
        <span className="meta-badge rank">{STORY.title}</span>
        <span className="meta-badge mode">{modeLabel}</span>
      </div>
      <div className="story-found-line">
        発見エンド {found.length} / {STORY.endingCount}
      </div>

      {stage === 'ending' ? (
        <div className="story-ending">
          <div className="ending-badge">{node.endLabel}</div>
          <p className="ending-text">{node.en}</p>
          <p className="ending-ja">{node.ja}</p>
          <div className="ending-actions">
            <button className="btn-primary" onClick={restart}>
              最初から
            </button>
            <button className="story-exit" onClick={onExit}>
              トップへ
            </button>
          </div>
          <p className="key-hint">
            <kbd>Enter</kbd> 最初から / <kbd>Esc</kbd> トップ
          </p>
        </div>
      ) : (
        <>
          <StatsRow
            stats={[
              { label: 'タイピング数', value: typedKeys },
              { label: '速度', value: `${liveSpeed} 打/分` },
              { label: 'ミス', value: mistakes },
              { label: '時間', value: `${elapsedSec} 秒` },
            ]}
            progress={barProgress}
          />

          {!isTranslate && (
            <Flow
              items={flowItems}
              cur={0}
              enDone={enDone}
              jaDone={jaDone}
              activeRow={stage === 'choice' ? null : activeType}
              wrap
            />
          )}

          {units.length > 1 && (
            <div className="story-progress">
              {unitIndex + 1} / {units.length}（{units[unitIndex].type === 'en' ? '英語' : '日本語'}）
            </div>
          )}

          <ActiveSegment seg={units[unitIndex]} input={input} hasError={hasError} />

          {stage === 'choice' && (
            <div className="story-choices">
              {node.choices.map((c, i) => {
                const seg = choiceSegs[i]
                const matched = segMatches(seg, input)
                const enDone = lang === 'en' && matched ? input.length : 0
                const jaDone = lang === 'ja' && matched ? kanjiDone(seg, input) : 0
                return (
                  <div key={i} className={`story-choice ${matched ? '' : 'dim'}`}>
                    <span className="choice-key">{'ABC'[i]}</span>
                    <div className="choice-body">
                      <div className="choice-en">
                        {lang === 'en' ? (
                          <Chars
                            text={c.en}
                            done={enDone}
                            cursor={matched ? input.length : -1}
                            hasError={matched && hasError}
                          />
                        ) : (
                          c.en
                        )}
                      </div>
                      <div className="choice-ja">
                        {lang === 'ja' ? (
                          <Chars text={c.ja} done={jaDone} cursor={jaDone} hasError={matched && hasError} />
                        ) : (
                          c.ja
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="hint">
            {stage === 'text'
              ? '表示された文を入力。'
              : '選択肢のどれか1つを最後まで入力すると進みます。'}
            <kbd>Esc</kbd> でトップへ。
          </p>
        </>
      )}
    </div>
  )
}
