// #360 記録詳細に共有 URL を与えるための純関数群 `recordDetailRoute.policy.js` の契約テスト。
// 対象（未実装＝この import で module-not-found の Red）:
//   - routeFromRawRecord(record, position) => RouteState|null
//       生記録＋position から record-detail RouteState を作る（結果ページから URL を組む用）。
//   - rowToDetailCtx(row) => { rankText, modeKey, list, isQuiz, hasEnding }
//       AllRecordsView.onRowClick の中身を純関数化（RecordDetail に渡すヘッダー文脈）。
//   - resolveColdDetail(route, maps) => { record, position, ctx } | null （全域）
//       URL 直開き（cold start）で route から該当記録を探し当てる。
//
// 独立性の方針：codec/policy の内部実装を写経せず、
//   「source→kind の写像・座標の導出（wsent=rank / story=storyId 等）・not-found の null・全域性」
// を外形として固定する。enum/ec は domain/content から import して期待値の単一ソースにする。
// 本ファイルは純粋（DOM/クロック/乱数/ストレージ非依存）なので既定 node 環境で回す。
import { describe, it, expect } from 'vitest'

// ↓ 本体は未実装。この import で「正しい理由の Red（module not found）」になる（狙い）。
import {
  routeFromRawRecord,
  rowToDetailCtx,
  resolveColdDetail,
} from './recordDetailRoute.policy.js'

import { makeEndCondition } from '../domain/session/endCondition.vo.js'

const ec = (kind, value) => makeEndCondition(kind, value)
const EC_DEFAULT = ec('time', 60)

// ── routeFromRawRecord: 生記録 → record-detail RouteState ──
describe('routeFromRawRecord（生記録＋position → RouteState|null）', () => {
  it('word 記録は kind=words（座標は record.level・theme/mode を写像）', () => {
    const rec = { source: 'word', level: 3, theme: '旅行', mode: 'en', keys: 80, endCondition: ec('time', 60) }
    expect(routeFromRawRecord(rec, 2)).toEqual({
      view: 'record-detail',
      kind: 'words',
      level: 3,
      theme: '旅行',
      mode: 'en',
      endCondition: EC_DEFAULT,
      position: 2,
    })
  })

  it('dict 記録は kind=dict（座標は record.level）', () => {
    const rec = { source: 'dict', level: 1, theme: 'すべて', mode: 'quiz', keys: 40, endCondition: ec('items', 25) }
    expect(routeFromRawRecord(rec, 3)).toEqual({
      view: 'record-detail',
      kind: 'dict',
      level: 1,
      theme: 'すべて',
      mode: 'quiz',
      endCondition: ec('items', 25),
      position: 3,
    })
  })

  it('wsent 記録は kind=wsent（座標は record.rank を level に写像）', () => {
    const rec = { source: 'wsent', rank: 2, theme: '旅行', mode: 'both', keys: 300, endCondition: ec('chars', 600) }
    expect(routeFromRawRecord(rec, 1)).toEqual({
      view: 'record-detail',
      kind: 'wsent',
      level: 2, // wsent は rank が level（recKey(mode, rank, source, theme)）
      theme: '旅行',
      mode: 'both',
      endCondition: ec('chars', 600),
      position: 1,
    })
  })

  it('source 未定義・"sentence" の記録も kind=wsent へ写像する（level は rank）', () => {
    const a = { mode: 'both', rank: 1, theme: 'すべて', keys: 100 } // source 未定義
    expect(routeFromRawRecord(a, 1)).toMatchObject({ view: 'record-detail', kind: 'wsent', level: 1 })
    const b = { source: 'sentence', mode: 'en', rank: 3, theme: '日常', keys: 100 }
    expect(routeFromRawRecord(b, 1)).toMatchObject({ view: 'record-detail', kind: 'wsent', level: 3 })
  })

  it('story 記録は kind=story（storyId を持ち level/theme/mode を持たない最小形）', () => {
    const rec = { source: 'story', storyId: 'travel', mode: 'en', keys: 120, endCondition: ec('time', 60) }
    expect(routeFromRawRecord(rec, 1)).toEqual({
      view: 'record-detail',
      kind: 'story',
      storyId: 'travel',
      endCondition: EC_DEFAULT,
      position: 1,
    })
  })

  it('endCondition が無い記録は既定 time60 を補完する', () => {
    const rec = { source: 'word', level: 1, theme: 'すべて', mode: 'en', keys: 40 } // endCondition 欠落
    expect(routeFromRawRecord(rec, 1).endCondition).toEqual(EC_DEFAULT)
  })

  it('touch / romaji の記録は URL 非対象として null を返す', () => {
    expect(routeFromRawRecord({ source: 'touch', mode: 'easy', rank: 1, keys: 50 }, 1)).toBeNull()
    expect(routeFromRawRecord({ source: 'romaji', mode: 'normal', rank: 'a', keys: 40 }, 1)).toBeNull()
  })

  it('position は加工せずそのまま載る（1 始まり・複数位）', () => {
    const rec = { source: 'word', level: 1, theme: 'すべて', mode: 'en', keys: 40 }
    expect(routeFromRawRecord(rec, 1).position).toBe(1)
    expect(routeFromRawRecord(rec, 5).position).toBe(5)
  })
})

// ── rowToDetailCtx: 正規化行 → RecordDetail ヘッダー文脈 ──
// 正規化行（flattenRecords の出力）は kind/kindLabel/levelLabel/theme/mode/siblings/raw を持つ。
// rowToDetailCtx はそれらから RecordDetail の open(record, position, ctx) の ctx を組む純関数。
describe('rowToDetailCtx（正規化行 → { rankText, modeKey, list, isQuiz, hasEnding }）', () => {
  it('単語行: rankText は種類＋レベル＋テーマ・modeKey/list/isQuiz/hasEnding を写す', () => {
    const siblings = [{ correct: null }, { correct: null }]
    const row = {
      kind: 'words',
      kindLabel: '単語',
      levelLabel: '基礎',
      theme: '旅行',
      mode: 'en',
      siblings,
      raw: { correct: null, keys: 80 }, // クイズ系でない（correct が null）
    }
    expect(rowToDetailCtx(row)).toEqual({
      rankText: '単語 基礎 / 旅行',
      modeKey: 'en',
      list: siblings,
      isQuiz: false,
      hasEnding: false,
    })
    // list は siblings 配列そのもの（参照共有＝ページ内切替に使う）
    expect(rowToDetailCtx(row).list).toBe(siblings)
  })

  it('クイズ系（raw.correct が数値）は isQuiz=true', () => {
    const row = {
      kind: 'dict', kindLabel: '英英', levelLabel: '基礎', theme: 'すべて', mode: 'quiz',
      siblings: [], raw: { correct: 8 },
    }
    expect(rowToDetailCtx(row).isQuiz).toBe(true)
  })

  it('物語行: rankText は種類ラベルのみ（レベル/テーマ無し）・hasEnding=true', () => {
    const siblings = [{}]
    const row = {
      kind: 'story',
      kindLabel: '物語',
      levelLabel: '', // 物語はレベル無し
      theme: null, // 物語はテーマ無し
      mode: 'en',
      siblings,
      raw: { keys: 120 },
    }
    expect(rowToDetailCtx(row)).toEqual({
      rankText: '物語',
      modeKey: 'en',
      list: siblings,
      isQuiz: false, // correct を持たない
      hasEnding: true, // 物語のみエンディング表示
    })
  })

  it('levelLabel が空・theme が null のときは種類ラベルのみ（区切りを付けない）', () => {
    const row = {
      kind: 'words', kindLabel: '単語', levelLabel: '', theme: null, mode: 'en',
      siblings: [], raw: {},
    }
    expect(rowToDetailCtx(row).rankText).toBe('単語')
  })
})

// ── resolveColdDetail: URL 直開きで route から該当記録を探す（全域） ──
// maps={records,dictRecords,wordRecords,storyRecords}。record-detail route の
// (kind, 座標, ec, position) に一致する行を探し、あれば {record:row.raw, position:row.position, ctx}、
// 無ければ null。どんな入力でも throw しない（全域）。
describe('resolveColdDetail（route + maps → { record, position, ctx } | null・全域）', () => {
  // words: 同座標で time60（endCondition 欠落＝既定）と chars600 の2ランキングを用意し、
  // ec の突き合わせが効くことを確かめる。
  const wordA = { source: 'word', level: 3, theme: '旅行', mode: 'en', keys: 80, date: 'd1' } // time60 pos1
  const wordB = { source: 'word', level: 3, theme: '旅行', mode: 'en', keys: 70, date: 'd2' } // time60 pos2
  const wordC = { source: 'word', level: 3, theme: '旅行', mode: 'en', keys: 600, endCondition: ec('chars', 600), date: 'd3' } // chars600 pos1
  const wsentA = { source: 'wsent', mode: 'both', rank: 2, theme: '旅行', keys: 300, date: 'd4' } // time60 pos1
  const storyA = { source: 'story', mode: 'en', storyId: 'travel', keys: 120, date: 'd5' } // time60 pos1

  const maps = () => ({
    records: {
      'both__wsent2__旅行': [wsentA],
    },
    dictRecords: {},
    wordRecords: {
      'L3__旅行__en': [wordA, wordB],
      'L3__旅行__en__C600': [wordC],
    },
    storyRecords: {
      'story-records-v1-travel': [storyA],
    },
  })

  const rdWords = (over) => ({
    view: 'record-detail', kind: 'words', level: 3, theme: '旅行', mode: 'en',
    endCondition: EC_DEFAULT, position: 1, ...over,
  })

  it('① words の一致行を返す（record は元記録そのもの・position 一致・ctx を伴う）', () => {
    const got = resolveColdDetail(rdWords({ position: 2 }), maps())
    expect(got).not.toBeNull()
    expect(got.record).toBe(wordB) // row.raw は元記録の参照
    expect(got.position).toBe(2)
    expect(got.ctx.modeKey).toBe('en')
    expect(got.ctx.hasEnding).toBe(false)
    expect(got.ctx.isQuiz).toBe(false)
  })

  it('① ec の違うランキングを取り違えない（chars600 は time60 と別の記録を返す）', () => {
    const gotDefault = resolveColdDetail(rdWords({ position: 1 }), maps())
    expect(gotDefault.record).toBe(wordA) // time60 の pos1
    const gotChars = resolveColdDetail(
      rdWords({ endCondition: ec('chars', 600), position: 1 }),
      maps(),
    )
    expect(gotChars.record).toBe(wordC) // chars600 の pos1
  })

  it('① wsent の一致行を返す（座標 level は record.rank と突き合わせる）', () => {
    const route = {
      view: 'record-detail', kind: 'wsent', level: 2, theme: '旅行', mode: 'both',
      endCondition: EC_DEFAULT, position: 1,
    }
    const got = resolveColdDetail(route, maps())
    expect(got.record).toBe(wsentA)
    expect(got.position).toBe(1)
  })

  it('① story の一致行を返す（storyId で束ね・座標は storyId＋ec）', () => {
    const route = {
      view: 'record-detail', kind: 'story', storyId: 'travel',
      endCondition: EC_DEFAULT, position: 1,
    }
    const got = resolveColdDetail(route, maps())
    expect(got.record).toBe(storyA)
    expect(got.ctx.hasEnding).toBe(true)
  })

  it('② range 外の position は null（該当順位が存在しない）', () => {
    expect(resolveColdDetail(rdWords({ position: 99 }), maps())).toBeNull()
  })

  it('③ 該当ランキングが無ければ null（存在しない座標）', () => {
    expect(resolveColdDetail(rdWords({ level: 4 }), maps())).toBeNull()
    expect(resolveColdDetail(rdWords({ theme: 'ビジネス' }), maps())).toBeNull()
  })

  it('④ 未知 kind は null（record-detail でない route も null）', () => {
    expect(resolveColdDetail(rdWords({ kind: 'touch' }), maps())).toBeNull()
    expect(resolveColdDetail({ view: 'records' }, maps())).toBeNull()
  })

  it('⑤ 空マップ・欠落マップ・不正 route でも throw せず null を返す（全域）', () => {
    expect(resolveColdDetail(rdWords(), { records: {}, dictRecords: {}, wordRecords: {}, storyRecords: {} })).toBeNull()
    expect(() => resolveColdDetail(rdWords(), {})).not.toThrow()
    expect(resolveColdDetail(rdWords(), {})).toBeNull()
    expect(() => resolveColdDetail(rdWords(), undefined)).not.toThrow()
    expect(() => resolveColdDetail(null, maps())).not.toThrow()
    expect(resolveColdDetail(null, maps())).toBeNull()
  })
})
