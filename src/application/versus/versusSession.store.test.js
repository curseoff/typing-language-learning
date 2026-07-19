// #426 対戦基盤スライス3：対戦セッション純粋リデューサの単体テスト。
// 各 action の状態変化・progress 累積・peerFinished→allFinished での phase 遷移・
// peerLeft 除外・入力非破壊・未知 action の据え置きを固定する。
import { describe, it, expect } from 'vitest'
import { initSession, reduce } from './versusSession.store.js'
import { activeIds, resetFinished } from '../../domain/versus/peerRoster.service.js'
import { initApproval, castVote, rejectedBy } from '../../domain/versus/approvalState.service.js'

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

// ── #432 P2P穴埋め対戦：承認/設定/seed/進捗correct・lives/サドンデス終了 ─────────
// 承認フロー・設定確定・差し戻し・進捗の correct/lives 取り込み・サドンデス終了を固定する。

const CONFIG = { mode: 'blank', questions: 5, theme: '日常' }

describe('initSession: #432 追加フィールド', () => {
  it('初期形に approval/config/seed/rejection が null で加わる（既存フィールドは不変）', () => {
    const s = initSession('me')
    expect(s.approval).toBeNull()
    expect(s.config).toBeNull()
    expect(s.seed).toBeNull()
    expect(s.rejection).toBeNull()
    // 既存フィールドは従来どおり
    expect(s.phase).toBe('waiting')
    expect(s.role).toBeNull()
    expect(s.startAt).toBeNull()
    expect(s.progress).toEqual({})
  })
})

describe('reduce: propose（承認フロー開始）', () => {
  it('approval を initApproval で生成し、seed を記録し、rejection をクリアする', () => {
    const s = reduce(initSession('me'), {
      type: 'propose',
      config: CONFIG,
      seed: 12345,
      memberIds: ['me', 'rival'],
      proposer: 'me',
    })
    expect(s.approval).toEqual(initApproval({ config: CONFIG, memberIds: ['me', 'rival'], proposer: 'me' }))
    expect(s.seed).toBe(12345)
    expect(s.rejection).toBeNull()
  })

  it('propose 段階では config をまだ commit しない（approval.config が正・state.config は null のまま）', () => {
    const s = reduce(initSession('me'), {
      type: 'propose',
      config: CONFIG,
      seed: 7,
      memberIds: ['me', 'rival'],
      proposer: 'me',
    })
    expect(s.config).toBeNull()
    expect(s.approval.config).toEqual(CONFIG)
  })

  it('入力（action と state）を破壊しない', () => {
    const base = initSession('me')
    const baseSnap = structuredClone(base)
    const action = { type: 'propose', config: CONFIG, seed: 7, memberIds: ['me', 'rival'], proposer: 'me' }
    const actionSnap = structuredClone(action)
    reduce(base, action)
    expect(base).toEqual(baseSnap)
    expect(action).toEqual(actionSnap)
  })
})

describe('reduce: vote（投票委譲）', () => {
  it('approval があれば castVote の結果に置換する', () => {
    let s = reduce(initSession('me'), {
      type: 'propose',
      config: CONFIG,
      seed: 1,
      memberIds: ['me', 'rival'],
      proposer: 'me',
    })
    const before = s.approval
    s = reduce(s, { type: 'vote', peerId: 'rival', vote: 'accept' })
    expect(s.approval).toEqual(castVote(before, 'rival', 'accept'))
  })

  it('approval が null なら現状維持（同一参照を返す）', () => {
    const base = initSession('me')
    expect(reduce(base, { type: 'vote', peerId: 'rival', vote: 'accept' })).toBe(base)
  })
})

describe('reduce: configAccepted（設定確定）', () => {
  it('approval.config を config へ commit し、approval と rejection をクリアする（phase は不変）', () => {
    let s = reduce(initSession('me'), {
      type: 'propose',
      config: CONFIG,
      seed: 1,
      memberIds: ['me', 'rival'],
      proposer: 'me',
    })
    const phaseBefore = s.phase
    s = reduce(s, { type: 'configAccepted' })
    expect(s.config).toEqual(CONFIG)
    expect(s.approval).toBeNull()
    expect(s.rejection).toBeNull()
    expect(s.phase).toBe(phaseBefore) // カウントダウンは別 action
  })

  it('approval が null のときは現状維持で安全（config は null のまま・throw しない）', () => {
    const base = initSession('me')
    const s = reduce(base, { type: 'configAccepted' })
    expect(s.config).toBeNull()
    expect(s.approval).toBeNull()
  })
})

describe('reduce: configRejected（ロビーへ差し戻し）', () => {
  it('rejection.by に rejectedBy を記録し、approval/config/seed をクリアする', () => {
    let s = reduce(initSession('me'), {
      type: 'propose',
      config: CONFIG,
      seed: 999,
      memberIds: ['me', 'rival'],
      proposer: 'me',
    })
    s = reduce(s, { type: 'vote', peerId: 'rival', vote: 'reject' })
    const approvalBefore = s.approval
    s = reduce(s, { type: 'configRejected' })
    expect(s.rejection).toEqual({ by: rejectedBy(approvalBefore) })
    expect(s.rejection.by).toEqual(['rival'])
    expect(s.approval).toBeNull()
    expect(s.config).toBeNull()
    expect(s.seed).toBeNull()
  })
})

describe('reduce: progress の correct/lives 取り込み（後方互換）', () => {
  it('message に correct/lives があれば progress エントリに含める', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100, correct: 3, lives: 2 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival).toEqual({ typed: 5, total: 20, mistakes: 1, at: 100, correct: 3, lives: 2 })
  })

  it('correct のみあれば correct だけ含める（lives は含めない）', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100, correct: 3 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival).toEqual({ typed: 5, total: 20, mistakes: 1, at: 100, correct: 3 })
    expect('lives' in s.progress.rival).toBe(false)
  })

  it('correct/lives の無い旧メッセージは従来どおり（correct/lives キーを持たない）', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival).toEqual({ typed: 5, total: 20, mistakes: 1, at: 100 })
    expect('correct' in s.progress.rival).toBe(false)
    expect('lives' in s.progress.rival).toBe(false)
  })
})

// #432 相手カードの速度・時間が0：progress メッセージの speed/elapsedMs を進捗エントリに取り込む。
// message に speed/elapsedMs があれば含め、無ければ従来どおり含めない（後方互換）。
describe('reduce: progress の speed/elapsedMs 取り込み（後方互換）', () => {
  it('message に speed/elapsedMs があれば progress エントリに含める', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100, speed: 185, elapsedMs: 4200 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival).toEqual({ typed: 5, total: 20, mistakes: 1, at: 100, speed: 185, elapsedMs: 4200 })
  })

  it('speed のみあれば speed だけ含める（elapsedMs は含めない）', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100, speed: 185 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival).toEqual({ typed: 5, total: 20, mistakes: 1, at: 100, speed: 185 })
    expect('elapsedMs' in s.progress.rival).toBe(false)
  })

  it('elapsedMs のみあれば elapsedMs だけ含める（speed は含めない）', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100, elapsedMs: 4200 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival).toEqual({ typed: 5, total: 20, mistakes: 1, at: 100, elapsedMs: 4200 })
    expect('speed' in s.progress.rival).toBe(false)
  })

  it('speed/elapsedMs の無い旧メッセージは従来どおり（両キーを持たない）', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect('speed' in s.progress.rival).toBe(false)
    expect('elapsedMs' in s.progress.rival).toBe(false)
  })

  it('correct/lives と speed/elapsedMs を併せ持つ message は全て取り込む', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100, correct: 3, lives: 2, speed: 185, elapsedMs: 4200 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival).toEqual({ typed: 5, total: 20, mistakes: 1, at: 100, correct: 3, lives: 2, speed: 185, elapsedMs: 4200 })
  })
})

// #439 盤面複製：progress メッセージの miss（boolean）を進捗エントリに透過する（伏字マスの赤描画用）。
// #437 の cells 透過は撤去（方式Bで長さ情報は board.answerShape が運ぶ）＝cells は保存しない。
// miss=false は falsy でも保持する（'in' 判定であること）。
describe('reduce: progress の miss 取り込み（後方互換・#439）', () => {
  it('message に miss:true があれば保持する', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100, miss: true }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival.miss).toBe(true)
  })

  it('miss:false も保持する（false を落とさない）', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100, miss: false }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect('miss' in s.progress.rival).toBe(true)
    expect(s.progress.rival.miss).toBe(false)
  })

  it('cells は撤去済み＝message に cells があっても保存しない（無害に落とす）', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100, cells: 4 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect('cells' in s.progress.rival).toBe(false)
  })

  it('miss の無い旧メッセージは従来どおり（miss キーを持たない）', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival).toEqual({ typed: 5, total: 20, mistakes: 1, at: 100 })
    expect('miss' in s.progress.rival).toBe(false)
  })

  it('correct/lives/speed/elapsedMs と miss を併せ持つ message は全て取り込む（cells は落とす）', () => {
    const msg = {
      type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100,
      correct: 3, lives: 2, speed: 185, elapsedMs: 4200, cells: 6, miss: true,
    }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival).toEqual({
      typed: 5, total: 20, mistakes: 1, at: 100,
      correct: 3, lives: 2, speed: 185, elapsedMs: 4200, miss: true,
    })
  })
})

// #439 盤面複製（方式B・PR2 store）：progress メッセージの qIndex（非負整数）/
// typedSide（'en'|'ja'）/curPos（非負整数）を進捗エントリへ透過する。cells/miss と同方針で
// message にあれば含め、無ければキーを持たない（後方互換）。qIndex=0/curPos=0 は 'in' 判定で保持する。
describe('reduce: progress の qIndex/typedSide/curPos 取り込み（後方互換・#439）', () => {
  it('message に qIndex/typedSide/curPos があれば progress エントリに含める', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100, qIndex: 2, typedSide: 'en', curPos: 3 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival).toEqual({ typed: 5, total: 20, mistakes: 1, at: 100, qIndex: 2, typedSide: 'en', curPos: 3 })
  })

  it("typedSide:'ja' も保持する", () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100, typedSide: 'ja' }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival.typedSide).toBe('ja')
  })

  it('qIndex=0 を保持する（0 を falsy で落とさない＝in 判定）', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100, qIndex: 0 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect('qIndex' in s.progress.rival).toBe(true)
    expect(s.progress.rival.qIndex).toBe(0)
  })

  it('curPos=0 を保持する（0 を falsy で落とさない＝in 判定）', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100, curPos: 0 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect('curPos' in s.progress.rival).toBe(true)
    expect(s.progress.rival.curPos).toBe(0)
  })

  it('qIndex/typedSide/curPos の無い旧メッセージは従来どおり（3 キーを持たない）', () => {
    const msg = { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100 }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival).toEqual({ typed: 5, total: 20, mistakes: 1, at: 100 })
    expect('qIndex' in s.progress.rival).toBe(false)
    expect('typedSide' in s.progress.rival).toBe(false)
    expect('curPos' in s.progress.rival).toBe(false)
  })

  it('miss/speed/elapsedMs と qIndex/typedSide/curPos を併せ持つ message は全て取り込む（cells は落とす）', () => {
    const msg = {
      type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100,
      speed: 185, elapsedMs: 4200, cells: 6, miss: true, qIndex: 4, typedSide: 'ja', curPos: 7,
    }
    const s = reduce(initSession('me'), { type: 'progress', message: msg })
    expect(s.progress.rival).toEqual({
      typed: 5, total: 20, mistakes: 1, at: 100,
      speed: 185, elapsedMs: 4200, miss: true, qIndex: 4, typedSide: 'ja', curPos: 7,
    })
  })
})

// #439 盤面複製（方式B・PR2 store）：受信 board（parseMessage 済み）を peer ごとに「最新 1 件」キャッシュする
// 新 action 'board'。キー設計は boards[peerId]=board（最新 board 1 件）で仕様化する。
// both モード（同一 qIndex に en/ja 2 board）は「表示は今アクティブな side だけ」なので最新表示で足りる、と割り切る。
// （※ 曖昧点として司令塔へ確認済み：peerId×qIndex×side を全保持する要求が出れば設計を見直す。）
const BOARD_RIVAL_2 = {
  type: 'board', peerId: 'rival', qIndex: 2, typedSide: 'en', word: 'apple',
  wordJa: 'りんご', answerShape: [5],
}

describe('initSession: #439 boards フィールド', () => {
  it('初期形に boards が空オブジェクトで加わる（既存フィールドは不変）', () => {
    const s = initSession('me')
    expect(s.boards).toEqual({})
    // 既存フィールドは従来どおり
    expect(s.phase).toBe('waiting')
    expect(s.progress).toEqual({})
  })
})

describe('reduce: board（受信 board の最新1件キャッシュ・#439）', () => {
  it('受信 board を boards[peerId] にそのまま格納する（最新 1 件保持）', () => {
    const s = reduce(initSession('me'), { type: 'board', message: BOARD_RIVAL_2 })
    expect(s.boards.rival).toEqual(BOARD_RIVAL_2)
  })

  it('同一 peer の board 再送は最新で上書きする（後勝ち・both の en↔ja 切替も最新表示）', () => {
    let s = initSession('me')
    s = reduce(s, { type: 'board', message: BOARD_RIVAL_2 })
    const nextJa = { type: 'board', peerId: 'rival', qIndex: 2, typedSide: 'ja', word: 'apple', wordJa: 'りんご', answerShape: [3] }
    s = reduce(s, { type: 'board', message: nextJa })
    expect(s.boards.rival).toEqual(nextJa)
    // peer は増えない（同一 peer の上書き）。
    expect(Object.keys(s.boards)).toEqual(['rival'])
  })

  it('別の qIndex の board も最新で上書きする（peer あたり 1 件のみ保持）', () => {
    let s = initSession('me')
    s = reduce(s, { type: 'board', message: BOARD_RIVAL_2 })
    const q3 = { type: 'board', peerId: 'rival', qIndex: 3, typedSide: 'en', word: 'banana', answerShape: [6] }
    s = reduce(s, { type: 'board', message: q3 })
    expect(s.boards.rival).toEqual(q3)
    expect(Object.keys(s.boards)).toEqual(['rival'])
  })

  it('別 peer の board は独立に保持する', () => {
    let s = initSession('me')
    s = reduce(s, { type: 'board', message: BOARD_RIVAL_2 })
    const other = { type: 'board', peerId: 'foe', qIndex: 0, typedSide: 'en', word: 'cat', answerShape: [3] }
    s = reduce(s, { type: 'board', message: other })
    expect(s.boards.rival).toEqual(BOARD_RIVAL_2)
    expect(s.boards.foe).toEqual(other)
    expect(Object.keys(s.boards).sort()).toEqual(['foe', 'rival'])
  })

  it('progress など他の state は保持する（boards だけを更新する）', () => {
    let s = initSession('me')
    s = reduce(s, {
      type: 'progress',
      message: { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100 },
    })
    const progressBefore = s.progress
    s = reduce(s, { type: 'board', message: BOARD_RIVAL_2 })
    expect(s.progress).toEqual(progressBefore)
    expect(s.boards.rival).toEqual(BOARD_RIVAL_2)
  })

  it('元の state を破壊しない（新オブジェクトを返す）', () => {
    const base = initSession('me')
    const snapshot = structuredClone(base)
    const s = reduce(base, { type: 'board', message: BOARD_RIVAL_2 })
    expect(base).toEqual(snapshot)
    expect(s).not.toBe(base)
    expect(s.boards).not.toBe(base.boards)
  })
})

describe('reduce: suddenDeathEnd（サドンデス終了）', () => {
  it('running から finished へ遷移する（matchState の allFinished 流用）', () => {
    let s = connected('me')
    s = reduce(s, { type: 'lifecycle', event: 'raceStarted' }) // running
    s = reduce(s, { type: 'suddenDeathEnd' })
    expect(s.phase).toBe('finished')
  })

  it('running でない段階では暴発しない（countdown は据え置き）', () => {
    const s0 = connected('me') // countdown
    const s = reduce(s0, { type: 'suddenDeathEnd' })
    expect(s.phase).toBe('countdown')
  })
})

// ── #432 ナビ改善：対戦終了後の再戦・接続終了リセット ───────────────────────
// resetMatch＝接続を保ったままロビー（countdown フェーズ）へ戻す再戦リセット。
// reset＝接続終了後の完全初期化（initSession 相当・接続画面へ戻す）。

// config 確定・進捗あり・両者完走した「対戦終了直後」の state を作るヘルパ。
function finishedMatch(selfId = 'me') {
  let s = connected(selfId) // countdown, roster=[me, rival]
  s = reduce(s, { type: 'setRole', role: 'host' })
  s = reduce(s, { type: 'propose', config: CONFIG, seed: 42, memberIds: ['me', 'rival'], proposer: 'me' })
  s = reduce(s, { type: 'configAccepted' }) // config=CONFIG
  s = reduce(s, { type: 'lifecycle', event: 'raceStarted' }) // running
  s = reduce(s, {
    type: 'progress',
    message: { type: 'progress', peerId: 'rival', typed: 5, total: 20, mistakes: 1, at: 100 },
  })
  s = reduce(s, { type: 'peerFinished', peerId: 'rival' })
  s = reduce(s, { type: 'peerFinished', peerId: 'me' }) // 両者完走 → finished
  return s
}

describe('reduce: resetMatch（接続維持のロビー復帰・#432）', () => {
  it('config/approval/seed/rejection/progress をクリアする', () => {
    const s = reduce(finishedMatch('me'), { type: 'resetMatch' })
    expect(s.config).toBeNull()
    expect(s.approval).toBeNull()
    expect(s.seed).toBeNull()
    expect(s.rejection).toBeNull()
    expect(s.progress).toEqual({})
  })

  it('roster は resetFinished 相当（完了フラグが全 peer で false に戻る）', () => {
    const base = finishedMatch('me')
    const s = reduce(base, { type: 'resetMatch' })
    expect(s.roster).toEqual(resetFinished(base.roster))
    expect(s.roster.peers.me.finished).toBe(false)
    expect(s.roster.peers.rival.finished).toBe(false)
  })

  it('phase は countdown（接続済みロビー）に設定する', () => {
    const s = reduce(finishedMatch('me'), { type: 'resetMatch' })
    expect(s.phase).toBe('countdown')
  })

  it('role は保持する（host/guest のまま）', () => {
    const s = reduce(finishedMatch('me'), { type: 'resetMatch' })
    expect(s.role).toBe('host')
  })

  it('差し戻し（rejection あり）状態からでも rejection をクリアする', () => {
    let s = connected('me')
    s = reduce(s, { type: 'propose', config: CONFIG, seed: 9, memberIds: ['me', 'rival'], proposer: 'me' })
    s = reduce(s, { type: 'vote', peerId: 'rival', vote: 'reject' })
    s = reduce(s, { type: 'configRejected' }) // rejection.by=['rival']
    s = reduce(s, { type: 'resetMatch' })
    expect(s.rejection).toBeNull()
  })

  it('元の state を破壊しない（新オブジェクトを返す）', () => {
    const base = finishedMatch('me')
    const snapshot = structuredClone(base)
    const s = reduce(base, { type: 'resetMatch' })
    expect(base).toEqual(snapshot)
    expect(s).not.toBe(base)
  })
})

describe('reduce: reset（完全初期化・接続画面へ・#432）', () => {
  it('initSession(selfId) と等価な state を返す', () => {
    const base = finishedMatch('me')
    const s = reduce(base, { type: 'reset', selfId: 'me' })
    expect(s).toEqual(initSession('me'))
  })

  it('phase は waiting・roster は自分だけ・approval/config/seed/rejection は初期値', () => {
    const s = reduce(finishedMatch('me'), { type: 'reset', selfId: 'me' })
    expect(s.phase).toBe('waiting')
    expect(activeIds(s.roster)).toEqual(['me'])
    expect(s.approval).toBeNull()
    expect(s.config).toBeNull()
    expect(s.seed).toBeNull()
    expect(s.rejection).toBeNull()
    expect(s.role).toBeNull()
    expect(s.progress).toEqual({})
  })

  it('元の state を破壊しない', () => {
    const base = finishedMatch('me')
    const snapshot = structuredClone(base)
    reduce(base, { type: 'reset', selfId: 'me' })
    expect(base).toEqual(snapshot)
  })
})

// ── #432 ホスト権威の対戦終了配布：matchEnded action ─────────────────────
// matchEnded＝ホストが配布する対戦終了。受信側は現在の phase に関わらず phase を
// 'finished' に確定し、結果表示に使う roster/progress/config/seed 等は保持する。
describe('reduce: matchEnded（ホスト権威の対戦終了・#432）', () => {
  it('running から phase=finished へ確定する', () => {
    let s = connected('me')
    s = reduce(s, { type: 'lifecycle', event: 'raceStarted' }) // running
    s = reduce(s, { type: 'matchEnded' })
    expect(s.phase).toBe('finished')
  })

  it('countdown からでも phase=finished へ強制する（ホスト権威の終了）', () => {
    const s = reduce(connected('me'), { type: 'matchEnded' }) // countdown → finished
    expect(s.phase).toBe('finished')
  })

  it('running（未完走）から強制終了しても progress/roster/config/seed を保持する（結果表示に使う）', () => {
    // config/seed/progress を積んだ running 状態（まだ誰も完走していない＝phase は running）。
    let base = connected('me') // countdown, roster=[me, rival]
    base = reduce(base, { type: 'setRole', role: 'host' })
    base = reduce(base, { type: 'propose', config: CONFIG, seed: 42, memberIds: ['me', 'rival'], proposer: 'me' })
    base = reduce(base, { type: 'configAccepted' }) // config=CONFIG
    base = reduce(base, { type: 'lifecycle', event: 'raceStarted' }) // running
    base = reduce(base, {
      type: 'progress',
      message: { type: 'progress', peerId: 'rival', typed: 8, total: 20, mistakes: 2, at: 200 },
    })
    expect(base.phase).toBe('running') // 前提：まだ finished でない
    const s = reduce(base, { type: 'matchEnded' })
    expect(s.phase).toBe('finished') // 強制終了
    expect(s.config).toEqual(CONFIG)
    expect(s.seed).toBe(42)
    expect(s.progress).toEqual(base.progress)
    expect(s.roster).toEqual(base.roster)
  })

  it('元の state を破壊しない（新オブジェクトを返す）', () => {
    let base = connected('me')
    base = reduce(base, { type: 'lifecycle', event: 'raceStarted' }) // running
    const snapshot = structuredClone(base)
    const s = reduce(base, { type: 'matchEnded' })
    expect(base).toEqual(snapshot)
    expect(s).not.toBe(base)
  })
})

describe('入力非破壊: #432 追加 action', () => {
  it('propose/vote/configAccepted/configRejected/suddenDeathEnd は元の state を変更しない', () => {
    let base = reduce(initSession('me'), {
      type: 'propose',
      config: CONFIG,
      seed: 1,
      memberIds: ['me', 'rival'],
      proposer: 'me',
    })
    const snapshot = structuredClone(base)
    reduce(base, { type: 'vote', peerId: 'rival', vote: 'accept' })
    reduce(base, { type: 'configAccepted' })
    reduce(base, { type: 'configRejected' })
    reduce(base, { type: 'suddenDeathEnd' })
    reduce(base, {
      type: 'progress',
      message: { type: 'progress', peerId: 'rival', typed: 1, total: 2, mistakes: 0, at: 1, correct: 1, lives: 3 },
    })
    expect(base).toEqual(snapshot)
  })
})
