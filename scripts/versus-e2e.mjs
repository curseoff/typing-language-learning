// #446 対戦（サドンデス）の決着を Chrome 2 個で実挙動検証する E2E ドライバ（ローカル専用・CI 非組込）。
// 手でやると「2 タブ開く → コード交換 → ロビー合意 → 狙った回数だけ正解/ミスする」が毎回必要な検証を、
// Bash 一発で再現する。判定は VersusMatch の DEV 限定フック window.__tllVersus（読み取り専用）に乗る：
//   snapshot() … { selfId, isHost, phase, endKind, initialLives, self, others, outcome }
//   nextKey()  … 打てば正解として1つ進むキー／wrongKey() … 必ずミスになるキー
// 検証の要点は「両方のブラウザで決着が同じに見えること」＝片側だけ finished／片側だけ ongoing を捕まえる。
//
// 使い方（既に動いている dev サーバを再利用する。自前では起動しない）:
//   npm run dev            # 別ターミナルで起動しておく
//   npm run versus:e2e -- --scenario all
//   npm run versus:e2e -- --scenario a-eliminated-b-ahead --headful --lives 3
//   # --lives 未指定時はシナリオ既定（SCENARIO_LIVES）を使う（実機の再現条件に合わせるため）
//   CHROME_PATH=/path/to/chrome npm run versus:e2e -- --scenario draw
//
//   # 手で対戦を試したいとき（#452）：接続の往復だけ自動化し、ロビーで止めて操作を渡す
//   npm run versus:e2e -- --setup-only
//   npm run versus:e2e -- --setup-only --window-size 800x900
//
// Chromium は同梱せず（puppeteer-core）、システムの Chrome を 2 プロセス起動する。
import { existsSync, mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import puppeteer from 'puppeteer-core'

// page.evaluate のコールバックはブラウザ文脈で実行される（window/document はそこの global）。
/* global window, document */

const DEFAULT_BASE = 'http://localhost:5173'
const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_LIVES = 3
const SHOT_DIR = 'tmp/versus-e2e' // 失敗時のスクショ置き場（相対・tmp は gitignore 済み）
// --setup-only の既定ウィンドウ（左右に並べる）。実画面の解像度は分からないので、
// 大抵のノート/外部ディスプレイで 2 枚が収まる常識的な値にしておく（--window-size で上書き可）。
const DEFAULT_SETUP_WINDOW = { width: 960, height: 1000 }

// ---- CLI ----------------------------------------------------------------

// `--key value` / `--flag` 形式の最小パーサ（scripts/ 既存と同じ素朴さ）。
function parseArgs(argv) {
  const opts = {
    scenario: null,
    base: DEFAULT_BASE,
    lives: DEFAULT_LIVES,
    livesExplicit: false,
    headful: false,
    // --keep-open は「シナリオを完走したあとブラウザを残す」＝結果を目で確かめるためのもの。
    // 手で対戦を続きから遊ぶための --setup-only とは目的が違う（混同しないこと）。
    keepOpen: false,
    setupOnly: false,
    windowSize: null,
    timeout: DEFAULT_TIMEOUT_MS,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--scenario') opts.scenario = argv[++i]
    else if (a === '--base') opts.base = argv[++i]
    else if (a === '--lives') {
      opts.lives = Number(argv[++i])
      opts.livesExplicit = true // 明示指定はシナリオ既定（SCENARIO_LIVES）より優先する
    }
    else if (a === '--timeout') opts.timeout = Number(argv[++i])
    else if (a === '--headful') opts.headful = true
    else if (a === '--keep-open') opts.keepOpen = true
    else if (a === '--setup-only') opts.setupOnly = true
    else if (a === '--window-size') opts.windowSize = argv[++i]
    else {
      console.error(`✖ 不明な引数: ${a}`)
      process.exit(1)
    }
  }
  return opts
}

// `--window-size 960x1000`（`960,1000` も可）を { width, height } に直す。不正なら null。
function parseWindowSize(s) {
  if (!s) return null
  const m = /^(\d+)[x,](\d+)$/i.exec(s.trim())
  if (!m) return null
  return { width: Number(m[1]), height: Number(m[2]) }
}

// Chrome 実行パスを解決する。環境変数優先、無ければ macOS 既定（check-pwa.mjs と同じ規約）。
function resolveChrome() {
  const cand =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  if (!existsSync(cand)) {
    console.error(
      `✖ Chrome が見つかりません: ${cand}\n  CHROME_PATH=/path/to/chrome を設定してください。`,
    )
    process.exit(1)
  }
  return cand
}

// ---- 汎用の待ち -----------------------------------------------------------

// 期限（deadline）付きのポーリング待ち。fn が truthy を返したらその値を返す。
// タイムアウトは label を添えて投げる（どの局面で止まったかが失敗ログで分かるように）。
async function waitFor(fn, label, deadline, intervalMs = 100) {
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > deadline) throw new Error(`待ち時間切れ: ${label}`)
    await sleep(intervalMs)
  }
}

// セレクタに一致する要素のうち、テキストに text を含む最初のものを click する。
// 見た目のクラス名だけでは一意にならない箇所（種目タブ・終了条件チップ等）用。
async function clickByText(page, selector, text, deadline) {
  await waitFor(
    () =>
      page.evaluate(
        (sel, t) => {
          const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(t))
          if (!el) return false
          el.click()
          return true
        },
        selector,
        text,
      ),
    `クリック対象が出ない: ${selector}「${text}」`,
    deadline,
  )
}

// React 制御コンポーネントの textarea へ接続コードを入れる。value 直代入は onChange が発火せず
// state に載らないため、実際に focus して打鍵する（delay 0＝1 キーずつ input イベントが出る）。
async function typeInto(page, selector, text, deadline) {
  await waitFor(() => page.$(selector), `入力欄が出ない: ${selector}`, deadline)
  await page.click(selector)
  await page.type(selector, text, { delay: 0 })
}

// ---- DEV フック（window.__tllVersus）----------------------------------------

const snapshot = (page) => page.evaluate(() => window.__tllVersus?.snapshot() ?? null)
const nextKey = (page) => page.evaluate(() => window.__tllVersus?.nextKey() ?? null)
const wrongKey = (page) => page.evaluate(() => window.__tllVersus?.wrongKey() ?? null)

// PlayArea のマウント（＝カウントダウン終了）を待つ。接続/ロビー/承認中は __tllVersus は未定義。
async function waitRunning(page, deadline) {
  return waitFor(
    async () => {
      const s = await snapshot(page)
      return s && s.phase === 'running' ? s : false
    },
    'phase=running（対戦開始）にならない',
    deadline,
  )
}

// ---- 打鍵プリミティブ -------------------------------------------------------
// 観測できる信号は snapshot の correct（一発正解した問題数）と lives（残ライフ）だけなので、
// 「1問を正解しきる」＝correct が 1 増えるまで nextKey を打ち続ける、で問題境界を跨ぐ。

// 1問を正解しきる（correct を 1 増やす）。nextKey が null の間（問題の切り替わり）は少し待つ。
async function answerCorrect(page, deadline, who) {
  const before = (await snapshot(page)).self.correct
  for (;;) {
    const k = await nextKey(page)
    if (k != null) await page.keyboard.press(k)
    else await sleep(20)
    const s = await snapshot(page)
    if (s.self.correct > before) return s
    if (s.phase !== 'running') throw new Error(`${who}: 正解の途中で phase=${s.phase} になった`)
    if (Date.now() > deadline) throw new Error(`${who}: 1問を正解しきれない（correct=${s.self.correct}）`)
  }
}

// ライフを1つ減らして次の問題まで進む（ミス→そのミス問題を打ち切り→次の1問を正解＝correct +1）。
// ミスした問題は correct を増やさないので、correct の増加を「ミス問題を抜けた」判定に流用している。
// 脱落（lives 0）させる最後の1回にはこれを使わない（凍結後は correct が伸びず待ちが返らないため）。
async function loseLifeAndAdvance(page, deadline, who) {
  await missOnce(page, deadline, who)
  await answerCorrect(page, deadline, who)
}

// 現在の問題で1回ミスする（ライフが即座に1減るのを確認する）。
// missedItemCount は「進行中ミスあり」も 1 問として数えるため、打鍵直後に lives が減る。
async function missOnce(page, deadline, who) {
  const before = (await snapshot(page)).self.lives
  const k = await wrongKey(page)
  if (k == null) throw new Error(`${who}: ミス用のキーが取れない（打鍵対象が無い）`)
  await page.keyboard.press(k)
  await waitFor(
    async () => (await snapshot(page)).self.lives < before,
    `${who}: ミスしてもライフが減らない（lives=${before}）`,
    deadline,
  )
}

// ライフを 0 まで減らして脱落する。最後の1回はミスだけ（脱落後は入力が止まり correct も凍結する）。
async function eliminate(page, deadline, who) {
  const { self } = await snapshot(page)
  for (let i = self.lives; i > 1; i--) await loseLifeAndAdvance(page, deadline, who)
  await missOnce(page, deadline, who)
  await waitFor(
    async () => (await snapshot(page)).self.lives === 0,
    `${who}: 脱落（lives=0）にならない`,
    deadline,
  )
}

// n 問を続けて正解する。
async function answerN(page, n, deadline, who) {
  for (let i = 0; i < n; i++) await answerCorrect(page, deadline, who)
}

// #446 correct を1つも増やさずにライフを 0 まで削って脱落する。
// eliminate() は「ミス→その問題を正解して次へ」なので脱落者の correct が lives-1 になるが、
// 実機で観測された不具合は「脱落者の correct が 0 のまま」＝相手が後から追い抜く順序だった。
// ミス済みの問題は正解しても correct が増えない性質を使い、
//   ミス（ライフが減れば次の周回へ）→ 減らない（＝この問題はミス済み）なら正解キーで問題を進める
// を繰り返して、correct を据え置いたままライフだけを削り切る。
async function eliminateWithoutCorrect(page, deadline, who) {
  const base = (await snapshot(page)).self.correct
  for (;;) {
    const s = await snapshot(page)
    if (s.self.lives === 0) return s
    if (s.self.correct > base) throw new Error(`${who}: correct が増えてしまった（${base}→${s.self.correct}）`)
    if (s.phase !== 'running') throw new Error(`${who}: 脱落の途中で phase=${s.phase} になった`)
    if (Date.now() > deadline) throw new Error(`${who}: 脱落しきれない（lives=${s.self.lives}）`)
    // まずミスを試す。ライフが減れば次のライフへ、減らなければ「この問題は既にミス済み」。
    const wk = await wrongKey(page)
    if (wk != null) {
      await page.keyboard.press(wk)
      if ((await snapshot(page)).self.lives < s.self.lives) continue
    }
    // ミス済みの問題を正解キーで打ち切って次の問題へ進める（correct は増えない）。
    const nk = await nextKey(page)
    if (nk != null) await page.keyboard.press(nk)
    else await sleep(20)
  }
}

// ---- 接続〜ロビー〜対戦開始 ---------------------------------------------------

// ホスト A・ゲスト B を手動シグナリング（コピペ）で繋ぐ。接続成立でロビー（.vs-lobby）が出る。
async function connect(host, guest, deadline) {
  await clickByText(host, '.vs-roles .vs-role-buttons button', '部屋を作る', deadline)
  await clickByText(guest, '.vs-roles .vs-role-buttons button', '部屋に入る', deadline)

  // ホストの接続コード（ICE 収集完了まで数秒かかる）。生成前は .vs-pending が出ている。
  const offer = await waitFor(
    () =>
      host.evaluate(() => {
        const el = document.querySelector('.vs-codeblock textarea.vs-code[readonly]')
        return el && el.value.length > 0 ? el.value : false
      }),
    'ホストの接続コードが生成されない',
    deadline,
  )

  // ゲスト：接続コードを貼って応答コードを作る。
  await typeInto(guest, '.vs-pasteblock textarea.vs-code', offer, deadline)
  await clickByText(guest, '.vs-pasteblock button.vs-submit', '応答コードを作る', deadline)
  const answer = await waitFor(
    () =>
      guest.evaluate(() => {
        const el = document.querySelector('.vs-codeblock textarea.vs-code[readonly]')
        return el && el.value.length > 0 ? el.value : false
      }),
    'ゲストの応答コードが生成されない',
    deadline,
  )

  // ホスト：応答コードを貼って接続する。
  await typeInto(host, '.vs-pasteblock textarea.vs-code', answer, deadline)
  await clickByText(host, '.vs-pasteblock button.vs-submit', '接続する', deadline)

  // 接続成立＝双方がロビー（対戦条件の選択）へ入る。
  await waitFor(() => host.$('.vs-lobby'), 'ホストがロビーに入らない', deadline)
  await waitFor(() => guest.$('.vs-lobby'), 'ゲストがロビーに入らない', deadline)
}

// ロビーで「単語 / L1 / サドンデス（ライフ n）」を選んで提案し、ゲストが承認する。
async function agreeAndStart(host, guest, lives, deadline) {
  await clickByText(host, '.type-tabs .type-tab', '単語', deadline)
  await clickByText(host, '.rank-select .rank-btn', 'L1', deadline)
  await clickByText(host, '.mode-select .mode-btn', 'サドンデス', deadline)
  await clickByText(host, '.mode-select .mode-btn', `ライフ${lives}`, deadline)
  await clickByText(host, '.vs-lobby-actions button.vs-btn-primary', '対戦開始', deadline)

  // 受け側（ゲスト）が承認 → カウントダウン → 対戦開始。
  await clickByText(guest, '.vs-approval .vs-role-buttons button.vs-btn-primary', '承認する', deadline)
  const a = await waitRunning(host, deadline)
  const b = await waitRunning(guest, deadline)
  return { hostId: a.selfId, guestId: b.selfId }
}

// ---- 判定 -----------------------------------------------------------------

// 両ブラウザが「終了（phase=finished）」かつ期待どおりの outcome になるまで待つ。
// 片側だけ終わる／片側だけ ongoing のままという不具合を捕まえるのが目的なので、必ず両方を見る。
async function expectDecided(pages, expected, deadline) {
  const label =
    expected.status === 'won' ? `${expected.winner} の勝利で終了` : '引き分けで終了'
  await waitFor(
    async () => {
      for (const { page } of pages) {
        const s = await snapshot(page)
        if (!s || s.phase !== 'finished') return false
        if (s.outcome.status !== expected.status) return false
        if (expected.status === 'won' && s.outcome.winnerId !== expected.winnerId) return false
      }
      return true
    },
    `両ブラウザが「${label}」にならない`,
    deadline,
  )
}

// #443 決着（phase=finished）した後は、両者とも打鍵が一切効かないことを確かめる。
// 以前は「finished と outcome」しか見ておらず、脱落していない側（＝勝者）が決着後も打ち続けられる
// 不具合を素通りさせていた。ここでは実際にキーを押し、typed/correct/mistakes が 1 も動かないことを見る。
// 正解キーとミスキーの両方を試し、終了後に expectedKey 経路が null を返す場合に備えて素の文字キーも押す。
async function expectInputFrozen(pages) {
  for (const { name, page } of pages) {
    const before = (await snapshot(page)).self
    const alive = before.lives == null || before.lives > 0 // 生存側（勝者）が本命の検査対象
    const keys = []
    const nk = await nextKey(page)
    const wk = await wrongKey(page)
    if (nk != null) keys.push(nk)
    if (wk != null) keys.push(wk)
    keys.push('a', 'k') // 素の文字キー（nextKey/wrongKey が null でも必ず数回打つ）
    for (const k of keys) {
      await page.keyboard.press(k)
      await sleep(30)
    }
    await sleep(300) // 状態更新＋再レンダーの猶予（snapshot は ref 経由で最新レンダー値を返す）
    const after = (await snapshot(page)).self
    for (const field of ['typed', 'correct', 'mistakes']) {
      if (after[field] !== before[field]) {
        throw new Error(
          `${name}${alive ? '（生存側）' : '（脱落済み）'}: 決着後に打鍵が効いてしまう` +
            `（self.${field} が ${before[field]}→${after[field]}・押したキー=${keys.join(',')}）`,
        )
      }
    }
  }
}

// #443 自分のカード（vs-card-self）とヘッダバーの表示テキスト＋手元の数値を1組で読む。
// 速度（打/分）は「打鍵数 ÷ 経過時間」なので、決着後に時計が回り続けると打鍵ゼロでも下がり続ける
// ＝この文字列の変化が不具合Aの実挙動そのもの。数値は snapshot（DEV フック）から併せて取る。
async function statsText(page) {
  const dom = await page.evaluate(() => {
    const card = document.querySelector('.vs-card-self')
    const header = document.querySelector('.vs-match-header')
    return {
      card: card ? card.textContent : null,
      header: header ? header.textContent : null,
      waiting: !!document.querySelector('.vs-match-waiting'),
    }
  })
  const s = await snapshot(page)
  return { ...dom, self: s?.self ?? null }
}

// #443 決着（phase=finished）した後は、速度・経過が「最後の値」で確定していることを確かめる。
// 数秒待ってもカード/ヘッダの表示テキストと手元の数値が 1 も動かないこと（打鍵は一切していない）。
// 併せて「相手の完了を待っています…」（.vs-match-waiting）が消えていることも見る（不具合B）。
// 決着後に待つ相手はもう居ないので、この案内が残っていること自体が不具合。
async function expectStatsFrozen(pages, holdMs = 2500) {
  const before = []
  for (const { name, page } of pages) {
    const s = await statsText(page)
    // セレクタが外れると「常に null 同士＝一致」で素通りするので、読めないこと自体を失敗にする。
    if (s.card == null) throw new Error(`${name}: 自分のカード（.vs-card-self）が見つからない`)
    if (s.header == null) throw new Error(`${name}: ヘッダバー（.vs-match-header）が見つからない`)
    before.push(s)
  }
  await sleep(holdMs)
  for (let i = 0; i < pages.length; i++) {
    const { name, page } = pages[i]
    const after = await statsText(page)
    if (after.card !== before[i].card) {
      throw new Error(
        `${name}: 決着後もカードの数値が動く（速度/経過が確定していない）\n` +
          `  before: ${before[i].card}\n  after : ${after.card}`,
      )
    }
    if (after.header !== before[i].header) {
      throw new Error(
        `${name}: 決着後もヘッダバーの表示が動く\n` +
          `  before: ${before[i].header}\n  after : ${after.header}`,
      )
    }
    const b = before[i].self ?? {}
    const a = after.self ?? {}
    for (const field of ['typed', 'correct', 'mistakes']) {
      if (a[field] !== b[field]) {
        throw new Error(`${name}: 決着後に self.${field} が ${b[field]}→${a[field]} と動いた`)
      }
    }
    if (after.waiting || before[i].waiting) {
      throw new Error(`${name}: 決着後も「相手の完了を待っています…」（.vs-match-waiting）が消えない`)
    }
  }
}

// 一定時間、両ブラウザが「継続中（running かつ ongoing）」のままであることを確かめる。
// 途中で終わったら（＝早すぎる決着）その場で失敗させる。
async function expectStillOngoing(pages, holdMs) {
  const until = Date.now() + holdMs
  while (Date.now() < until) {
    for (const { name, page } of pages) {
      const s = await snapshot(page)
      if (!s) throw new Error(`${name}: DEV フックが消えた（画面が遷移した？）`)
      if (s.phase !== 'running' || s.outcome.status !== 'ongoing') {
        throw new Error(`${name}: 継続すべき局面で phase=${s.phase} / outcome=${s.outcome.status} になった`)
      }
    }
    await sleep(200)
  }
}

// #447 決着後に「記録が1件も増えていないこと」を確かめる（対戦のプレイは記録に残さない仕様）。
// ブラウザは毎回まっさらなプロファイルで起動する＝対戦前の記録は必ず 0 件なので、決着後も 0 件なら
// 「対戦のプレイが solo の記録一覧／ベスト記録に混ざっていない」ことになる。
// 記録ストアの読み込みは非同期（SQLite/OPFS のメモリ像）なので、一覧が出た後もしばらく数え続けて
// 「最初 0 件 → 後から 1 件生える」も取りこぼさない。
// ※この検査は対戦画面から離れる（/records へ遷移する）ため、必ず他の検証を全部終えた最後に呼ぶこと。
async function expectNoRecordsSaved(pages, base, holdMs = 2000) {
  for (const { name, page } of pages) {
    await page.goto(`${base}/records`, { waitUntil: 'load' })
    // 一覧が描画されるまで待つ（空なら .no-records、1件以上あれば .records-table が出る）。
    await page.waitForSelector('.no-records, .records-table', { timeout: 15_000 })
    const until = Date.now() + holdMs
    for (;;) {
      const count = await page.evaluate(
        () => document.querySelectorAll('.records-table tbody tr').length,
      )
      if (count > 0) {
        throw new Error(
          `${name}: 対戦のプレイが記録として保存されている（すべての記録が ${count} 件・期待は 0 件）`,
        )
      }
      if (Date.now() >= until) break
      await sleep(200)
    }
  }
}

// ---- シナリオ ---------------------------------------------------------------
// 共通の前段（接続→ロビー合意→対戦開始）は runScenario 側が済ませ、各シナリオは打鍵の組み立てだけを書く。
// eliminate() は「ライフ n を使い切る」＝途中で n-1 問を正解するので、脱落者の correct は n-1 になる。

const SCENARIOS = {
  // A を脱落させ、B の正解数を A より多くする → B の勝利で終了。
  'a-eliminated-b-ahead': async ({ host, guest, ids, lives, deadline }) => {
    await eliminate(host, deadline, 'A(host)')
    await answerN(guest, lives, deadline, 'B(guest)') // A は lives-1 問正解＝B が上回る
    return { status: 'won', winnerId: ids.guestId, winner: 'B(guest)' }
  },

  // A を脱落させるが B の正解数は A 以下のまま → 終了しない（新ルールの肝）。
  'a-eliminated-b-behind': async ({ host, guest, deadline, lives }) => {
    await eliminate(host, deadline, 'A(host)')
    await answerN(guest, lives - 1, deadline, 'B(guest)') // A と同数＝strict 最大が居ない
    return { status: 'ongoing' }
  },

  // A 脱落後に B も脱落させる。正解数に差をつけ、多い側（B）の勝利で終了。
  'both-eliminated': async ({ host, guest, ids, deadline }) => {
    await eliminate(host, deadline, 'A(host)')
    await answerN(guest, 1, deadline, 'B(guest)') // B は 1問ぶん先に稼いでから脱落する
    await eliminate(guest, deadline, 'B(guest)')
    return { status: 'won', winnerId: ids.guestId, winner: 'B(guest)' }
  },

  // 全員脱落かつ正解数同点 → 引き分けで終了。
  draw: async ({ host, guest, deadline }) => {
    await eliminate(host, deadline, 'A(host)')
    await eliminate(guest, deadline, 'B(guest)')
    return { status: 'draw' }
  },

  // 脱落するのがホスト側で、しかも「ホストの脱落」が決着の引き金になるケース（09fd4da の回帰確認）。
  // 先に B が正解を積み、最後にホストが脱落した瞬間へ終了判定が来る。
  'host-eliminated': async ({ host, guest, ids, lives, deadline }) => {
    await answerN(guest, lives, deadline, 'B(guest)')
    await eliminate(host, deadline, 'A(host)')
    return { status: 'won', winnerId: ids.guestId, winner: 'B(guest)' }
  },

  // #446 実機で観測された順序の再現：ホスト A が 1問も正解しないまま先に脱落し、その「後で」
  // ゲスト B が 1問正解して追い抜く。決着の引き金がホスト自身のローカルな脱落フレームではなく
  // 「相手から届いた progress メッセージ」になるのが他シナリオとの違い（既定 lives=1＝実機と同条件）。
  //   1. A を correct=0 のまま脱落させる
  //   2. この時点では両者同点（correct 0-0）＝継続が正しい。早すぎる決着をここで弾く（＋実機の「間」を再現）
  //   3. その後で B が 1問正解 → B の correct=1 で初めて条件成立
  //   4. 両ブラウザが B の勝利で finished になること
  'host-eliminated-then-overtaken': async ({ host, guest, ids, pages, deadline }) => {
    await eliminateWithoutCorrect(host, deadline, 'A(host)')
    await expectStillOngoing(pages, 2000) // 手打ちの「間」相当の待ち＋早すぎる決着の検出
    await answerCorrect(guest, deadline, 'B(guest)')
    return { status: 'won', winnerId: ids.guestId, winner: 'B(guest)' }
  },
}

// シナリオ既定のライフ（--lives の明示指定が無いときだけ使う）。実機の再現条件に合わせるため。
const SCENARIO_LIVES = { 'host-eliminated-then-overtaken': 1 }

// ---- 実行 -----------------------------------------------------------------

// ブラウザを1つ起動して対戦画面（?preview=versus）を開く。
// placement を渡すと画面上の位置とサイズを明示する（--setup-only で 2 枚を左右に並べるため。
// 位置を指定しないと Chrome は同じ場所に重ねて出すので、片方が隠れて手で操作できない）。
async function openApp(executablePath, opts, placement = null) {
  const size = placement ?? { width: 900, height: 1000 }
  const args = [
    // 同一マシンの Chrome 同士を mDNS 越しではなく素のホスト候補で繋ぐ（ローカル検証用）。
    '--disable-features=WebRtcHideLocalIpsWithMdns',
    `--window-size=${size.width},${size.height}`,
  ]
  if (placement) args.push(`--window-position=${placement.x},${placement.y}`)
  const browser = await puppeteer.launch({
    headless: opts.headful ? false : 'new',
    executablePath,
    args,
    // 手動操作モードでは viewport を固定しない（本人がウィンドウを動かす/広げるのに追従させる）。
    defaultViewport: placement ? null : { width: 900, height: 1000 },
    // 手動操作モードでは Ctrl-C を自前で扱う（puppeteer 既定のシグナル処理は browser を殺して
    // 即 process.exit するため、こちらの終了処理＝もう1つのブラウザを閉じる が走らない）。
    ...(placement ? { handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false } : {}),
  })
  const page = await browser.newPage()
  await page.goto(`${opts.base}/?preview=versus`, { waitUntil: 'load' })
  return { browser, page }
}

// 1 シナリオを最初から最後まで走らせる（ブラウザは毎回作り直す＝前のシナリオの状態を持ち込まない）。
async function runScenario(name, executablePath, opts) {
  const deadline = Date.now() + opts.timeout
  // --lives の明示指定が無ければシナリオ既定（無ければ全体既定）を使う。
  const lives = opts.livesExplicit ? opts.lives : (SCENARIO_LIVES[name] ?? opts.lives)
  const a = await openApp(executablePath, opts)
  const b = await openApp(executablePath, opts)
  const pages = [
    { name: 'A(host)', page: a.page },
    { name: 'B(guest)', page: b.page },
  ]
  try {
    await connect(a.page, b.page, deadline)
    const ids = await agreeAndStart(a.page, b.page, lives, deadline)
    const expected = await SCENARIOS[name]({
      host: a.page,
      guest: b.page,
      ids,
      pages,
      lives,
      deadline,
    })
    if (expected.status === 'ongoing') {
      await expectStillOngoing(pages, 3000)
    } else {
      await expectDecided(pages, expected, deadline)
      // #443 決着で終わる全シナリオ共通の後段（継続シナリオは対象外）：
      //   1. 終了後に打鍵が効かないこと
      //   2. 速度・経過が最後の値で確定し、待機メッセージが消えていること
      await expectInputFrozen(pages)
      await expectStatsFrozen(pages)
      // #447 最後に記録ビューへ遷移して「対戦のプレイが記録に残っていない」ことを見る。
      //   対戦画面から離れるので、上の凍結系の検証より必ず後に置くこと（順序を入れ替えると壊れる）。
      await expectNoRecordsSaved(pages, opts.base)
    }
    console.log(`✓ ${name}`)
    return true
  } catch (err) {
    console.error(`✖ ${name}: ${err.message}`)
    await dumpFailure(name, pages)
    return false
  } finally {
    if (!opts.keepOpen) {
      await a.browser.close().catch(() => {})
      await b.browser.close().catch(() => {})
    }
  }
}

// #452 手で対戦を試すための「お膳立て」だけをやるモード。
// 面倒なのは接続の往復（役割選択 → 接続コード生成 → 貼付 → 応答コード → 貼付）だけなので、
// そこまでを自動でやってロビー（対戦条件の選択）で止め、あとは本人に操作を渡す。
// ロビーの選択（種目/レベル/終了条件）には一切触れない＝本人が試したい条件を選べる。
async function runSetupOnly(executablePath, opts) {
  const deadline = Date.now() + opts.timeout
  const win = parseWindowSize(opts.windowSize) ?? DEFAULT_SETUP_WINDOW
  // 左右に並べる（左＝ホスト／右＝ゲスト）。y は 0 固定で上端に揃える。
  const a = await openApp(executablePath, opts, { ...win, x: 0, y: 0 })
  // OS 側の都合（macOS の Dock/メニューバー等）で頼んだ座標どおりには置かれないことがあるので、
  // 1 枚目が実際に置かれた右端を測ってその隣に 2 枚目を置く（頼んだ値のまま並べると数十 px 重なる）。
  const rightEdge = await a.page
    .evaluate(() => window.screenX + window.outerWidth)
    .catch(() => null)
  const bx = Number.isFinite(rightEdge) ? rightEdge : win.width
  const b = await openApp(executablePath, opts, { ...win, x: bx, y: 0 })
  const closeAll = async () => {
    await a.browser.close().catch(() => {})
    await b.browser.close().catch(() => {})
  }
  try {
    console.log('… 2 つの Chrome を接続しています（役割選択 → 接続コードの往復）')
    await connect(a.page, b.page, deadline)
  } catch (err) {
    console.error(`✖ 接続に失敗しました: ${err.message}`)
    await dumpFailure('setup-only', [
      { name: 'A(host)', page: a.page },
      { name: 'B(guest)', page: b.page },
    ])
    await closeAll()
    return false
  }
  printSetupGuide()
  // SIGINT（Ctrl-C）を受けるまでブラウザを開いたまま保つ。
  // 既定の SIGINT は即死＝子プロセスの Chrome が残る/消えるが不定なので、明示的に閉じてから抜ける。
  await new Promise((resolve) => {
    process.once('SIGINT', resolve)
    process.once('SIGTERM', resolve)
  })
  console.log('\n… ブラウザを閉じています')
  await closeAll()
  return true
}

// 手動検証モードの案内（どちらがホストか・何を選ぶか・不具合を報告するときの一次情報の取り方）。
function printSetupGuide() {
  console.log(`
────────────────────────────────────────
✓ 接続できました（両方ともロビー＝対戦条件の選択で止めてあります）。
  ここから先は手で操作してください。

  ・画面の左のウィンドウ … A＝ホスト（部屋を作った側）
  ・画面の右のウィンドウ … B＝ゲスト（部屋に入った側）

  1. どちらか（ホスト側が提案 → ゲスト側が承認）でロビーの条件を選び、「対戦開始」。
     サドンデスの挙動を見たいときは「終了条件＝サドンデス」を選ぶこと。
  2. 対戦中の判定状態は DevTools（⌥⌘I）の Console で読めます：

       window.__tllVersus.snapshot()

     → { selfId, isHost, phase, endKind, initialLives,
         self:{lives, correct, typed, mistakes}, others:[…], outcome }
     自分/相手のライフ・正解数・outcome（won/draw/ongoing）が分かります。
     おかしな挙動を見つけたら、両方のウィンドウでこれを実行した結果を控えてください
     （片側だけ finished ／ 値が食い違う、が不具合の一次情報になります）。
  3. 終わったら、このターミナルで Ctrl-C を押してください（両方のブラウザを閉じます）。
────────────────────────────────────────`)
}

// 失敗時：両ブラウザのスクショと直前の snapshot を出す（どちら側がどう見えていたかを残す）。
async function dumpFailure(name, pages) {
  mkdirSync(SHOT_DIR, { recursive: true })
  for (const { name: who, page } of pages) {
    const file = `${SHOT_DIR}/${name}-${who.startsWith('A') ? 'host' : 'guest'}.png`
    await page.screenshot({ path: file, fullPage: true }).catch(() => {})
    const s = await snapshot(page).catch(() => null)
    console.error(`  ${who} snapshot: ${JSON.stringify(s)}`)
    console.error(`  ${who} screenshot: ${file}`)
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const names = opts.scenario === 'all' ? Object.keys(SCENARIOS) : [opts.scenario]
  if (opts.setupOnly) {
    // 手で操作するモードなので headless では意味がない（--headful の指定有無に関わらず表示する）。
    opts.headful = true
    if (opts.scenario) {
      console.warn('⚠ --setup-only と --scenario は併用できません。--setup-only を優先します。')
      opts.scenario = null
    }
    if (opts.windowSize && !parseWindowSize(opts.windowSize)) {
      console.error('✖ --window-size は 960x1000 の形式で指定してください。')
      process.exit(1)
    }
  } else if (!opts.scenario || names.some((n) => !SCENARIOS[n])) {
    console.error(
      `✖ --scenario を指定してください（all / ${Object.keys(SCENARIOS).join(' / ')}）` +
        '\n  手で試したいだけなら --setup-only（接続だけ自動でやってロビーで止まります）。',
    )
    process.exit(1)
  }
  if (!Number.isInteger(opts.lives) || opts.lives < 1) {
    console.error('✖ --lives は 1 以上の整数で指定してください。')
    process.exit(1)
  }

  const executablePath = resolveChrome()

  // 既に動いている dev サーバを再利用する（自前では起動しない＝本人の dev を巻き添えにしない）。
  try {
    const res = await fetch(`${opts.base}/`)
    if (!res.ok) throw new Error(String(res.status))
  } catch {
    console.error(
      `✖ dev サーバに繋がりません: ${opts.base}\n  別ターミナルで npm run dev を起動してから実行してください（--base で変更可）。`,
    )
    process.exit(1)
  }

  if (opts.setupOnly) return runSetupOnly(executablePath, opts)

  const results = []
  for (const name of names) {
    results.push({ name, ok: await runScenario(name, executablePath, opts) })
  }

  if (names.length > 1) {
    console.log('--- 結果 ---')
    for (const r of results) console.log(`${r.ok ? '✓' : '✖'} ${r.name}`)
  }

  if (opts.keepOpen) {
    console.log('--keep-open: ブラウザを開いたままにします。Ctrl-C で終了してください。')
    await new Promise(() => {})
  }
  return results.every((r) => r.ok)
}

main().then(
  (ok) => process.exit(ok ? 0 : 1),
  (err) => {
    console.error(`✖ versus-e2e: ${err.stack ?? err.message}`)
    process.exit(1)
  },
)
