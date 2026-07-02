// 教材コンテンツを content.sqlite3 から読み込む（SQLite-WASM・メモリ・読み取り専用）。
// 配布物の .sqlite3 を fetch → メモリDBに deserialize してクエリする。
// 読み取り専用なので OPFS も Worker も不要＝メインスレッドで動く（ユーザーデータ側とは別系統）。
// 返す配列/オブジェクトの形は従来の src/content/*.js と同一にして、hooks/UI を無改修に保つ。
let dbPromise = null

// SQLite ファイルのマジック "SQLite format 3\0"（先頭16バイト）。
const SQLITE_MAGIC = [
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// バイト列が SQLite DB らしいか（truncated / 破損の早期検知）。
function looksLikeSqlite(bytes) {
  if (!bytes || bytes.byteLength < 512) return false
  return SQLITE_MAGIC.every((b, i) => bytes[i] === b)
}

// content.sqlite3 を取得。瞬断・truncated に備えてリトライ（指数バックオフ）＋整合チェックする。
async function fetchDbBytes(url, retries = 2) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const bytes = new Uint8Array(await res.arrayBuffer())
      if (!looksLikeSqlite(bytes)) throw new Error(`不正な SQLite（${bytes.byteLength} bytes）`)
      return bytes
    } catch (e) {
      lastErr = e
      if (attempt < retries) await sleep(200 * 2 ** attempt) // 200ms → 400ms
    }
  }
  throw lastErr
}

async function openDb() {
  const { default: sqlite3InitModule } = await import('@sqlite.org/sqlite-wasm')
  const sqlite3 = await sqlite3InitModule()
  // base 相対で解決（dev / GitHub Pages サブパス / Electron file:// のいずれでも可）。
  const url = new URL('content.sqlite3', document.baseURI).href
  const bytes = await fetchDbBytes(url)
  const db = new sqlite3.oo1.DB()
  const p = sqlite3.wasm.allocFromTypedArray(bytes)
  const rc = sqlite3.capi.sqlite3_deserialize(
    db.pointer,
    'main',
    p,
    bytes.byteLength,
    bytes.byteLength,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
  )
  db.checkRc(rc)
  return db
}

// 初期化は1回だけ（同一 Promise を共有）。
function db() {
  if (!dbPromise) dbPromise = openDb()
  return dbPromise
}

// 単語（wordsData.js の default 相当）。level 指定でそのレベルだけ取得（テーマ絞りはドメイン側）。
// テーマで絞らないのは、4択クイズが同レベル全テーマをディストラクタに使うため（levelWords）。
// null の freq/theme は省いて従来の形に合わせる。
export async function queryWords(level) {
  const d = await db()
  const where = level != null ? ' WHERE level = ?' : ''
  const bind = level != null ? [level] : []
  return d.selectObjects('SELECT en, ja, kana, freq, level, theme FROM words' + where, bind).map((w) => ({
    en: w.en,
    ja: w.ja,
    kana: w.kana,
    ...(w.freq != null ? { freq: w.freq } : {}),
    level: w.level,
    ...(w.theme != null ? { theme: w.theme } : {}),
  }))
}

// 英英（dictionaryData.js の default 相当）。level 指定でそのレベルだけ取得。theme は null 可（従来通り保持）。
export async function queryDict(level) {
  const d = await db()
  const where = level != null ? ' WHERE level = ?' : ''
  const bind = level != null ? [level] : []
  return d.selectObjects('SELECT word, def, ja, kana, level, theme FROM dict' + where, bind)
}

// 例文（wordSentences/L{level}.js の default 相当）。jaWords は JSON 文字列なので配列へ戻す。
export async function querySentences(level) {
  const d = await db()
  const rows = d.selectObjects(
    'SELECT level, word, en, ja, kana, jaWords FROM sentences WHERE level = ?',
    [level],
  )
  for (const r of rows) r.jaWords = JSON.parse(r.jaWords)
  return rows
}

// グロス（wordGlossData.js の default 相当＝{ [en]: ja } マップ）。
export async function queryGloss() {
  const d = await db()
  const map = {}
  for (const { en, ja } of d.selectObjects('SELECT en, ja FROM gloss')) map[en] = ja
  return map
}
