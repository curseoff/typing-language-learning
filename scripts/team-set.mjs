// 稼働台帳（tmp/agent-status.tsv）への書き込み専用 CLI。AI（司令塔・各役）が委任のたびに呼ぶ。
// 使い方:
//   node scripts/team-set.mjs --agent <名> [--status ..] [--task ..] [--issue ..]
//     [--agent-id ..] [--branch ..] [--next ..]
//   node scripts/team-set.mjs --agent <名> --clear      # 行を削除
// lastRun は自動で現在時刻（YYYY-MM-DD HH:MM:SS ローカル時刻）を入れる。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTsv, serializeTsv, upsertRow, clearRow, sanitize } from './team-ledger.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEDGER = join(HERE, '..', 'tmp', 'agent-status.tsv');

const USAGE = `使い方: node scripts/team-set.mjs --agent <名> [--status ..] [--task ..] \
[--issue ..] [--agent-id ..] [--branch ..] [--next ..]
       node scripts/team-set.mjs --agent <名> --clear`;

// --key value / --clear（フラグ）を素朴にパース
function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'clear') {
      opts.clear = true;
      continue;
    }
    opts[key] = argv[++i];
  }
  return opts;
}

// 現在時刻を YYYY-MM-DD HH:MM:SS（ローカル）で返す
function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const agent = opts.agent;
  if (!agent) {
    process.stderr.write('エラー: --agent は必須です。\n' + USAGE + '\n');
    process.exit(1);
  }

  const rows = existsSync(LEDGER) ? parseTsv(readFileSync(LEDGER, 'utf8')) : [];

  let next;
  if (opts.clear) {
    next = clearRow(rows, agent);
  } else {
    // CLI オプション名 → 列名（agent-id → agentId）
    const patch = { agent: sanitize(agent), lastRun: nowStamp() };
    const map = {
      status: 'status',
      task: 'task',
      issue: 'issue',
      'agent-id': 'agentId',
      branch: 'branch',
      next: 'next',
    };
    for (const [cli, col] of Object.entries(map)) {
      if (opts[cli] != null) patch[col] = sanitize(opts[cli]);
    }
    next = upsertRow(rows, patch);
  }

  mkdirSync(dirname(LEDGER), { recursive: true });
  writeFileSync(LEDGER, serializeTsv(next));
}

main();
