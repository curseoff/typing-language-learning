export const meta = {
  name: 'impl-fanout',
  description:
    '契約済みの独立タスクを worktree 隔離で並列実装→検証し、マージ可能ブランチ＋裁定レポートを司令塔/本人へ返す（合流の直列詰まりを解消。マージ/push/PR はしない＝本人ゲート温存）',
  whenToUse:
    'planner が契約(spec)を切った独立タスクが複数あるとき。args: { items:[{id,kind,issue,title,contract,files}], base? }。kind は logic(=TDD:Red→Green)/simple(=coder直). マージ・push・PR・Issue操作はしない。' +
    ' 【注意】domain 配下のタスクは契約に DDD 準拠のファイル名(*.vo.js / *.service.js 等)を指定すること（src/domain の命名メタテスト _ddd-naming.test.js に掛かり check:fast が赤になるため）。',
  phases: [
    { title: 'Setup' },   // タスクごとに worktree + ブランチを作る
    { title: 'Red' },      // logic のみ: test-author が失敗テストを書いてコミット
    { title: 'Green' },    // coder が最小実装で緑（テストは触らない）
    { title: 'Verify' },   // reviewer が差分を再利用/簡素化/正しさで裁定
    { title: 'Synthesize' }, // 全結果を合成しマージ順・要判断を提示
  ],
}

// ---- 入力（args が JSON 文字列で届くケースにも耐える）----
const input = typeof args === 'string' ? JSON.parse(args) : (args ?? {})
const items = Array.isArray(input?.items) ? input.items : []
const BASE = input?.base ?? 'origin/develop'
if (!items.length) {
  return { error: 'args.items が空です。[{ id, kind:"logic"|"simple", issue, title, contract, files:[] }] を渡してください。' }
}

const WT = (id) => `.claude/worktrees/wf-${id}`
const BR = (id) => `feature/wf-${id}`

// ---- schema ----
const S = (props, req) => ({ type: 'object', properties: props, required: req ?? Object.keys(props) })
const SETUP = S({ path: { type: 'string' }, branch: { type: 'string' }, ok: { type: 'boolean' } })
const RED = S(
  { skipped: { type: 'boolean' }, testFile: { type: 'string' }, redConfirmed: { type: 'boolean' }, note: { type: 'string' } },
  ['skipped', 'redConfirmed'],
)
const GREEN = S(
  { passed: { type: 'boolean' }, touchedTests: { type: 'boolean' }, changed: { type: 'array', items: { type: 'string' } }, note: { type: 'string' } },
  ['passed', 'touchedTests'],
)
const VERIFY = S(
  { verdict: { type: 'string', enum: ['pass', 'revise', 'block'] }, reasons: { type: 'array', items: { type: 'string' } }, cleanup: { type: 'string' } },
  ['verdict', 'reasons'],
)

// ---- pipeline: 各タスクを独立に Setup→Red→Green→Verify（バリアなし）----
const results = await pipeline(
  items,

  // 1) Setup: worktree + ブランチ
  (it) =>
    agent(
      `Bash で（リポジトリのルートで）タスク「${it.title}」用の隔離環境を作る。\n` +
        `\`git worktree add ${WT(it.id)} -b ${BR(it.id)} ${BASE}\` を実行（同名が既にあれば ` +
        `\`git worktree remove --force ${WT(it.id)}\` と \`git branch -D ${BR(it.id)}\` で掃除してから作り直す）。\n` +
        `作成した worktree の**絶対パス**と branch 名を返す。ファイル編集・コミットはしない。`,
      { agentType: 'general-purpose', schema: SETUP, label: `setup ${it.id}`, phase: 'Setup' },
    ).then((setup) => ({ item: it, setup })),

  // 2) Red: logic のみ test-author が失敗テスト（simple はスキップ）
  (prev) => {
    const { item, setup } = prev
    if (!setup?.ok || item.kind !== 'logic') {
      return Promise.resolve({ ...prev, red: { skipped: true, redConfirmed: false, note: item.kind !== 'logic' ? 'simple: Red不要' : 'setup失敗' } })
    }
    return agent(
      `作業ツリーは \`${setup.path}\`（このタスク専用の worktree）。他のディレクトリは触らない。\n` +
        `Issue #${item.issue} の契約に対する**失敗するテスト(Red)**を \`${setup.path}\` 配下に書く。実装(src の非テストファイル)は書かない。\n` +
        `契約: ${item.contract}\n` +
        `対象付近: ${(item.files || []).join(', ') || '(契約から判断)'}\n` +
        `\`npm --prefix ${setup.path} run test\` で**当該テストが赤**であることを確認する（Red確認は vitest だけでよい）。\n` +
        `Red のコミットは worktree 内で行う: \`cd ${setup.path}\` してから、リポジトリの \`scripts/ai-commit.sh\` を**絶対パス**で \`-m "<簡潔な日本語・辞書形>"\` 付きで呼ぶ（事前に \`git add\`）。\n` +
        `返り値: skipped=false, testFile=書いたテストの相対パス, redConfirmed=赤を確認できたか。`,
      { agentType: 'test-author', schema: RED, label: `red ${item.id}`, phase: 'Red' },
    ).then((red) => ({ ...prev, red }))
  },

  // 3) Green: coder が最小実装で緑（テストは編集しない）
  (prev) => {
    const { item, setup, red } = prev
    if (!setup?.ok) return Promise.resolve({ ...prev, green: { passed: false, touchedTests: false, note: 'setup失敗' } })
    const tddNote =
      item.kind === 'logic' && red?.redConfirmed
        ? `test-author が置いた失敗テスト(${red.testFile})を**編集せず**通す最小実装を書く。`
        : `契約どおりの最小実装を書く（このタスクはテスト先行対象外）。`
    return agent(
      `作業ツリーは \`${setup.path}\`（このタスク専用の worktree）。他のディレクトリは触らない。\n` +
        `${tddNote}\n` +
        `契約: ${item.contract}\n` +
        `\`npm --prefix ${setup.path} run check:fast\` を緑にしてから、Green を worktree 内でコミットする` +
        `（\`cd ${setup.path}\` してから \`scripts/ai-commit.sh\` を**絶対パス**で \`-m\` 付きで呼ぶ。事前に \`git add\`）。\n` +
        `返り値: passed=check:fast が緑か, touchedTests=差分が \`*.test.*\` を1つでも変更したか(true は規約違反), changed=変更ファイル一覧。`,
      { agentType: 'coder', schema: GREEN, label: `green ${item.id}`, phase: 'Green' },
    ).then((green) => ({ ...prev, green }))
  },

  // 4) Verify: reviewer が差分を裁定（read-only）
  (prev) => {
    const { item, setup } = prev
    if (!setup?.ok) return Promise.resolve({ ...prev, verify: { verdict: 'block', reasons: ['setup失敗'] } })
    return agent(
      `\`${setup.path}\` の \`${BASE}..HEAD\` 差分（branch ${setup.branch}）を read-only でレビューする。\n` +
        `観点: 再利用（既存ユーティリティ/ドメインの再発明が無いか）・簡素化・効率・正しさ、および層/依存方向(ui→application→domain, domain は React/DOM 非依存)。\n` +
        `契約との一致も見る: ${item.contract}\n` +
        `verdict=pass(そのままマージ可)/revise(軽微な手直し要)/block(重大・マージ不可)。reasons に file:line で根拠、cleanup に任意の簡素化提案。`,
      { agentType: 'reviewer', schema: VERIFY, label: `verify ${item.id}`, phase: 'Verify' },
    ).then((verify) => ({ ...prev, verify }))
  },
)

// ---- マージ可否は素の JS で判定（コミッタ役の恣意を排除）----
const scored = results.filter(Boolean).map((r) => {
  const id = r.item?.id
  const redOk = r.item?.kind !== 'logic' || r.red?.redConfirmed === true
  const greenOk = r.green?.passed === true
  const testsClean = r.green?.touchedTests !== true // coder がテストを触っていない
  const verdict = r.verify?.verdict
  const ready = redOk && greenOk && testsClean && verdict === 'pass'
  const blockers = []
  if (!redOk) blockers.push('Red未確認(logic)')
  if (!greenOk) blockers.push('check:fast赤')
  if (!testsClean) blockers.push('coderがテストを変更(規約違反)')
  if (verdict !== 'pass') blockers.push(`reviewer=${verdict ?? '不明'}`)
  return { id, issue: r.item?.issue, title: r.item?.title, branch: BR(id), ready, blockers, verify: r.verify }
})

const ready = scored.filter((s) => s.ready)
const needsWork = scored.filter((s) => !s.ready)
log(`合流準備: ${ready.length}/${scored.length} がマージ可、${needsWork.length} が要手直し`)

// ---- Synthesize: reviewer が全体を合成し、マージ順と要判断を提示（マージはしない）----
phase('Synthesize')
const report = await agent(
  `複数タスクの実装結果を合成し、**本人/司令塔がマージ判断に使える**要約を日本語で作る（read-only・マージやpushはしない）。\n` +
    `各タスク（branch=${BR('<id>')}）: ${JSON.stringify(scored)}\n` +
    `出したいもの: (1) マージ可のブランチと推奨マージ順（依存/衝突リスク順）、(2) 要手直しタスクとブロッカー、(3) 直列マージキューに入れる際の注意（同一ファイル衝突など）。` +
    `簡潔な Markdown で。`,
  { agentType: 'reviewer', label: 'synthesize', phase: 'Synthesize' },
)

return {
  base: BASE,
  ready: ready.map((s) => ({ branch: s.branch, issue: s.issue, title: s.title })),
  needsWork: needsWork.map((s) => ({ branch: s.branch, issue: s.issue, title: s.title, blockers: s.blockers })),
  report,
  note: 'マージ・push・PR・Issue操作は未実施（本人ゲート）。worktree/ブランチは残置。本人がマージ後 git worktree remove で掃除。',
}
