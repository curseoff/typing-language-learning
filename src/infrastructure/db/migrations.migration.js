// 順序付きマイグレーション定義（version 昇順・forward-only）。
// runMigrations が version > 現在版のみを昇順適用する。各 up(db) は db.exec で DDL を書く。
//
// Phase1（本 Issue #270）は最小土台のみ：version 1 で meta テーブルを作る
// （後続 Phase で checksum / バックアップメタ等を key-value で載せる土台）。
// ユーザーデータ本体テーブル（records/dict/word/item_stats/story）はここに入れない。
// Phase2（本 Issue #265）は version 2 でユーザーデータ本体テーブルを作る（前方のみ＝version 1 は不変）。
// スカラー/キー項目は列化し、可変長の segStats/choices のみ JSON 列（seg_stats/choices）に載せる。
// item_stats はフル関係テーブル。並び順と上位 MAX_RECORDS の確定は pos 列（load は ORDER BY pos）。
// endConditionTag は保存せず ec_kind/ec_value 列から再生成する（既定 time60 はタグ無し＝従来キー一致）。
export const migrations = [
  {
    version: 1,
    up(db) {
      db.exec('CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT)')
    },
  },
  {
    version: 2,
    up(db) {
      // マラソン記録（mode×rank×source×theme×終了条件別ランキング）。segStats/choices は持たない。
      db.exec(`CREATE TABLE IF NOT EXISTS "records"(
        "id" INTEGER PRIMARY KEY,
        "mode" TEXT, "rank" INTEGER, "source" TEXT, "theme" TEXT,
        "ec_kind" TEXT, "ec_value" INTEGER, "pos" INTEGER,
        "seed" INTEGER, "speed" REAL, "keys" INTEGER, "mistakes" INTEGER,
        "accuracy" REAL, "correctCount" INTEGER, "seconds" REAL, "date" TEXT
      )`)
      db.exec(`CREATE INDEX IF NOT EXISTS "records_group" ON "records"
        ("mode","rank","source","theme","ec_kind","ec_value","pos")`)

      // 単語問題記録（通常＋クイズを収容）。クイズ固有 correct/words は nullable。segStats は JSON 列。
      db.exec(`CREATE TABLE IF NOT EXISTS "word_records"(
        "id" INTEGER PRIMARY KEY,
        "level" INTEGER, "theme" TEXT, "mode" TEXT,
        "ec_kind" TEXT, "ec_value" INTEGER, "pos" INTEGER,
        "source" TEXT, "seed" INTEGER, "speed" REAL, "keys" INTEGER, "mistakes" INTEGER,
        "accuracy" REAL, "correct" INTEGER, "correctCount" INTEGER, "words" INTEGER,
        "seconds" REAL, "date" TEXT, "seg_stats" TEXT
      )`)
      db.exec(`CREATE INDEX IF NOT EXISTS "word_records_group" ON "word_records"
        ("level","theme","mode","ec_kind","ec_value","pos")`)

      // 英英辞典クイズ記録（word_records と同形）。
      db.exec(`CREATE TABLE IF NOT EXISTS "dict_records"(
        "id" INTEGER PRIMARY KEY,
        "level" INTEGER, "theme" TEXT, "mode" TEXT,
        "ec_kind" TEXT, "ec_value" INTEGER, "pos" INTEGER,
        "source" TEXT, "seed" INTEGER, "speed" REAL, "keys" INTEGER, "mistakes" INTEGER,
        "accuracy" REAL, "correct" INTEGER, "correctCount" INTEGER, "words" INTEGER,
        "seconds" REAL, "date" TEXT, "seg_stats" TEXT
      )`)
      db.exec(`CREATE INDEX IF NOT EXISTS "dict_records_group" ON "dict_records"
        ("level","theme","mode","ec_kind","ec_value","pos")`)

      // 問題ごとの累積記録（フル関係テーブル）。id='type:mode:key'（key は ':' を含みうる）。
      db.exec(`CREATE TABLE IF NOT EXISTS "item_stats"(
        "id" TEXT PRIMARY KEY,
        "type" TEXT, "mode" TEXT, "item_key" TEXT,
        "count" INTEGER, "keys" INTEGER, "mistakes" INTEGER, "ms" INTEGER
      )`)

      // 物語の発見エンド（発見順＝id 昇順で保持）。
      db.exec(`CREATE TABLE IF NOT EXISTS "story_endings"(
        "id" INTEGER PRIMARY KEY,
        "story_id" TEXT, "ending_id" TEXT,
        UNIQUE("story_id","ending_id")
      )`)
      db.exec(`CREATE INDEX IF NOT EXISTS "story_endings_order" ON "story_endings"
        ("story_id","id")`)

      // 物語記録（storyId×終了条件別ランキング）。seed/level を持たず choices/segStats は JSON 列。
      db.exec(`CREATE TABLE IF NOT EXISTS "story_records"(
        "id" INTEGER PRIMARY KEY,
        "story_id" TEXT, "ec_kind" TEXT, "ec_value" INTEGER, "pos" INTEGER,
        "mode" TEXT, "source" TEXT, "ending" TEXT, "endLabel" TEXT,
        "speed" REAL, "keys" INTEGER, "mistakes" INTEGER, "accuracy" REAL,
        "seconds" REAL, "date" TEXT, "seg_stats" TEXT, "choices" TEXT
      )`)
      db.exec(`CREATE INDEX IF NOT EXISTS "story_records_group" ON "story_records"
        ("story_id","ec_kind","ec_value","pos")`)
    },
  },
  {
    // Phase（#362 単語固定範囲）：単語記録に固定範囲 range 列を足す（前方のみ＝version 1/2 は不変）。
    // nullable で、range 無し記録は NULL＝プロパティ省略＝従来キーと byte 同一（後方互換）。
    // dict_records は範囲を持たない（常に NULL）が、word/dict の写像を共通ファクトリで揃えるため両表に足す。
    version: 3,
    up(db) {
      db.exec('ALTER TABLE "word_records" ADD COLUMN "range" INTEGER')
      db.exec('ALTER TABLE "dict_records" ADD COLUMN "range" INTEGER')
    },
  },
]
