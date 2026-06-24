export const meta = {
  name: 'word-sentences',
  description: '単語例文を1ラウンド自動生成（選定→並列生成→検証→再生成→読み点検→追記）',
  whenToUse: '単語例文(wordSentences.js)を N 件増やすとき。args: { count, chunks, write }',
  phases: [
    { title: 'Select' },
    { title: 'Generate' },
    { title: 'Merge' },
    { title: 'Regen' },
    { title: 'Review' },
    { title: 'Write' },
  ],
}

// 設定（args で上書き可）
const COUNT = args?.count ?? 1000
const CHUNKS = args?.chunks ?? 12
const DIR = '/tmp/sentgen'
const WRITE = args?.write ?? true
const A = { agentType: 'general-purpose' }

// 生成プロンプト（チャンク ix=01.. を読み out-ix.json を書く）
const GEN = (ix) =>
  `日本語学習者向けタイピング教材の「単語例文」を作る。\n` +
  `\`${DIR}/chunk-${ix}.json\`（[{en,ja,level}]）を **Read** し、各語に例文1つを作って ` +
  `JSON配列を \`${DIR}/out-${ix}.json\` に **Write**。応答は件数だけ。\n` +
  `要素: { "word":"<en>","level":<chunkのlevel>,"en":"...","ja":"...","kana":"...","jaWords":[...] }\n` +
  `ルール(厳守): en=その語(語形変化可)を実際に使ったやさしい英文・末尾 . か ?・固有名詞回避。` +
  `ja=自然な和訳(カタカナ外来語を避け和語/漢語に)・末尾は .→。 / ?→？。` +
  `kana=jaの読み・ひらがなのみ・末尾記号含む・長音ー禁止・促音/濁点/拗音正確・助詞も読みに含める(「母は」=「ははは」)。` +
  `jaWords=ja(末尾句読点除く)を形態素分割し連結すると一致。\n` +
  `例: { "word":"school","level":1,"en":"I go to school every day.","ja":"私は毎日学校へ行きます。","kana":"わたしはまいにちがっこうへいきます。","jaWords":["私","は","毎日","学校","へ","行き","ます"] }`

const REGEN =
  `前回NGの単語例文を作り直す。\`${DIR}/redo.json\`（[{en,ja,level}]）を **Read** し、各語に例文1つ→ ` +
  `\`${DIR}/out-redo.json\` に **Write**。応答は件数だけ。\n` +
  `特に厳守: (1) jaWordsの連結が ja(末尾句読点除く)と完全一致。(2) kana に長音ー を出さない(カタカナ外来語を使わず和語/漢語に)。(3) 対象語 en を例文で実際に使う。` +
  `スキーマ/他ルールは通常の生成と同じ。`

const REVIEW = (i) =>
  `日本語例文の読み(kana)校正。\`${DIR}/rev-${i}.json\`（[{word,ja,kana,gen}]）を **Read**。` +
  `各件、kana が ja(句読点除く)の自然な読みとして正しいか判断(genは機械生成の参考・誤りも多い)。` +
  `明らかに誤っている件だけ正しい読みを出す(漢字の音訓取り違え/助詞「は」の読み落とし=「母は」は「ははは」/送り仮名・促音・濁点の誤り)。` +
  `揺れ(みんな/みな等)は誤りにしない。正しい kana はひらがなのみ・長音ー不可・末尾句読点なし。` +
  `\`${DIR}/revfix-${i}.json\` に **Write**: [{"word":"...","kana":"..."}]（無ければ[]）。応答は件数だけ。`

const RUN = (cmd, note) =>
  `Bash で（このリポジトリのルートで）\`${cmd}\` を実行する。出力の最後の要約行から${note}を読み取って返す。`

const NUM = (props) => ({ type: 'object', properties: props, required: Object.keys(props) })
const MERGE_SCHEMA = NUM({ input: { type: 'number' }, ok: { type: 'number' }, ng: { type: 'number' } })

// 1) 選定（chunk-*.json を生成）
phase('Select')
const sel = await agent(
  RUN(`npm run gen-sentences -- --count ${COUNT} --chunks ${CHUNKS} --dir ${DIR}`, '生成された chunk の個数(chunks)'),
  { ...A, schema: NUM({ chunks: { type: 'number' } }), label: 'gen-sentences', phase: 'Select' },
)
const n = Math.max(1, Math.min(CHUNKS, sel?.chunks || CHUNKS))
log(`選定: ${n}チャンク`)

// 2) 並列生成（各チャンク → out-NN.json）
phase('Generate')
const idxs = Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, '0'))
await parallel(idxs.map((ix) => () => agent(GEN(ix), { ...A, label: `gen ${ix}`, phase: 'Generate' })))

// 3) マージ＋構造検証
phase('Merge')
let merged = await agent(RUN('npm run merge-sentences', '「入力/構造OK/NG」の数(input,ok,ng)'), {
  ...A,
  schema: MERGE_SCHEMA,
  label: 'merge',
  phase: 'Merge',
})
log(`マージ: OK ${merged?.ok} / NG ${merged?.ng}`)

// 4) NGがあれば 再生成→再マージ（最大3周）
phase('Regen')
let round = 0
while ((merged?.ng || 0) > 0 && round < 3) {
  await agent(REGEN, { ...A, label: `regen r${round + 1}`, phase: 'Regen' })
  merged = await agent(RUN('npm run merge-sentences', '「入力/構造OK/NG」の数(input,ok,ng)'), {
    ...A,
    schema: MERGE_SCHEMA,
    label: `merge r${round + 1}`,
    phase: 'Regen',
  })
  log(`再マージ r${round + 1}: NG ${merged?.ng}`)
  round++
}

// 5) 読み点検（候補抽出 → 並列レビュー）
phase('Review')
const rev = await agent(
  RUN('npm run check-readings', '生成された rev ファイル数(files)と候補数(cand)'),
  { ...A, schema: NUM({ files: { type: 'number' }, cand: { type: 'number' } }), label: 'check-readings', phase: 'Review' },
)
const rf = Math.max(0, rev?.files || 0)
if (rf > 0) {
  await parallel(
    Array.from({ length: rf }, (_, i) => () => agent(REVIEW(i + 1), { ...A, label: `review ${i + 1}`, phase: 'Review' })),
  )
}

// 6) 追記＋検証
phase('Write')
if (!WRITE) {
  return { ng: merged?.ng ?? 0, reviewed: rf, note: 'write=false のため未追記（検証まで）' }
}
const fin = await agent(
  `Bash で（リポジトリのルートで）\`npm run merge-sentences -- --write\` を実行し、続けて \`npm run check\` を実行する。` +
    `merge の「合計 N件」と、check が「検証OK」で通ったか(passed:true/false)を返す。`,
  { ...A, schema: NUM({ total: { type: 'number' }, passed: { type: 'boolean' } }), label: 'write+check', phase: 'Write' },
)
log(`追記後 合計 ${fin?.total} / check ${fin?.passed ? 'OK' : 'NG'}`)
return fin
