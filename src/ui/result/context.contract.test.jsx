// @vitest-environment jsdom
// ui の Context（.context.jsx）を共通契約（assertContext）に載せるメタテスト。#340（#322 契約テストシリーズ）。
// Context は「App が上で provide したコールバックを props バケツリレー無しで深い consumer へ配る」薄い配線＝
// createContext + Provider + useContext のトリオ。責務は値を配ることに限られ、業務ロジック（状態/計算/
// ドメイン参照）を持たず、既定値は Provider 外（未配線）でも consumer が壊れない null にする。
// ファイル名は .contract.test.jsx ＝命名メタテスト（.context.jsx サフィックス強制）の対象外。
import { describe } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assertContext } from '../../test/contracts/context.js'
import { ReplayProvider, useReplay } from './ReplayContext.context.jsx'
import { RecordDetailProvider, useOpenDetail } from './RecordDetailContext.context.jsx'

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

describe('Context契約: Replay（もう一度チャレンジの配線）', () =>
  assertContext({
    Provider: ReplayProvider,
    valueProp: 'onReplay',
    useValue: useReplay,
    sampleValue: () => 'replay!', // provide したコールバックが同一参照で届くこと
    source: read('./ReplayContext.context.jsx'),
  }))

describe('Context契約: RecordDetail（記録詳細を URL と同期して開く配線）', () =>
  assertContext({
    Provider: RecordDetailProvider,
    valueProp: 'openDetail',
    useValue: useOpenDetail,
    sampleValue: (record, position) => ({ record, position }),
    source: read('./RecordDetailContext.context.jsx'),
  }))
