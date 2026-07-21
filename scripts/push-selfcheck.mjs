// push 前の自己点検。未push差分の「追加行」だけを走査し、公開して問題があるもの
// （秘密情報・個人情報・絶対パスでの username 露出・鍵/環境ファイル）を検出する。
// このリポジトリは PUBLIC なので、本人の識別子はスクリプトに直書きせず
// 実行時に git config（user.name / user.email）から取得して照合する。
//
// 使い方:
//   node scripts/push-selfcheck.mjs [--base <ref>] [--verbose]
//     --base    走査の基点（既定は origin/<現在のブランチ>、無ければ origin/develop）
//     --verbose 該当行の中身も表示する（該当箇所は伏せ字）
// 終了コード: 0=クリア / 1=検出あり
import { execFileSync } from 'node:child_process'

// ---- 引数 ---------------------------------------------------------------
function parseArgs(argv) {
  const opts = { verbose: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--verbose' || a === '-v') opts.verbose = true
    else if (a === '--base') opts.base = argv[++i]
    else if (a === '--help' || a === '-h') opts.help = true
  }
  return opts
}

const USAGE = '使い方: node scripts/push-selfcheck.mjs [--base <ref>] [--verbose]'

// git をそのまま叩く小道具（失敗は null を返して呼び側で判断）
// maxBuffer は既定 1MB では足りない。教材コンテンツ（content/*.ndjson・src/content/*Data.js）は
// 全体で数十 MB あり、リリース時の origin/master..origin/develop はその大半の書き換えを含みうる。
// 教材を走査対象から外す手もあるが、それだと教材ファイルに紛れた秘密情報を見逃すので、
// 除外せずバッファを広げて対処する（走査自体は 11 万行でも 1 秒未満）。
function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

// ---- 走査範囲の決定 -----------------------------------------------------
// 既定は origin/<現在のブランチ>..HEAD。upstream が無い（未 push の新規ブランチ）は
// origin/develop..HEAD にフォールバックする。
function resolveBase(explicit) {
  if (explicit) return { base: explicit, reason: '--base 指定' }
  const branch = (git(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true }) || '').trim()
  if (branch && branch !== 'HEAD') {
    const remote = `origin/${branch}`
    if (git(['rev-parse', '--verify', '--quiet', remote], { allowFail: true })) {
      return { base: remote, reason: '現在のブランチの upstream' }
    }
  }
  if (git(['rev-parse', '--verify', '--quiet', 'origin/develop'], { allowFail: true })) {
    return { base: 'origin/develop', reason: `origin/${branch} が無いため origin/develop にフォールバック` }
  }
  return { base: null, reason: `origin/${branch} も origin/develop も見つかりません` }
}

// ---- 検出ルール ---------------------------------------------------------
// kind: secret（伏せ字必須）/ personal / path / file
const RULES = [
  // --- 秘密情報 ---
  { kind: 'secret', name: '秘密鍵ブロック', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { kind: 'secret', name: 'AWS アクセスキー', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: 'secret', name: 'GitHub トークン', re: /\bgh[pousr]_[A-Za-z0-9]{20,}/ },
  { kind: 'secret', name: 'OpenAI 風トークン', re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { kind: 'secret', name: 'Slack トークン', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { kind: 'secret', name: 'Google API キー', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    kind: 'secret',
    name: '認証情報らしき代入',
    // key/secret/token/password ＝ 引用符付きリテラル（8文字以上）。
    // process.env や ${...} 等の参照は値の判定で除外する。
    re: /\b(?:api[_-]?key|apikey|access[_-]?key|secret[_-]?key|client[_-]?secret|secret|token|password|passwd|credentials?)\b\s*[:=]\s*(['"`])([^'"`\n]{8,})\1/i,
    // 値がプレースホルダ/参照なら該当としない
    ok: (m) => !isPlaceholder(m[2]),
  },
  // --- 絶対パス（username 露出） ---
  // 直前が英数/スラッシュの場合はアプリのルート（例 /touch/home/easy）なので対象外にする
  { kind: 'path', name: '絶対パス(/Users)', re: /(?<![A-Za-z0-9_/])\/Users\/[A-Za-z0-9._-]+/ },
  { kind: 'path', name: '絶対パス(/home)', re: /(?<![A-Za-z0-9_/])\/home\/[A-Za-z0-9._-]+/ },
  { kind: 'path', name: '絶対パス(C:\\Users)', re: /[Cc]:\\+Users\\+[A-Za-z0-9._-]+/ },
  // --- 個人情報 ---
  {
    kind: 'personal',
    name: 'メールアドレス',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/,
  },
]

// 値がプレースホルダ/環境変数参照っぽいか（誤検知よけ・控えめに）
function isPlaceholder(v) {
  return (
    /^\s*$/.test(v) ||
    /^[*x•.]+$/i.test(v) ||
    /\$\{|\$[A-Z_]|process\.env|import\.meta\.env|<[^>]+>/.test(v) ||
    /\b(?:your|my|dummy|sample|example|placeholder|changeme|redacted|hoge|fuga|xxxx+)\b/i.test(v)
  )
}

// 既知の安全パターン（この行に当たったらそのルールは見送る）。控えめに保つこと。
const ALLOW = [
  /^Co-Authored-By:/i,
  /@(?:example|invalid|test)\.(?:com|org|net|jp)\b/i,
  /\bnoreply@/i,
  /@users\.noreply\.github\.com\b/i,
  /\/(?:Users|home)\/runner\b/, // CI ランナーの標準パス
]

// 変更ファイル名で弾くもの（鍵/環境ファイル）
const RISKY_FILE = [
  { name: '環境ファイル', re: /(?:^|\/)\.env(?:\.|$)/ },
  { name: '証明書/鍵ファイル', re: /\.(?:pem|key|p12|pfx)$/i },
  { name: 'SSH 秘密鍵', re: /(?:^|\/)id_(?:rsa|ed25519|ecdsa|dsa)(?:$|\.)/ },
]

// 走査しないファイル（生成物・ロック・バイナリ相当）
const SKIP_FILE = /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|\.(?:png|jpe?g|gif|webp|ico|woff2?|mp3|wav|zip|pdf)$/i

// ---- 本人識別子（実行時に git config から取得。スクリプトに直書きしない） ----
function personalTokens() {
  const raw = []
  for (const k of ['user.name', 'user.email', 'ai.name', 'ai.email']) {
    const v = git(['config', '--get', k], { allowFail: true })
    if (v) raw.push(v.trim())
  }
  // 環境変数で追加の識別子を渡せる（カンマ区切り）
  if (process.env.PUSH_SELFCHECK_IDENTIFIERS) raw.push(...process.env.PUSH_SELFCHECK_IDENTIFIERS.split(','))

  const out = new Set()
  for (const v of raw) {
    const s = v.trim()
    if (!s) continue
    if (s.includes('@')) {
      out.add(s.toLowerCase())
      const local = s.split('@')[0].toLowerCase()
      if (local.length >= 4) out.add(local)
    } else {
      // 氏名は姓/名それぞれを照合対象にする。記号は落とし（"(AI)" 等の飾りを除く）、
      // ASCII は 4 文字以上（短い一般語の誤検知よけ）、CJK は 2 文字以上（氏名が短いため）。
      for (const part of s.split(/[\s._-]+/)) {
        const p = part.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
        const ascii = /^[\x20-\x7e]*$/.test(p)
        if (p.length >= (ascii ? 4 : 2)) out.add(p)
      }
    }
  }
  return [...out]
}

// ---- diff のパース（追加行と新ファイル行番号） --------------------------
function parseAddedLines(diff) {
  const out = []
  let file = null
  let lineNo = 0
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const p = raw.slice(4)
      file = p === '/dev/null' ? null : p.replace(/^b\//, '')
      continue
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw)
    if (hunk) {
      lineNo = Number(hunk[1])
      continue
    }
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      if (file && !SKIP_FILE.test(file)) out.push({ file, line: lineNo, text: raw.slice(1) })
      lineNo++
    }
  }
  return out
}

// 該当箇所を伏せ字にする（ログに秘密や個人情報を残さない）。matched は複数可。
function mask(text, matched) {
  let out = text
  for (const m of [].concat(matched || [])) {
    if (!m) continue
    out = out.split(m).join(`${m.slice(0, 2)}${'*'.repeat(Math.max(3, m.length - 2))}`)
  }
  return out
}

// ---- 本体 ---------------------------------------------------------------
function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(USAGE)
    return 0
  }

  const { base, reason } = resolveBase(opts.base)
  if (!base) {
    console.error(`✖ 走査範囲を決められません（${reason}）。--base <ref> で指定してください。\n${USAGE}`)
    return 1
  }
  const range = `${base}..HEAD`

  const files = (git(['diff', '--name-only', range], { allowFail: true }) || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  if (files.length === 0) {
    console.log(`✓ 走査対象なし（${range}：差分ゼロ）。push するものがありません。`)
    return 0
  }

  const diff = git(['diff', '-U0', '--no-color', range], { allowFail: true }) || ''
  const added = parseAddedLines(diff)
  const tokens = personalTokens()
  const hits = []

  // 1) 変更ファイル名（鍵/環境ファイル）
  for (const f of files) {
    for (const r of RISKY_FILE) {
      if (r.re.test(f)) hits.push({ kind: 'file', name: r.name, file: f, line: 0, matched: f, text: f })
    }
  }

  // 2) 追加行の中身
  for (const { file, line, text } of added) {
    const allowed = ALLOW.some((re) => re.test(text))
    for (const r of RULES) {
      if (allowed) continue
      const m = r.re.exec(text)
      if (!m) continue
      if (r.ok && !r.ok(m)) continue
      hits.push({ kind: r.kind, name: r.name, file, line, matched: m[0], text })
    }
    // 本人識別子（実行時取得）
    if (!allowed) {
      const lower = text.toLowerCase()
      const found = tokens
        .map((t) => {
          const i = lower.indexOf(t)
          return i >= 0 ? text.slice(i, i + t.length) : null
        })
        .filter(Boolean)
      if (found.length) hits.push({ kind: 'personal', name: '本人識別子', file, line, matched: found, text })
    }
  }

  const header = `走査範囲 ${range}（${reason}）／変更ファイル ${files.length} 件／追加行 ${added.length} 行`
  if (hits.length === 0) {
    console.log(`✓ 自己点検クリア（${header}）`)
    return 0
  }

  const LABEL = { secret: '秘密情報', personal: '個人情報', path: '絶対パス', file: '鍵/環境ファイル' }
  console.error(`✖ 自己点検で ${hits.length} 件を検出（${header}）`)
  for (const h of hits) {
    const where = h.line ? `${h.file}:${h.line}` : h.file
    console.error(`  [${LABEL[h.kind]}] ${where} — ${h.name}`)
    if (opts.verbose && h.line) console.error(`      ${mask(h.text.trim(), h.matched)}`)
  }
  console.error(
    '\n  秘密情報が本物なら push しないでください（履歴に残ります）。本人に報告して指示を仰ぐこと。\n' +
      '  誤検知なら理由を添えて報告し、必要に応じて ALLOW（scripts/push-selfcheck.mjs）に控えめに追加してください。',
  )
  return 1
}

process.exit(main())
