// 稼働台帳（tmp/agent-status.tsv）の pure core。
// TSV スナップショット（1行=1エージェント）を扱う純関数群。
// 副作用なし・非破壊。読み書き CLI（team-set.mjs / team-show.mjs）から利用する。

// 列定義（この順・タブ区切り・ヘッダ付き）
export const COLUMNS = [
  'agent',
  'lastRun',
  'status',
  'issue',
  'agentId',
  'branch',
  'task',
  'next',
];

// TSV テキストを {列名: 値} オブジェクトの配列にする。
// - 先頭行はヘッダ（COLUMNS 想定）として読み飛ばす。
// - 空行・空白のみの行は無視する。
// - 列数がヘッダに満たない行は空文字で補う。
export function parseTsv(text) {
  const lines = String(text ?? '').split('\n');
  const rows = [];
  let seenHeader = false;
  for (const line of lines) {
    if (line.trim() === '') continue; // 空行・空白のみは無視
    if (!seenHeader) {
      seenHeader = true; // 最初の非空行はヘッダ
      continue;
    }
    const cells = line.split('\t');
    const row = {};
    COLUMNS.forEach((col, i) => {
      row[col] = cells[i] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

// rows を TSV テキストに直列化する。
// - 先頭にヘッダ行、値は COLUMNS の順で並べる（オブジェクトのキー順に依存しない）。
// - 末尾は改行1つで終える。
export function serializeTsv(rows) {
  const header = COLUMNS.join('\t');
  const body = rows.map((row) =>
    COLUMNS.map((col) => (row[col] ?? '')).join('\t'),
  );
  return [header, ...body].join('\n') + '\n';
}

// agent をキーに1行を追加・更新する（非破壊）。
// - 既存なら patch の指定列だけ上書き、未指定列は保持。
// - 無ければ末尾に追加、未指定列は '-'。
export function upsertRow(rows, patch) {
  const idx = rows.findIndex((r) => r.agent === patch.agent);
  if (idx === -1) {
    const row = {};
    for (const col of COLUMNS) {
      row[col] = patch[col] ?? '-';
    }
    return [...rows, row];
  }
  return rows.map((row, i) => (i === idx ? { ...row, ...patch } : row));
}

// 指定 agent の行を除いた新配列を返す（非破壊）。
export function clearRow(rows, agent) {
  return rows.filter((r) => r.agent !== agent);
}

// 「誰の番か」を判定する。優先度: waiting > running > idle。
export function turnSummary(rows) {
  const statuses = rows.map((r) => String(r?.status ?? ''));
  if (statuses.some((s) => /要承認|要判断|要対応/.test(s))) {
    return { kind: 'waiting', text: '[要判断] あなたの確認・承認待ち' };
  }
  const running = statuses.filter((s) => /実行中|起動/.test(s)).length;
  if (running > 0) {
    return {
      kind: 'running',
      text: `[背景実行中] 完了待ち ${running}件（結果は司令塔が報告）`,
    };
  }
  return { kind: 'idle', text: '[あなたの番] 次の指示をどうぞ' };
}

// TSV セルとして安全な文字列にする。
// - タブ・改行・CR は半角スペースに置換。
// - null / undefined は '-'。
export function sanitize(value) {
  if (value == null) return '-';
  return String(value).replace(/[\t\r\n]/g, ' ');
}
