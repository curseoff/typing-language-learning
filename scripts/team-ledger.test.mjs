// 稼働台帳（tmp/agent-status.md 相当の TSV 台帳）pure core の仕様テスト（Red）
// テスト先行（TDD）: 実装本体 scripts/team-ledger.mjs はまだ存在しない。
// ここでは「振る舞い」（列定義・パース/直列化の往復・upsert の保持と非破壊・
// clearRow の非破壊・turnSummary の優先度判定・sanitize の無害化）を固定する。
// 実行: node --test scripts/team-ledger.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COLUMNS,
  parseTsv,
  serializeTsv,
  upsertRow,
  clearRow,
  turnSummary,
  sanitize,
} from './team-ledger.mjs';

// --- COLUMNS ---------------------------------------------------------------

test('COLUMNS は定義順・内容どおりの列名配列である', () => {
  assert.deepEqual(COLUMNS, [
    'agent',
    'lastRun',
    'status',
    'issue',
    'agentId',
    'branch',
    'task',
    'next',
  ]);
});

// --- parseTsv --------------------------------------------------------------

test('parseTsv はヘッダ行を使い各行を {列名: 値} オブジェクトの配列にする', () => {
  const text = [
    'agent\tlastRun\tstatus\tissue\tagentId\tbranch\ttask\tnext',
    'coder\t2026-07-05 10:00:00\t実行中\t#226\ta1\tfeature/x\t実装\tレビュー',
  ].join('\n');
  const rows = parseTsv(text);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    agent: 'coder',
    lastRun: '2026-07-05 10:00:00',
    status: '実行中',
    issue: '#226',
    agentId: 'a1',
    branch: 'feature/x',
    task: '実装',
    next: 'レビュー',
  });
});

test('parseTsv は末尾改行と空行を無視する', () => {
  const text = [
    'agent\tlastRun\tstatus\tissue\tagentId\tbranch\ttask\tnext',
    'coder\t-\t完了\t-\t-\t-\t-\t-',
    '',
    'planner\t-\t待機\t-\t-\t-\t-\t-',
    '',
    '',
  ].join('\n');
  const rows = parseTsv(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].agent, 'coder');
  assert.equal(rows[1].agent, 'planner');
});

test('parseTsv は空文字・空白のみの入力に対して空配列を返す', () => {
  assert.deepEqual(parseTsv(''), []);
  assert.deepEqual(parseTsv('   \n  \n'), []);
});

test('parseTsv は列数がヘッダに満たない行を空文字で補う', () => {
  const text = [
    'agent\tlastRun\tstatus\tissue\tagentId\tbranch\ttask\tnext',
    'coder\t2026-07-05 10:00:00\t実行中', // 3 列しかない
  ].join('\n');
  const rows = parseTsv(text);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    agent: 'coder',
    lastRun: '2026-07-05 10:00:00',
    status: '実行中',
    issue: '',
    agentId: '',
    branch: '',
    task: '',
    next: '',
  });
});

// --- serializeTsv ----------------------------------------------------------

test('serializeTsv は先頭にヘッダ行を置き末尾を改行1つで終える', () => {
  const out = serializeTsv([
    {
      agent: 'coder',
      lastRun: '-',
      status: '完了',
      issue: '-',
      agentId: '-',
      branch: '-',
      task: '-',
      next: '-',
    },
  ]);
  const lines = out.split('\n');
  // 末尾は改行1つ（split 後の最後の要素は空文字）
  assert.equal(lines.at(-1), '');
  assert.equal(lines[0], COLUMNS.join('\t'));
  assert.equal(lines[1], 'coder\t-\t完了\t-\t-\t-\t-\t-');
  // 末尾改行が二重にならない
  assert.ok(!out.endsWith('\n\n'));
});

test('serializeTsv は COLUMNS の順で値を並べる（オブジェクトのキー順に依存しない）', () => {
  const out = serializeTsv([
    // 敢えて宣言順を崩す
    {
      next: 'レビュー',
      task: '実装',
      agent: 'coder',
      status: '実行中',
      lastRun: 't',
      issue: '#1',
      agentId: 'a1',
      branch: 'b1',
    },
  ]);
  const row = out.split('\n')[1];
  assert.equal(row, 'coder\tt\t実行中\t#1\ta1\tb1\t実装\tレビュー');
});

test('parseTsv(serializeTsv(rows)) は元 rows と往復一致する（round-trip）', () => {
  const rows = [
    {
      agent: 'coder',
      lastRun: '2026-07-05 10:00:00',
      status: '実行中',
      issue: '#226',
      agentId: 'a1',
      branch: 'feature/x',
      task: '実装',
      next: 'レビュー',
    },
    {
      agent: 'planner',
      lastRun: '2026-07-05 09:00:00',
      status: '完了',
      issue: '-',
      agentId: 'a2',
      branch: '-',
      task: '企画',
      next: '-',
    },
  ];
  assert.deepEqual(parseTsv(serializeTsv(rows)), rows);
});

// --- upsertRow -------------------------------------------------------------

test('upsertRow は新規 agent を末尾に追加し未指定列を "-" で埋める', () => {
  const rows = [];
  const out = upsertRow(rows, { agent: 'coder', status: '実行中' });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], {
    agent: 'coder',
    lastRun: '-',
    status: '実行中',
    issue: '-',
    agentId: '-',
    branch: '-',
    task: '-',
    next: '-',
  });
});

test('upsertRow は既存 agent の指定列だけ上書きし他列を保持する', () => {
  const rows = [
    {
      agent: 'coder',
      lastRun: 't0',
      status: '実行中',
      issue: '#226',
      agentId: 'a1',
      branch: 'feature/x',
      task: '実装中',
      next: 'レビュー',
    },
  ];
  const out = upsertRow(rows, { agent: 'coder', status: '完了' });
  assert.equal(out.length, 1);
  assert.equal(out[0].status, '完了');
  // 指定していない列は保持される
  assert.equal(out[0].task, '実装中');
  assert.equal(out[0].issue, '#226');
  assert.equal(out[0].branch, 'feature/x');
  assert.equal(out[0].next, 'レビュー');
});

test('upsertRow は既存更新で行数を増やさず順序も変えない', () => {
  const rows = [
    { agent: 'coder', lastRun: '-', status: '実行中', issue: '-', agentId: '-', branch: '-', task: '-', next: '-' },
    { agent: 'planner', lastRun: '-', status: '完了', issue: '-', agentId: '-', branch: '-', task: '-', next: '-' },
  ];
  const out = upsertRow(rows, { agent: 'coder', status: '完了' });
  assert.equal(out.length, 2);
  assert.equal(out[0].agent, 'coder');
  assert.equal(out[1].agent, 'planner');
});

test('upsertRow は元配列とその要素を破壊しない（非破壊）', () => {
  const rows = [
    { agent: 'coder', lastRun: '-', status: '実行中', issue: '-', agentId: '-', branch: '-', task: '実装', next: '-' },
  ];
  const snapshot = JSON.parse(JSON.stringify(rows));
  const out = upsertRow(rows, { agent: 'coder', status: '完了' });
  // 呼び出し後も元 rows は不変
  assert.deepEqual(rows, snapshot);
  // 返り値は別配列
  assert.notEqual(out, rows);
});

// --- clearRow --------------------------------------------------------------

test('clearRow は指定 agent の行を除いた新配列を返す', () => {
  const rows = [
    { agent: 'coder', lastRun: '-', status: '完了', issue: '-', agentId: '-', branch: '-', task: '-', next: '-' },
    { agent: 'planner', lastRun: '-', status: '完了', issue: '-', agentId: '-', branch: '-', task: '-', next: '-' },
  ];
  const out = clearRow(rows, 'coder');
  assert.equal(out.length, 1);
  assert.equal(out[0].agent, 'planner');
});

test('clearRow は該当なしなら等価な配列を返し元配列を破壊しない', () => {
  const rows = [
    { agent: 'coder', lastRun: '-', status: '完了', issue: '-', agentId: '-', branch: '-', task: '-', next: '-' },
  ];
  const snapshot = JSON.parse(JSON.stringify(rows));
  const out = clearRow(rows, 'unknown');
  assert.deepEqual(out, rows);
  assert.deepEqual(rows, snapshot);
  assert.notEqual(out, rows);
});

// --- turnSummary -----------------------------------------------------------

test('turnSummary は要承認/要判断/要対応があれば waiting を最優先で返す', () => {
  const rows = [
    { agent: 'a', status: '実行中' },
    { agent: 'b', status: '要判断' }, // 実行中と混在でも waiting 優先
  ];
  const s = turnSummary(rows);
  assert.equal(s.kind, 'waiting');
  assert.ok(typeof s.text === 'string' && s.text.length > 0);
});

test('turnSummary は waiting が無く実行中/起動があれば running を返す', () => {
  const s = turnSummary([
    { agent: 'a', status: '完了' },
    { agent: 'b', status: '起動' },
  ]);
  assert.equal(s.kind, 'running');
  assert.ok(typeof s.text === 'string' && s.text.length > 0);
});

test('turnSummary は待ちも実行中も無ければ idle を返す', () => {
  const s = turnSummary([
    { agent: 'a', status: '完了' },
    { agent: 'b', status: '待機' },
  ]);
  assert.equal(s.kind, 'idle');
  assert.ok(typeof s.text === 'string' && s.text.length > 0);
});

test('turnSummary は空配列なら idle を返す', () => {
  assert.equal(turnSummary([]).kind, 'idle');
});

// --- sanitize --------------------------------------------------------------

test('sanitize はタブ・改行を半角スペースに置換する', () => {
  assert.equal(sanitize('a\tb'), 'a b');
  assert.equal(sanitize('a\nb'), 'a b');
  assert.equal(sanitize('a\tb\nc'), 'a b c');
});

test('sanitize は null / undefined を "-" にする', () => {
  assert.equal(sanitize(null), '-');
  assert.equal(sanitize(undefined), '-');
});
