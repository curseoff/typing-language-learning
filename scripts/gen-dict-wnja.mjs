// 英英辞典の生成パイプライン①（wn-ja 取込み・Claude ゼロ）。
//   node scripts/gen-dict-wnja.mjs --count 300 --chunks 6
// 日本語WordNet(wn-ja)の SQLite から作った TSV（lemma \t edef \t jdef）を引くだけで、
// 追加対象語の英定義(def)・日本語定義(ja)を機械生成する。kana は付けない（merge-dict が自動生成）。
//
// 入力 TSV（topsense.tsv）の作り方＝wn-ja の SQLite(wnjpn.db) から、語ごとに
// 「最頻語義（sense.freq 最大）」の英 gloss と日本語定義を 1 件ずつ抜く（再現用 SQL・window 関数）:
//
//   WITH ranked AS (
//     SELECT w.lemma AS lemma,
//            MIN(sd_e.def) AS edef,
//            MIN(sd_j.def) AS jdef,
//            ROW_NUMBER() OVER (
//              PARTITION BY w.lemma
//              ORDER BY MAX(s.freq) DESC, s.synset
//            ) AS rn
//     FROM word w
//     JOIN sense s        ON s.wordid = w.wordid
//     JOIN synset_def sd_e ON sd_e.synset = s.synset AND sd_e.lang = 'eng'
//     JOIN synset_def sd_j ON sd_j.synset = s.synset AND sd_j.lang = 'jpn'
//     WHERE w.lang = 'eng'
//     GROUP BY w.lemma, s.synset
//   )
//   SELECT lemma, edef, jdef FROM ranked WHERE rn = 1;
//
//   実行: sqlite3 -separator $'\t' wnjpn.db < q.sql > topsense.tsv
//   ※ wnjpn.db（194MB）はリポジトリに入れない。
//
// 引数:
//   --tsv <path>   topsense.tsv のパス。未指定なら環境変数 WNJA_TSV、無ければ tmp/wnja/topsense.tsv
//   --count N      追加対象の上限（freq 昇順で先頭から）。既定 300
//   --chunks M     out-NN.json への分割数。既定 6
//   --dir <out>    出力先。既定 /tmp/dictgen
//   --levels 1,2   対象レベルの絞り込み（カンマ区切り）。既定 全レベル
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { WORDS } from '../src/content/wordsAll.js'
import { DICT } from '../src/content/dictionaryAll.js'

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
// TSV のパスは --tsv → 環境変数 WNJA_TSV → リポ相対 tmp/wnja/topsense.tsv の順。
// 絶対パスを直書きしない（PUBLIC リポに username 等を残さないため）。
const tsvPath = arg('tsv', process.env.WNJA_TSV || 'tmp/wnja/topsense.tsv')
const count = Number(arg('count', '300'))
const chunks = Number(arg('chunks', '6'))
const dir = arg('dir', '/tmp/dictgen')
const levelsArg = arg('levels', '')
const levelSet = levelsArg ? new Set(levelsArg.split(',').map(Number)) : null

// ---- 整形（proto-dict.mjs 踏襲） ----
function cleanDef(s) {
  let d = (s || '').split(';')[0]
  d = d.replace(/\([^)]*\)/g, ' ').toLowerCase().replace(/[-/]/g, ' ').replace(/[^a-z ]+/g, ' ')
  return d.replace(/\s+/g, ' ').trim()
}
// 算用数字（半角/全角）は読みのローマ字化を壊すので漢数字へ寄せる（二つ→ふたつ 等が読めるように）。
const DIGIT_KANJI = { 0: '〇', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' }
const toKanjiNum = (s) => s.replace(/[0-9０-９]/g, (d) => DIGIT_KANJI[d.charCodeAt(0) > 0xff ? d.charCodeAt(0) - 0xff10 : Number(d)])

function cleanJa(s) {
  let j = (s || '').replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '') // 括弧除去
  j = toKanjiNum(j) // 算用数字→漢数字
  j = j.split(/[；;]/)[0] // ；/; 以降を捨てる
  j = j.replace(/[、・]/g, '') // 読点「、」と中黒「・」を除去（中間も）
  j = j.replace(/[\s]+/g, '') // 空白（全角含む）を除去（読みのローマ字化を壊さない）
  j = j.replace(/[。．.,，？！?!]+$/u, '').trim() // 文末記号を除去
  return j
}

// ---- theme 分類（旅行/ビジネスのみ。確信度の高いキーワードに限る。迷ったら null） ----
const TRAVEL = /旅行|旅|空港|ホテル|観光|航空|飛行機|列車|鉄道|乗客|出発|到着|宿泊|名所|遺跡/
const BUSINESS = /会社|企業|契約|会議|業務|経済|金融|取引|株式|銀行|商業|貿易|雇用|顧客|販売|利益|投資/
function classifyTheme(word, ja) {
  if (word.theme !== undefined) return word.theme // 単語が theme を持つなら継承
  if (TRAVEL.test(ja)) return '旅行'
  if (BUSINESS.test(ja)) return 'ビジネス'
  return null
}

// ---- 品質フィルタ ----
const DEF_OK = /^[a-z ]+$/
const DEF_FRAG = / (or|of|and|the)$/ // 断片（接続詞・前置詞で宙ぶらりん）
const JA_FRAG = /(あるいは|または|もしくは|ないし|および|かつ)$/
const maxDef = Number(arg('maxdef', '90')) // def 文字数上限。網羅したいときは大きくする
function reject(def, ja) {
  if (!DEF_OK.test(def)) return 'def書式'
  if (def.length > maxDef) return 'def長すぎ'
  if (DEF_FRAG.test(def)) return 'def断片'
  if (!ja) return 'ja空'
  if (/[0-9０-９]/.test(ja)) return 'ja数字' // 算用数字が残れば（変換漏れ）除外
  if (JA_FRAG.test(ja)) return 'ja断片'
  return null
}

// ---- TSV 読み込み（lemma \t edef \t jdef、最初の語義のみ採用） ----
if (!existsSync(tsvPath)) {
  console.error(`TSV が見つかりません: ${tsvPath}`)
  console.error('--tsv <path> か 環境変数 WNJA_TSV で指定してください（作り方は本ファイル冒頭の SQL を参照）。')
  process.exit(1)
}
const tsv = new Map()
for (const line of readFileSync(tsvPath, 'utf8').split('\n')) {
  if (!line) continue
  const [lemma, edef, jdef] = line.split('\t')
  if (lemma && !tsv.has(lemma)) tsv.set(lemma, { edef, jdef })
}

// ---- 追加対象の選定（未収録・英小文字・freqあり・tsvにある／freq 昇順） ----
const inDict = new Set(DICT.map((d) => d.word))
const cands = WORDS.filter(
  (w) =>
    !inDict.has(w.en) &&
    /^[a-z]+$/.test(w.en) &&
    typeof w.freq === 'number' &&
    tsv.has(w.en) &&
    (!levelSet || levelSet.has(w.level)),
)
  .sort((a, b) => a.freq - b.freq)
  .slice(0, count)

// ---- 生成 ----
const accepted = []
const rejected = {}
for (const w of cands) {
  const { edef, jdef } = tsv.get(w.en)
  const def = cleanDef(edef)
  const ja = cleanJa(jdef)
  const r = reject(def, ja)
  if (r) {
    rejected[r] = (rejected[r] || 0) + 1
    continue
  }
  accepted.push({ word: w.en, def, ja, level: w.level, theme: classifyTheme(w, ja) })
}

// ---- 出力（out-NN.json に分割。既存の out-NN.json は掃除、out-redo* は残す） ----
if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
for (const f of readdirSync(dir).filter((f) => /^out-\d+\.json$/.test(f))) rmSync(`${dir}/${f}`)
const per = Math.ceil(accepted.length / chunks) || 1
let fileN = 0
for (let i = 0; i < accepted.length; i += per) {
  const part = accepted.slice(i, i + per)
  const name = `out-${String(fileN).padStart(2, '0')}.json`
  writeFileSync(`${dir}/${name}`, JSON.stringify(part))
  fileN++
}

// ---- ログ ----
const byLevel = {}
const byTheme = {}
for (const a of accepted) {
  byLevel[a.level] = (byLevel[a.level] || 0) + 1
  const t = a.theme == null ? 'なし' : a.theme
  byTheme[t] = (byTheme[t] || 0) + 1
}
const rejTotal = Object.values(rejected).reduce((s, n) => s + n, 0)
console.log(`候補: ${cands.length} / 採用: ${accepted.length} / 除外: ${rejTotal}`)
console.log(`除外理由: ${JSON.stringify(rejected)}`)
console.log(`レベル分布: ${JSON.stringify(byLevel)}`)
console.log(`テーマ分布: ${JSON.stringify(byTheme)}`)
console.log(`出力: ${dir}/out-00.json 〜 (${fileN}ファイル)`)
console.log(`続けて: npm run merge-dict（kana 自動生成＋検証）`)
