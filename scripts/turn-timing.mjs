// 「依頼してから完成までの時間」の内訳を transcript から実測する計測ツール（#466）。
// 体感の遅さがどこに出ているか（委任・検証・承認待ち・モデルの思考）を数字で見るために使う。
//
// 使い方:
//   node scripts/turn-timing.mjs [--last N] [--session latest|<id>] [--since YYYY-MM-DD] [--json]
//     --last     直近 N ターンだけを集計する（既定: 全部）
//     --session  対象セッション。latest=最終更新のもの／<id>=セッションID（既定: 全セッション）
//     --since    この日付以降に始まったターンだけ（YYYY-MM-DD）
//     --json     集計結果を JSON で出す（人間向けの表は出さない）
//
// 入力は ~/.claude/projects/<cwd-slug>/*.jsonl（<cwd-slug> は cwd の / を - に置換したもの）。
// このリポジトリは PUBLIC なので、パスは実行時に process.cwd()/os.homedir() から導出し
// username を含む絶対パスは絶対に埋め込まない。
//
// 出力には本人のプロンプト抜粋が入る。リポジトリに書き出さないこと（stdout のみ）。
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { execFileSync } from 'node:child_process'

// 出力先が途中で閉じても（`| head` 等）落ちないように EPIPE を握りつぶす
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') process.exit(0)
  throw err
})

// ---- 定数 ---------------------------------------------------------------
// 承認待ちとみなす閾値。Read/Edit/Write は通常 1 秒未満で返るので、これを超えたものは
// 許可プロンプトの前で止まっていた（＝本人の応答待ち）と推定する。
const APPROVAL_THRESHOLD_MS = 5000

// 編集系とみなすツール
const EDIT_TOOLS = new Set(['Read', 'Edit', 'Write', 'NotebookEdit'])
// そのうち承認プロンプトが出うるもの（NotebookEdit は実績が無いので対象外）
const APPROVAL_TOOLS = new Set(['Read', 'Edit', 'Write'])

// 本人の応答で初めて返るツール。所要はこちらの処理時間ではなく本人が考えて答えるまでの
// 待ち時間なので、AI 側の実力値と混ざらないよう別建てにする。
const USER_WAIT_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode'])

// 表示順（モデルは残差なので最後）
const BUCKETS = [
  '委任',
  'Bash:検証',
  'Bash:git',
  'Bash:gh',
  'Bash:その他',
  '編集',
  '承認待ち(推定)',
  '本人待ち',
  'その他ツール',
  'モデル(思考・生成)',
]

// ---- 引数 ---------------------------------------------------------------
function parseArgs(argv) {
  const opts = { json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') opts.json = true
    else if (a === '--last') opts.last = Number(argv[++i])
    else if (a === '--session') opts.session = argv[++i]
    else if (a === '--since') opts.since = argv[++i]
    else if (a === '--help' || a === '-h') opts.help = true
  }
  return opts
}

const USAGE =
  '使い方: node scripts/turn-timing.mjs [--last N] [--session latest|<id>] [--since YYYY-MM-DD] [--json]'

// ---- transcript の場所 ---------------------------------------------------
// cwd の絶対パスの / を - に置換したものがプロジェクトのディレクトリ名になる。
export function projectSlug(cwd) {
  return cwd.replaceAll('/', '-')
}

function transcriptDir(cwd = process.cwd(), home = homedir()) {
  return join(home, '.claude', 'projects', projectSlug(cwd))
}

// git worktree の本体（メイン作業ツリー）のルート。worktree では cwd が本体と異なるため、
// transcript のディレクトリ名（cwd 由来のスラッグ）も変わってしまう。記録は本体側に
// 溜まっているので、cwd で見つからないときの探索先として本体ルートを返す。
function mainWorktreeRoot() {
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8',
    }).trim()
    // 通常は <本体ルート>/.git を指す（bare は対象外）
    return common.endsWith('/.git') ? dirname(common) : null
  } catch {
    return null
  }
}

// 実際に記録がある transcript ディレクトリを選ぶ（cwd → 本体ルートの順）。
// PUBLIC リポジトリなので、パスはすべて実行時に導出し username は埋め込まない。
export function resolveTranscriptDir() {
  const candidates = [process.cwd()]
  const main = mainWorktreeRoot()
  if (main && main !== process.cwd()) candidates.push(main)
  for (const cwd of candidates) {
    const dir = transcriptDir(cwd)
    if (existsSync(dir)) return { dir, from: cwd }
  }
  return { dir: transcriptDir(process.cwd()), from: process.cwd() }
}

// セッションファイル一覧（サブディレクトリはサブエージェントの transcript なので見ない）
function listSessions(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ id: f.slice(0, -'.jsonl'.length), path: join(dir, f) }))
}

// 1 セッション分を読む。壊れた行は握りつぶしてスキップする。
export function readRecords(text) {
  const out = []
  for (const line of text.split('\n')) {
    if (!line) continue
    let o
    try {
      o = JSON.parse(line)
    } catch {
      continue
    }
    if (!o || typeof o !== 'object') continue
    // サブエージェント側の行は Agent ツールの所要に含まれるので二重計上しない
    if (o.isSidechain) continue
    if (o.type !== 'user' && o.type !== 'assistant') continue
    if (!o.timestamp) continue
    out.push(o)
  }
  // 時刻の前後が入れ替わっている行がまれにあるので時系列に整える
  return out.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

// ---- 行の解釈 -----------------------------------------------------------
function blocks(rec) {
  const c = rec.message && rec.message.content
  return Array.isArray(c) ? c : []
}

function hasToolResult(rec) {
  return blocks(rec).some((b) => b && b.type === 'tool_result')
}

// 本人の発話テキスト。content は文字列のことも配列のこともある。
function promptText(rec) {
  const c = rec.message && rec.message.content
  if (typeof c === 'string') return c
  if (!Array.isArray(c)) return ''
  return c
    .filter((b) => b && b.type === 'text')
    .map((b) => b.text || '')
    .join(' ')
}

// 本人の発話かどうか。ツール結果・メタ行・スラッシュコマンドの出力は「依頼」ではない。
export function isUserPrompt(rec) {
  if (rec.type !== 'user') return false
  if (rec.isMeta) return false
  if (hasToolResult(rec)) return false
  const text = promptText(rec).trim()
  if (!text) return false
  if (text.startsWith('<local-command-stdout>')) return false
  if (text.startsWith('<local-command-caveat>')) return false
  // 背景ジョブの完了通知やフック注入は user 行だが本人の発話ではない。
  // これをターンの起点にすると 1 回の依頼が分断され、所要が実際より短く出てしまう。
  if (text.startsWith('<task-notification>')) return false
  if (text.startsWith('<system-reminder>')) return false
  return true
}

// Bash の細分。検証コマンドを最優先で見る（`npm run check` は git を含む行でも検証扱い）。
export function classifyBash(command) {
  const cmd = String(command || '')
  if (/npm run (check|check:fast|test|coverage)\b/.test(cmd)) return 'Bash:検証'
  if (/(^|[\s;&|(])git\s/.test(cmd)) return 'Bash:git'
  if (/(^|[\s;&|(])gh\s/.test(cmd)) return 'Bash:gh'
  return 'Bash:その他'
}

// ツール 1 回分をどの内訳に入れるか。
export function classifyTool(name, input, durationMs) {
  if (name === 'Agent') return '委任'
  if (USER_WAIT_TOOLS.has(name)) return '本人待ち'
  if (name === 'Bash') return classifyBash(input && input.command)
  if (EDIT_TOOLS.has(name)) {
    // 単発で閾値を超えた編集系は、実処理ではなく許可プロンプトの待ち時間とみなして別建てにする
    if (APPROVAL_TOOLS.has(name) && durationMs > APPROVAL_THRESHOLD_MS) return '承認待ち(推定)'
    return '編集'
  }
  return 'その他ツール'
}

// ---- ターンの切り出し ---------------------------------------------------
// ターン開始 = 本人の発話行。終了 = 次の発話行の直前にある最後の assistant 行。
// 「最後の assistant → 次の発話」の間は本人の読む/考える時間なのでターンに含めない。
export function buildTurns(records, sessionId) {
  // tool_use の id → { name, input, startMs }
  const pending = new Map()
  // 発話行の位置で区切る
  const starts = []
  records.forEach((rec, i) => {
    if (isUserPrompt(rec)) starts.push(i)
  })

  const turns = []
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s]
    const to = s + 1 < starts.length ? starts[s + 1] : records.length
    const start = Date.parse(records[from].timestamp)

    let end = start
    const calls = []
    for (let i = from; i < to; i++) {
      const rec = records[i]
      const at = Date.parse(rec.timestamp)
      if (rec.type === 'assistant') end = at
      for (const b of blocks(rec)) {
        if (!b) continue
        if (b.type === 'tool_use' && b.id) {
          pending.set(b.id, { name: b.name, input: b.input, startMs: at })
        } else if (b.type === 'tool_result' && b.tool_use_id) {
          const use = pending.get(b.tool_use_id)
          if (!use) continue
          pending.delete(b.tool_use_id)
          const ms = Math.max(0, at - use.startMs)
          calls.push({ name: use.name, bucket: classifyTool(use.name, use.input, ms), ms })
        }
      }
    }

    turns.push({
      sessionId,
      startedAt: records[from].timestamp,
      durationMs: Math.max(0, end - start),
      prompt: promptText(records[from]).replace(/\s+/g, ' ').trim(),
      calls,
    })
  }
  return turns
}

// 1 ターンを内訳へ分解する。モデル時間はツール以外の残差（負なら 0 にクランプ）。
export function breakdown(turn) {
  const parts = new Map()
  const counts = new Map()
  for (const c of turn.calls) {
    parts.set(c.bucket, (parts.get(c.bucket) || 0) + c.ms)
    counts.set(c.bucket, (counts.get(c.bucket) || 0) + 1)
  }
  const toolMs = [...parts.values()].reduce((a, b) => a + b, 0)
  parts.set('モデル(思考・生成)', Math.max(0, turn.durationMs - toolMs))
  counts.set('モデル(思考・生成)', 1)
  return { parts, counts }
}

// ---- 集計 ---------------------------------------------------------------
export function aggregate(turns) {
  const totals = new Map()
  const counts = new Map()
  const rows = []
  for (const turn of turns) {
    const { parts, counts: c } = breakdown(turn)
    for (const [k, v] of parts) totals.set(k, (totals.get(k) || 0) + v)
    for (const [k, v] of c) counts.set(k, (counts.get(k) || 0) + v)
    // 主要因＝その ターンで最も長かった内訳
    let top = '-'
    let topMs = -1
    for (const [k, v] of parts) {
      if (v > topMs) {
        top = k
        topMs = v
      }
    }
    rows.push({ ...turn, topBucket: top, topMs })
  }

  const durations = turns.map((t) => t.durationMs).sort((a, b) => a - b)
  const totalMs = durations.reduce((a, b) => a + b, 0)
  const median = durations.length
    ? durations.length % 2
      ? durations[(durations.length - 1) / 2]
      : Math.round((durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2)
    : 0

  const buckets = BUCKETS.filter((k) => totals.has(k)).map((k) => {
    const ms = totals.get(k) || 0
    const n = counts.get(k) || 0
    return {
      key: k,
      totalMs: ms,
      pct: totalMs ? (ms / totalMs) * 100 : 0,
      count: n,
      avgMs: n ? Math.round(ms / n) : 0,
    }
  })

  return {
    turnCount: turns.length,
    totalMs,
    medianMs: median,
    meanMs: turns.length ? Math.round(totalMs / turns.length) : 0,
    buckets,
    slowest: [...rows].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10),
  }
}

// ---- 表示 ---------------------------------------------------------------
// 表示幅（全角＝2・半角＝1）
function width(s) {
  let w = 0
  for (const ch of String(s)) {
    w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1
  }
  return w
}

function padEnd(s, target) {
  const pad = target - width(String(s))
  return String(s) + (pad > 0 ? ' '.repeat(pad) : '')
}

function padStart(s, target) {
  const pad = target - width(String(s))
  return (pad > 0 ? ' '.repeat(pad) : '') + String(s)
}

export function fmtDur(ms) {
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(1)}s`
  // 秒は四捨五入してから桁上げする（先に分を切り出すと 4m60s のような表示になる）
  const totalSec = Math.round(sec)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m < 60) return `${m}m${String(s).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

// 先頭 n 文字（表示崩れを避けるため改行は畳んである前提）
function head(s, n) {
  const t = String(s)
  return t.length <= n ? t : t.slice(0, n) + '…'
}

function render(agg, scope) {
  const out = []
  out.push(`対象: ${scope}`)
  out.push(
    `ターン数 ${agg.turnCount} ／ 合計 ${fmtDur(agg.totalMs)} ／ 中央値 ${fmtDur(agg.medianMs)} ／ 平均 ${fmtDur(agg.meanMs)}`,
  )
  out.push('')

  const nameW = Math.max(12, ...agg.buckets.map((b) => width(b.key)))
  out.push(
    `${padEnd('内訳', nameW)}  ${padStart('合計', 8)}  ${padStart('割合', 6)}  ${padStart('件数', 5)}  ${padStart('平均', 8)}`,
  )
  out.push('-'.repeat(nameW + 35))
  for (const b of agg.buckets) {
    out.push(
      `${padEnd(b.key, nameW)}  ${padStart(fmtDur(b.totalMs), 8)}  ${padStart(b.pct.toFixed(1) + '%', 6)}  ${padStart(b.count, 5)}  ${padStart(fmtDur(b.avgMs), 8)}`,
    )
  }
  // 内訳の合計はターン合計と一致しない（並列に走ったツールを足し込むため）。差は上振れとして示す。
  const sum = agg.buckets.reduce((a, b) => a + b.totalMs, 0)
  out.push('-'.repeat(nameW + 35))
  out.push(
    `${padEnd('内訳合計', nameW)}  ${padStart(fmtDur(sum), 8)}  ${padStart(((sum / (agg.totalMs || 1)) * 100).toFixed(1) + '%', 6)}  ${padStart('', 5)}  ${padStart('', 8)}`,
  )
  out.push('※100%超は並列実行（背景ジョブ・同時ツール呼び出し）の重なり分')
  out.push('')

  out.push('遅いターン top10')
  out.push(
    `${padStart('所要', 8)}  ${padEnd('主要因', 26)}  ${padEnd('日時', 12)}  依頼（先頭50文字）`,
  )
  out.push('-'.repeat(100))
  for (const t of agg.slowest) {
    const when = t.startedAt.slice(5, 16).replace('T', ' ')
    out.push(
      `${padStart(fmtDur(t.durationMs), 8)}  ${padEnd(`${t.topBucket} ${fmtDur(t.topMs)}`, 26)}  ${padEnd(when, 12)}  ${head(t.prompt, 50)}`,
    )
  }
  return out.join('\n') + '\n'
}

// ---- main ---------------------------------------------------------------
function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    process.stdout.write(USAGE + '\n')
    return
  }

  const { dir } = resolveTranscriptDir()
  if (!existsSync(dir)) {
    process.stdout.write(`transcript が見つからない（${projectSlug(process.cwd())}）\n`)
    process.exitCode = 1
    return
  }

  let sessions = listSessions(dir)
  if (opts.session && opts.session !== 'latest') {
    sessions = sessions.filter((s) => s.id === opts.session)
    if (sessions.length === 0) {
      process.stdout.write(`セッションが見つからない: ${opts.session}\n`)
      process.exitCode = 1
      return
    }
  } else if (opts.session === 'latest') {
    sessions = sessions
      .map((s) => ({ ...s, mtime: statSync(s.path).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 1)
  }

  let turns = []
  for (const s of sessions) {
    const records = readRecords(readFileSync(s.path, 'utf8'))
    turns = turns.concat(buildTurns(records, s.id))
  }
  turns.sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  if (opts.since) turns = turns.filter((t) => t.startedAt.slice(0, 10) >= opts.since)
  if (Number.isFinite(opts.last) && opts.last > 0) turns = turns.slice(-opts.last)

  const agg = aggregate(turns)
  if (opts.json) {
    process.stdout.write(JSON.stringify(agg, null, 2) + '\n')
    return
  }
  const scope =
    `${sessions.length} セッション` +
    (opts.since ? ` / ${opts.since} 以降` : '') +
    (opts.last ? ` / 直近 ${opts.last} ターン` : '')
  process.stdout.write(render(agg, scope))
}

// import されたとき（テスト）は実行しない
if (process.argv[1] && process.argv[1].endsWith('turn-timing.mjs')) main()
