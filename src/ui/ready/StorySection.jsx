// 物語タブ（container）：物語の選択カード＋モード＋記録/一覧。
// 表示の骨格は @tll/ui の StorySectionView（presenter）。ここは content（STORIES/MODES）・
// application（loadItemStats/loadStoryRecords）・フック（useRecordDetail）を読み、選択肢と
// 一覧/記録ノードを組み立てて渡す。外部 API（storyId/onStoryIdChange 等）は従来どおり維持。
import { StorySectionView } from '@tll/ui'
import { MODES, modeLabel } from '../../content/modes.js'
import { STORIES, storyById } from '../../content/stories/index.js'
import { loadStoryRecords, loadItemStats, storyStatId } from '../../application/records.js'
import { useRecordDetail } from '../result/useRecordDetail.jsx'

const STORY_MODE_GROUPS = [...new Set(MODES.map((m) => m.group))].map((g) => ({
  course: g,
  modes: MODES.filter((m) => m.group === g),
}))

// 物語の場面一覧（入力した本文）。未プレイの場面は ？？？ で伏せる。
function StoryScenes({ story, mode }) {
  const stats = loadItemStats()
  return (
    <ol className="browse-list">
      {Object.entries(story.nodes).map(([id, n]) => {
        const s = stats[storyStatId(mode, story.id, id)]
        return (
          <li key={id} className="browse-item">
            {s ? (
              <>
                <span className="bi-en">{n.en}</span>
                <span className="bi-ja">{n.ja}</span>
                <span className="bi-stat">
                  練習 {s.count}回 ・ 平均ミス {(s.mistakes / s.count).toFixed(1)} ・{' '}
                  {(s.ms > 0 ? s.keys / (s.ms / 1000) : 0).toFixed(1)} 打/秒
                </span>
              </>
            ) : (
              <span className="bi-en">？？？</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function StoryRecords({ list, rankText = '物語' }) {
  const rows = list || []
  const { open, modal } = useRecordDetail()
  return (
    <div className="records">
      <h3>
        記録ランキング<span className="records-sub">（速い順・最大15件）</span>
      </h3>
      {rows.length === 0 ? (
        <p className="no-records">まだ記録がありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>速度</th>
              <th>正確率</th>
              <th>時間</th>
              <th>エンド</th>
              <th>日時</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className="row-click"
                onClick={() => open(r, i + 1, { rankText, list: rows, hasEnding: true })}
                title="クリックで記録の詳細"
              >
                <td>{i + 1}</td>
                <td className="speed">{r.speed} 打/分</td>
                <td>{r.accuracy}%</td>
                <td>{r.seconds}秒</td>
                <td>{r.endLabel}</td>
                <td className="date">{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modal}
    </div>
  )
}

export default function StorySection({
  storyId,
  onStoryIdChange,
  mode,
  onModeChange,
  onStart,
  bottomTab,
  onBottomTabChange,
  focusSection,
  onFocusSection,
}) {
  const story = storyById(storyId)
  const stories = STORIES.map((s) => ({
    id: s.id,
    title: s.title,
    sceneCount: Object.keys(s.nodes).length,
    endingCount: s.endingCount,
  }))
  const browseNode =
    bottomTab === 'list' ? (
      <StoryScenes story={story} mode={mode} />
    ) : (
      <StoryRecords list={loadStoryRecords(storyId)} rankText={story.title} />
    )
  return (
    <StorySectionView
      stories={stories}
      storyId={storyId}
      onStoryIdChange={onStoryIdChange}
      modeGroups={STORY_MODE_GROUPS}
      mode={mode}
      onModeChange={onModeChange}
      focusSection={focusSection}
      onFocusSection={onFocusSection}
      modeDesc={`「${modeLabel(mode)}」で物語を進め、選択肢で分岐します。`}
      poolCount={`この物語の収録: ${Object.keys(story.nodes).length} 場面 / ${story.endingCount} エンド`}
      onStart={onStart}
      bottomTab={bottomTab}
      onBottomTabChange={onBottomTabChange}
      browseNode={browseNode}
    />
  )
}
