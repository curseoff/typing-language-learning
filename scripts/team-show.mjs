// 稼働台帳（tmp/agent-status.tsv）の読み取り専用 CLI。本人が状況を確認する。
// 読み取りロジックはここに一本化し、statusline-team.sh はこれを呼ぶ薄いラッパにする。
// 出力: 先頭に turnSummary の1行 → 列を揃えた表（最終実行日の新しい順）。
//   状態マーク（絵文字は使わない）:
//     >  実行中/起動 ／ !  要承認/要判断/要対応 ／ -  完了 ／ .  その他
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTsv, turnSummary } from './team-ledger.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEDGER = join(HERE, '..', 'tmp', 'agent-status.tsv');

// 出力先が途中で閉じても（`| head` 等）落ちないように EPIPE を握りつぶす
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

// 表示幅（全角＝2・半角＝1）
function width(s) {
  let w = 0;
  for (const ch of String(s)) {
    // 全角の主要レンジ（CJK・かな・全角記号）を2幅とみなす
    w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch)
      ? 2
      : 1;
  }
  return w;
}

// 右側を空白で埋めて表示幅 target に揃える
function padEnd(s, target) {
  const pad = target - width(s);
  return s + (pad > 0 ? ' '.repeat(pad) : '');
}

// 状態から先頭マークを決める
function mark(status) {
  if (/実行中|起動/.test(status)) return '>';
  if (/要承認|要判断|要対応/.test(status)) return '!';
  if (/完了/.test(status)) return '-';
  return '.';
}

function main() {
  if (!existsSync(LEDGER)) {
    process.stdout.write('台帳なし（未稼働）\n');
    return;
  }
  const rows = parseTsv(readFileSync(LEDGER, 'utf8'));
  const summary = turnSummary(rows);
  process.stdout.write(summary.text + '\n');
  if (rows.length === 0) return;

  // 最終実行日の新しい順（ISO 文字列比較＝時系列一致）
  const sorted = [...rows].sort((a, b) =>
    String(b.lastRun).localeCompare(String(a.lastRun)),
  );

  // 列（マーク / エージェント / 最終実行 / 状態 / タスク・備考）
  const cells = sorted.map((r) => ({
    mark: mark(r.status),
    agent: r.agent,
    lastRun: r.lastRun,
    status: r.status,
    note: r.task,
  }));
  const wAgent = Math.max(...cells.map((c) => width(c.agent)), 5);
  const wDate = Math.max(...cells.map((c) => width(c.lastRun)), 8);
  const wStatus = Math.max(...cells.map((c) => width(c.status)), 4);
  for (const c of cells) {
    process.stdout.write(
      `${c.mark} ${padEnd(c.agent, wAgent)} ｜ ${padEnd(c.lastRun, wDate)} ｜ ${padEnd(c.status, wStatus)} ｜ ${c.note}\n`,
    );
  }
}

main();
