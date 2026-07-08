import type { Meta, StoryObj } from '@storybook/react-vite'
import { AllRecordsView } from '@tll/ui'
import type { AllRecordRow, SortDir } from '@tll/ui'

const meta = {
  title: 'records/AllRecordsView',
  component: AllRecordsView,
} satisfies Meta<typeof AllRecordsView>
export default meta
type Story = StoryObj<typeof meta>

// Storybook 用のローカル並べ替え（本番は application/allRecords の sortAllRecords を注入）。
const KIND_ORDER: Record<string, number> = { wsent: 0, story: 1, words: 2, dict: 3 }
const sortFn = (list: AllRecordRow[], key: string, dir: SortDir): AllRecordRow[] => {
  const sign = dir === 'desc' ? -1 : 1
  const val = (r: AllRecordRow): number | string => {
    if (key === 'date') return r.dateTs
    if (key === 'kind') return KIND_ORDER[r.kind] ?? 99
    if (key === 'mode') return r.modeLabel
    if (key === 'theme') return r.theme ?? ''
    if (key === 'level') return r.level ?? -Infinity
    return (r as unknown as Record<string, number>)[key]
  }
  return [...list].sort((a, b) => {
    const va = val(a)
    const vb = val(b)
    const base = typeof va === 'string' ? String(va).localeCompare(String(vb)) : va < vb ? -1 : va > vb ? 1 : 0
    return base * sign
  })
}

const row = (over: Partial<AllRecordRow>): AllRecordRow => ({
  kind: 'words',
  kindLabel: '単語',
  level: 1,
  levelLabel: '基礎',
  mode: 'en',
  modeLabel: '英語',
  theme: 'すべて',
  speed: 0,
  accuracy: 0,
  mistakes: 0,
  keys: 0,
  seconds: 0,
  date: '2026/7/1 09:00:00',
  dateTs: 1,
  ...over,
})

const rows: AllRecordRow[] = [
  row({ kind: 'wsent', kindLabel: '文章', level: 2, levelLabel: '初級', mode: 'both', modeLabel: '英語・日本語', theme: '旅行', speed: 480, accuracy: 98, mistakes: 7, date: '2026/7/7 12:00:00', dateTs: 7 }),
  row({ kind: 'story', kindLabel: '物語', level: null, levelLabel: '', mode: 'both', modeLabel: '英語・日本語', theme: null, speed: 350, accuracy: 99, mistakes: 3, date: '2026/7/3 07:00:00', dateTs: 3 }),
  row({ kind: 'words', kindLabel: '単語', level: 3, levelLabel: '中級', mode: 'en', modeLabel: '英語', theme: '旅行', speed: 300, accuracy: 95, mistakes: 1, date: '2026/7/4 08:00:00', dateTs: 4 }),
  row({ kind: 'dict', kindLabel: '英英', level: 1, levelLabel: '基礎', mode: 'quiz', modeLabel: '単語4択', theme: 'すべて', speed: 200, accuracy: 80, mistakes: 2, date: '2026/7/5 09:00:00', dateTs: 5 }),
]

export const Default: Story = {
  render: () => (
    <AllRecordsView rows={rows} sortFn={sortFn} onExit={() => {}} onRowClick={() => {}} />
  ),
}
export const Empty: Story = {
  render: () => <AllRecordsView rows={[]} sortFn={sortFn} onExit={() => {}} />,
}
