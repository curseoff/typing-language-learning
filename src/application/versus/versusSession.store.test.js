// #426 対戦基盤スライス3：対戦セッション純粋リデューサの単体テスト。
// 各 action の状態変化・progress 累積・peerFinished→allFinished での phase 遷移・
// peerLeft 除外・入力非破壊・未知 action の据え置きを固定する。
import { describe, it, expect } from 'vitest'
import { initSession, reduce } from './versusSession.store.js'
import { activeIds } from '../../domain/versus/peerRoster.service.js'

// self→countdown まで進めた状態を作るヘルパ（running/finished 系のテスト用）。
function connected(selfId = 'me') {
  let s = initSession(selfId)
  s = reduce(s, { type: 'peerJoined', peerId: 'rival' })
  s = reduce(s, { type: 'lifecycle', event: 'connectStarted' })
  s = reduce(s, { type: 'lifecycle', event: 'allConnected' })
  return s
}

describe('initSession', () => {
  it('初期形は waiting・role=null・自分だけの roster・startAt=null・progress 空', () => {
    const s = initSession('me')
    expect(s.phase).toBe('waiting')
    expect(s.role).toBeNull()
    expect(s.startAt).toBeNull()
    expect(s.progress).toEqual({})
    expect(activeIds(s.roster)).toEqual(['me'])
  })
})

describe('reduce: setRole', () => {
  it('role を設定する', () => {
    const s = reduce(initSession('me'), { type: 'setRole', role: 'host' })
    expect(s.role).toBe('host')
  })
})

describe('reduce: peerJoined / peerLeft', () => {
  it('peerJoined で roster に追加される（追加順を保つ）', () => {
    let s = initSession('me')
    s = reduce(s, { type: 'peerJoined', peerId: 'a' })
    s = reduce(s, { type: 'peerJoined', peerId: 'b' })
    expect(activeIds(s.roster)).toEqual(['me', 'a', 'b'])
  })

  it('peerLeft で active から除外される（順序台帳には残る）', () => {
    let s = initSession('me')
    s = reduce(s, { type: 'peerJoined', peerId: 'a' })
    s = reduce(s, { type: 'peerLeft', peerId: 'a' })
    expect(activeIds(s.roster)).toEqual(['me'])
  })
})

describe('reduce: lifecycle', () => {
  it('connectStarted → connecting、allConnected → countdown、raceStarted → running', () => {
    let s = initSession('me')
    s = reduce(s, { type: 'lifecycle', event: 'connectStarted' })
    expect(s.phase).toBe('connecting')
    s = reduce(s, { type: 'lifecycle', event: 'allConnected' })
    expect(s.phase).toBe('countdown')
    s = reduce(s, { type: 'lifecycle', event: 'raceStarted' })
    expect(s.phase).toBe('running')
  })

  it('順序外イベントは現状維持（寛容既定）', () => {
    const s = reduce(initSession('me'), { type: 'lifecycle', event: 'raceStarted' })
    expect(s.phase).toBe('waiting')
  })

  it('aborted はどの phase からでも finished へ落とす', () => {
    let s = reduce(initSession('me'), { type: 'lifecycle', event: 'connectStarted' })
    s = reduce(s, { type: 'lifecycle', event: 'aborted' })
    expect(s.phase).toBe('finished')
  })
})

describe('reduce: progress', () => {
  it('peerId ごとに進捗を記録する', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival).toEqual({ typed: 5, total: 20, mistakes: 1, at: 100 })
  })

  it('同一 peerId の続報は最新値で上書きし、余計なフィールドは持たない', () => {
    let s = initSession('me')
    s = reduce(s, {
      type: 'progress',
      message: { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100 },
    })
    s = reduce(s, {
      type: 'progress',
      message: { type: 'progress', peerId: 'rival', typed: 12, total: 20, mistakes: 2, at: 250, extra: 'x' },
    })
    expect(s.progress.rival).toEqual({ typed: 12, total: 20, mistakes: 2, at: 250 })
    expect(Object.keys(s.progress)).toEqual(['rival'])
  })

  it('複数 peer の進捗を並存させる', () => {
    let s = initSession('me')
    s = reduce(s, {
      type: 'progress',
      message: { type: 'progress', peerId: 'a', typed: 1, total: 10, mistakes: 0, at: 10 },
    })
    s = reduce(s, {
      type: 'progress',
      message: { type: 'progress', peerId: 'b', typed: 3, total: 10, mistakes: 0, at: 20 },
    })
    expect(Object.keys(s.progress).sort()).toEqual(['a', 'b'])
  })
})

describe('reduce: peerFinished → allFinished', () => {
  it('active 全員が完走したら phase=finished へ遷移する', () => {
    let s = connected('me') // phase=countdown, roster=[me, rival]
    s = reduce(s, { type: 'lifecycle', event: 'raceStarted' }) // running
    // rival だけ完走 → まだ全員ではないので running のまま
    s = reduce(s, { type: 'peerFinished', peerId: 'rival' })
    expect(s.phase).toBe('running')
    // me も完走 → active 全員完走 → finished
    s = reduce(s, { type: 'peerFinished', peerId: 'me' })
    expect(s.phase).toBe('finished')
  })

  it('running でない段階で全員完走しても transition の既定で暴発しない', () => {
    // countdown のまま全員 finished を立てても、running→finished 以外は現状維持。
    let s = connected('me') // countdown
    s = reduce(s, { type: 'peerFinished', peerId: 'rival' })
    s = reduce(s, { type: 'peerFinished', peerId: 'me' })
    expect(s.phase).toBe('countdown')
  })

  it('離脱した相手を除いた active 全員完走でも finished になる', () => {
    let s = initSession('me')
    s = reduce(s, { type: 'peerJoined', peerId: 'rival' })
    s = reduce(s, { type: 'lifecycle', event: 'connectStarted' })
    s = reduce(s, { type: 'lifecycle', event: 'allConnected' })
    s = reduce(s, { type: 'lifecycle', event: 'raceStarted' }) // running
    s = reduce(s, { type: 'peerLeft', peerId: 'rival' }) // rival 離脱→active は me だけ
    s = reduce(s, { type: 'peerFinished', peerId: 'me' })
    expect(s.phase).toBe('finished')
  })
})

describe('reduce: countdown', () => {
  it('startAt を記録し、connecting からは countdown へ入る', () => {
    let s = reduce(initSession('me'), { type: 'lifecycle', event: 'connectStarted' }) // connecting
    s = reduce(s, { type: 'countdown', startAt: 12345 })
    expect(s.startAt).toBe(12345)
    expect(s.phase).toBe('countdown')
  })

  it('既に countdown なら phase 据え置きで startAt だけ更新する', () => {
    let s = connected('me') // countdown, startAt=null
    s = reduce(s, { type: 'countdown', startAt: 999 })
    expect(s.phase).toBe('countdown')
    expect(s.startAt).toBe(999)
  })
})

describe('入力非破壊・未知 action', () => {
  it('どの action も元の state を変更しない', () => {
    const base = connected('me')
    const snapshot = structuredClone(base)
    reduce(base, { type: 'setRole', role: 'host' })
    reduce(base, { type: 'peerJoined', peerId: 'x' })
    reduce(base, { type: 'peerLeft', peerId: 'rival' })
    reduce(base, { type: 'lifecycle', event: 'raceStarted' })
    reduce(base, { type: 'peerFinished', peerId: 'rival' })
    reduce(base, { type: 'countdown', startAt: 1 })
    reduce(base, {
      type: 'progress',
      message: { type: 'progress', peerId: 'rival', typed: 1, total: 2, mistakes: 0, at: 1 },
    })
    expect(base).toEqual(snapshot)
  })

  it('未知 action は同一参照を返す', () => {
    const base = initSession('me')
    expect(reduce(base, { type: 'nope' })).toBe(base)
    expect(reduce(base, undefined)).toBe(base)
  })
})
