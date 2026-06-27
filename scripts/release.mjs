// リリースをワンコマンド化（本人が実行する想定。本人の git/gh 認証を使う）。
//   npm run release -- patch        # 0.13.0 -> 0.13.1
//   npm run release -- minor        # 0.13.0 -> 0.14.0
//   npm run release -- 1.0.0        # 明示指定
//
// 流れ: 事前チェック → 秘密情報の自己点検(develop..master) → 版上げ＋lock同期 → check(CI同等)
//      → develop push → release/x.y.z 作成 → master PR → CI待ち → マージ → develop揃え
//      → GitHub Release 作成 → デプロイ確認
// 中断したいときは Ctrl-C。`gh` は GITHUB_TOKEN を外して（キーチェーン認証で）実行する。

import { execSync, execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const sh = (cmd, opts = {}) => (execSync(cmd, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'], ...opts }) ?? '').trim()
const ghEnv = { ...process.env }
delete ghEnv.GITHUB_TOKEN
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', env: ghEnv }).trim()
const log = (m) => console.log(`\x1b[36m▶\x1b[0m ${m}`)
const die = (m) => {
  console.error(`\x1b[31m✖ ${m}\x1b[0m`)
  process.exit(1)
}

const bump = process.argv[2]
if (!bump) die('使い方: npm run release -- <patch|minor|major|x.y.z>')

// 1) 事前チェック
log('事前チェック…')
if (sh('git status --porcelain')) die('作業ツリーに未コミット変更があります。')
const branch = sh('git rev-parse --abbrev-ref HEAD')
if (branch !== 'develop') die(`develop で実行してください（現在: ${branch}）。`)
sh('git fetch origin --quiet')
if (sh('git rev-parse HEAD') !== sh('git rev-parse origin/develop')) die('ローカル develop が origin/develop と一致しません。')

// 2) 秘密情報・個人情報の自己点検（develop..master の追加分）
log('自己点検（秘密情報・個人情報）…')
// 生成データ（語彙・例文・グロッサリ＝教育コンテンツ）は語彙語(secret/token/password 等)が
// 正規表現を誤検知するので自己点検から除外する。秘密情報はソース側に入るため検出に影響しない。
const diff = sh(
  "git diff origin/master..origin/develop -- . ':(exclude)src/content/*Data.js' ':(exclude)src/content/wordSentences/L*.js'",
)
const added = diff.split('\n').filter((l) => l.startsWith('+'))
const bad = /(api[_-]?key|secret|token|password|private[_-]?key|BEGIN [A-Z ]+PRIVATE KEY|\/Users\/[a-z]+\/|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i
// 誤検知の除外：JSX の key= 等、`env -u GITHUB_TOKEN gh`（このリポジトリの定番イディオム＝環境変数名であって秘密値ではない）など。
// 環境変数名そのものは除外する一方、後ろに代入記号と値が続く形は除外しない（実漏えいは引き続き検出）。
const ok = /key=\{|key:|\bsecret\b.*\bnone\b|env -u GITHUB_TOKEN|GITHUB_TOKEN(?![=:])/i
const hits = added.filter((l) => bad.test(l) && !ok.test(l))
if (hits.length) {
  console.error('\x1b[33m⚠ 要確認の行:\x1b[0m')
  hits.slice(0, 20).forEach((l) => console.error('  ' + l))
  die('秘密情報・個人情報の疑い。確認してください（誤検知なら手動でリリース）。')
}
console.log('  クリア')

// 3) 版上げ（package.json と package-lock.json を同期）
log(`版上げ: ${bump}`)
sh(`npm version ${bump} --no-git-tag-version`, { stdio: 'pipe' })
const ver = JSON.parse(readFileSync('package.json', 'utf8')).version
log(`新バージョン: v${ver}`)

// 4) CI 同等チェック
log('npm run check（CI同等ゲート）…')
sh('npm run check', { stdio: 'inherit' })

// 5) develop に版上げをコミット＆push（本人の署名）
sh('git add package.json package-lock.json')
sh(`git commit -q -m "v${ver} にバージョンを上げる"`)
sh('git push origin develop')

// 6) release ブランチ → master PR
const rel = `release/${ver}`
log(`${rel} → master PR を作成…`)
sh(`git branch -f ${rel} origin/develop`)
sh(`git push origin ${rel}`)
const prUrl = gh(['pr', 'create', '--base', 'master', '--head', rel, '--title', `Release v${ver}`, '--body', `v${ver} を master へ。詳細は develop の変更履歴を参照。`])
const prNum = prUrl.split('/').pop()
log(`PR #${prNum}: ${prUrl}`)

// 7) CI 待ち → マージ
log('CI を待機…')
try {
  execFileSync('gh', ['pr', 'checks', prNum, '--watch'], { stdio: 'inherit', env: ghEnv })
} catch {
  die('CI が失敗しました。修正してから再実行してください。')
}
log('master へマージ…')
gh(['pr', 'merge', prNum, '--merge'])

// 8) develop を master に揃え、ブランチ整理
sh('git fetch origin --quiet')
const masterSha = sh('git rev-parse origin/master')
sh(`git push origin ${masterSha}:refs/heads/develop`)
// リリースブランチ削除（GitHub の auto-delete で既に消えている場合があるので best-effort）
try {
  sh(`git push origin --delete ${rel}`, { stdio: 'pipe' })
} catch {
  log(`${rel} は既に削除済み（auto-delete）`)
}
sh(`git reset --hard origin/develop`, { stdio: 'pipe' })

// 9) GitHub Release
log('GitHub Release を作成…')
const prevTag = (() => {
  try {
    return sh('git describe --tags --abbrev=0 --match "v*" HEAD~1', { stdio: 'pipe' })
  } catch {
    return ''
  }
})()
const range = prevTag ? `${prevTag}..origin/master` : 'origin/master'
const notes = sh(`git log --no-merges --pretty=format:"- %s" ${range}`, { stdio: 'pipe' })
gh(['release', 'create', `v${ver}`, '--target', masterSha, '--latest', '--title', `v${ver}`, '--notes', `## 変更\n${notes}`])

// 10) デプロイ確認
log('デプロイを確認…')
try {
  const runId = gh(['run', 'list', '--workflow=deploy.yml', '--branch', 'master', '--limit', '1', '--json', 'databaseId', '--jq', '.[0].databaseId'])
  execFileSync('gh', ['run', 'watch', runId, '--exit-status'], { stdio: 'inherit', env: ghEnv })
} catch {
  console.log('  デプロイ確認はスキップ（手動で確認してください）')
}

console.log(`\n\x1b[32m✓ リリース完了: v${ver}\x1b[0m`)
console.log('  https://curseoff.github.io/typing-language-learning/')
