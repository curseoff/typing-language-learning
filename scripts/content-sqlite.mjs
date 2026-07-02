// 生成ツール：content/*.ndjson・content/stories/*.json（正準ソース）から
// 配布・クエリ用の content.sqlite3（関係スキーマ）を生成する（生成物＝gitignore）。
//
// アプリのランタイムは現状の .js 遅延ロードのまま（この DB はまだ実行時に読まない）。
// ユーザーデータ（user.sqlite3）とは別ファイル＝混ぜない。必要時だけ ATTACH で JOIN。
//
// 実行: node scripts/content-sqlite.mjs   （npm run content:sqlite）
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { readNdjson } from './lib/ndjson.mjs'

const u = (p) => new URL(p, import.meta.url)
// public/ に置く＝dev/build で静的アセットとして配信され、アプリが fetch できる（生成物・gitignore）。
mkdirSync(u('../public/'), { recursive: true })
const OUT = u('../public/content.sqlite3')
const SCHEMA_VERSION = 1

const sqlite3 = await sqlite3InitModule()
const db = new sqlite3.oo1.DB() // メモリ上で構築して最後にバイト列で書き出す

db.exec(`
  PRAGMA journal_mode = OFF;
  CREATE TABLE words(en TEXT PRIMARY KEY, ja TEXT NOT NULL, kana TEXT NOT NULL, freq INTEGER, level INTEGER NOT NULL, theme TEXT);
  CREATE INDEX idx_words_level_theme ON words(level, theme);
  CREATE TABLE dict(word TEXT PRIMARY KEY, def TEXT NOT NULL, ja TEXT NOT NULL, kana TEXT NOT NULL, level INTEGER NOT NULL, theme TEXT);
  CREATE INDEX idx_dict_level_theme ON dict(level, theme);
  CREATE TABLE sentences(word TEXT PRIMARY KEY, level INTEGER NOT NULL, en TEXT NOT NULL, ja TEXT NOT NULL, kana TEXT NOT NULL, jaWords TEXT NOT NULL);
  CREATE INDEX idx_sentences_level ON sentences(level);
  CREATE TABLE gloss(en TEXT PRIMARY KEY, ja TEXT NOT NULL);
  CREATE TABLE stories(id TEXT PRIMARY KEY, title TEXT, json TEXT NOT NULL);
  CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT);
`)

// 準備済みステートメントで一括 INSERT（1トランザクション）。
function bulkInsert(sql, rows, toArgs) {
  const stmt = db.prepare(sql)
  try {
    for (const r of rows) {
      stmt.bind(toArgs(r))
      stmt.step()
      stmt.reset()
    }
  } finally {
    stmt.finalize()
  }
  return rows.length
}

db.exec('BEGIN')

const nWords = bulkInsert(
  'INSERT INTO words(en, ja, kana, freq, level, theme) VALUES(?,?,?,?,?,?)',
  readNdjson(u('../content/words.ndjson')),
  (w) => [w.en, w.ja, w.kana, w.freq ?? null, w.level, w.theme ?? null],
)
const nDict = bulkInsert(
  'INSERT INTO dict(word, def, ja, kana, level, theme) VALUES(?,?,?,?,?,?)',
  readNdjson(u('../content/dict.ndjson')),
  (d) => [d.word, d.def, d.ja, d.kana, d.level, d.theme ?? null],
)
const nSent = bulkInsert(
  'INSERT INTO sentences(word, level, en, ja, kana, jaWords) VALUES(?,?,?,?,?,?)',
  readNdjson(u('../content/sentences.ndjson')),
  (s) => [s.word, s.level, s.en, s.ja, s.kana, JSON.stringify(s.jaWords)],
)
const nGloss = bulkInsert(
  'INSERT INTO gloss(en, ja) VALUES(?,?)',
  readNdjson(u('../content/gloss.ndjson')),
  (g) => [g.en, g.ja],
)

// stories はネスト文書なので JSON 文字列で保持（1物語=1行）。
const storyDir = u('../content/stories/')
const storyFiles = readdirSync(storyDir).filter((f) => f.endsWith('.json'))
let nStory = 0
for (const f of storyFiles) {
  const obj = JSON.parse(readFileSync(new URL(f, storyDir), 'utf8'))
  db.exec({
    sql: 'INSERT INTO stories(id, title, json) VALUES(?,?,?)',
    bind: [obj.id, obj.title ?? null, JSON.stringify(obj)],
  })
  nStory++
}

for (const [key, value] of [
  ['schema_version', String(SCHEMA_VERSION)],
  ['source', 'content/*.ndjson, content/stories/*.json'],
  ['words', String(nWords)],
  ['dict', String(nDict)],
  ['sentences', String(nSent)],
  ['gloss', String(nGloss)],
  ['stories', String(nStory)],
]) {
  db.exec({ sql: 'INSERT INTO meta(key, value) VALUES(?,?)', bind: [key, value] })
}

db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
db.exec('COMMIT')

const bytes = sqlite3.capi.sqlite3_js_db_export(db.pointer)
db.close()
writeFileSync(OUT, Buffer.from(bytes))

const kb = Math.round(bytes.length / 1024)
console.log(
  `✓ content.sqlite3 生成: ${kb} KB（words ${nWords} / dict ${nDict} / sentences ${nSent} / gloss ${nGloss} / stories ${nStory}）`,
)
