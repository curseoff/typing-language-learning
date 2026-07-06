// @vitest-environment jsdom
// presenter smoke（#233 M7）
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import EndConditionSelect from './EndConditionSelect'

afterEach(cleanup)

const noop = () => {}
const kinds = [
  { kind: 'time', label: '時間' },
  { kind: 'chars', label: '文字数' },
  { kind: 'items', label: '問題数' },
  { kind: 'endless', label: 'エンドレス' },
]
const valueLabel = (kind: string, v: number) =>
  kind === 'time' ? `${v}秒` : kind === 'chars' ? `${v}字` : kind === 'items' ? `${v}問` : `${v}`

describe('EndConditionSelect smoke', () => {
  it('時間/文字数/エンドレス', () => {
    render(
      <EndConditionSelect kinds={kinds} kind="time" value={60} values={[30, 60, 120, 300]} valueLabel={valueLabel} focusSection="end" onChange={noop} onChangeValue={noop} onFocusSection={noop} />,
    )
    render(
      <EndConditionSelect kinds={kinds} kind="chars" value={600} values={[300, 600, 1200]} valueLabel={valueLabel} focusSection="endKind" onChange={noop} onChangeValue={noop} onFocusSection={noop} />,
    )
    const { container } = render(
      <EndConditionSelect kinds={kinds} kind="endless" value={null} values={[]} valueLabel={valueLabel} focusSection="endKind" onChange={noop} onChangeValue={noop} onFocusSection={noop} />,
    )
    expect(container.textContent).toContain('エンドレス')
  })
})
