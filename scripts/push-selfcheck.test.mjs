// push 前自己点検（scripts/push-selfcheck.mjs）の振る舞いテスト。
// 本体は import 時に process.exit する CLI なので、使い捨ての git リポジトリを作って
// 子プロセスとして起動し「終了コードと出力」で検証する（＝実際の使われ方と同じ経路）。
//
// ここで固定したいのは主に 2 点:
//   1. 本物の秘密情報・個人情報を取りこぼさない（リリース経路の最後の砦）
//   2. 教材コンテンツを走査対象に含めても誤検知しない（release.mjs の点検をここへ一本化したため）
//
// 実行: node --test scripts/push-selfcheck.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'push-selfcheck.mjs');

// 使い捨てリポジトリを作り、base コミット（空）→ files を追加コミット、という形にする。
// push-selfcheck は <base>..HEAD の「追加行」を見るので、この形で差分を作れる。
function withRepo(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'push-selfcheck-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  try {
    git('init', '-q', '-b', 'main');
    // 本人識別子の照合は git config 由来。テストが実行環境の氏名に左右されないよう固定する。
    git('config', 'user.name', 'Test Runner');
    git('config', 'user.email', 'runner@example.com');
    git('commit', '-q', '--allow-empty', '-m', 'base');
    const base = git('rev-parse', 'HEAD').trim();

    for (const [name, body] of Object.entries(files)) {
      const p = join(dir, name);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, body);
    }
    git('add', '-A');
    // ファイル無しのケース（差分ゼロの確認）でも commit を成立させる
    git('commit', '-q', '--allow-empty', '-m', 'change');

    let status = 0;
    let output = '';
    try {
      output = execFileSync('node', [SCRIPT, '--base', base, '--verbose'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        // 実行環境の PUSH_SELFCHECK_IDENTIFIERS に左右されないようにする
        env: { ...process.env, PUSH_SELFCHECK_IDENTIFIERS: '' },
      });
    } catch (e) {
      status = e.status;
      output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }
    return fn({ status, output });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- 検出できること -------------------------------------------------------

// 「値付きの代入」は本物の漏えいの典型。ここが壊れるとリリース経路の点検が無意味になる。
test('引用符付きリテラルを代入した token は検出する', () => {
  withRepo({ 'src/a.js': 'const token = "abcdefgh12345678"\n' }, ({ status, output }) => {
    assert.equal(status, 1);
    assert.match(output, /認証情報らしき代入/);
    assert.match(output, /src\/a\.js/);
  });
});

test('各種プロバイダのトークン形式を検出する', () => {
  const cases = {
    'GitHub トークン': 'ghp_' + 'A'.repeat(36),
    'AWS アクセスキー': 'AKIA' + 'B'.repeat(16),
    'OpenAI 風トークン': 'sk-' + 'c'.repeat(32),
    'Google API キー': 'AIza' + 'd'.repeat(35),
  };
  for (const [name, value] of Object.entries(cases)) {
    withRepo({ 'src/a.js': `const v = '${value}'\n` }, ({ status, output }) => {
      assert.equal(status, 1, `${name} が検出されていない`);
      assert.match(output, new RegExp(name));
    });
  }
});

test('秘密鍵ブロックと鍵ファイル名を検出する', () => {
  withRepo({ 'deploy.pem': '-----BEGIN RSA PRIVATE KEY-----\n' }, ({ status, output }) => {
    assert.equal(status, 1);
    assert.match(output, /証明書\/鍵ファイル/);
    assert.match(output, /秘密鍵ブロック/);
  });
});

test('絶対パスでの username 露出を検出する', () => {
  withRepo({ 'docs/x.md': 'cd /Users/someone/work\n' }, ({ status, output }) => {
    assert.equal(status, 1);
    assert.match(output, /絶対パス/);
  });
});

// 出力がログに残ることを踏まえ、検出した値そのものは伏せ字であること。
test('--verbose でも検出値は伏せ字にする', () => {
  withRepo({ 'src/a.js': 'const token = "supersecretvalue"\n' }, ({ status, output }) => {
    assert.equal(status, 1);
    assert.doesNotMatch(output, /supersecretvalue/);
  });
});

// --- 誤検知しないこと -----------------------------------------------------

// release.mjs の旧実装はこの手の行（token/secret が語として現れるだけ）を弾いてリリースを止めていた。
test('環境変数参照やプレースホルダは検出しない', () => {
  const body = [
    'const token = process.env.GITHUB_TOKEN',
    'const apiKey = `${import.meta.env.VITE_KEY}`',
    'const password = "<your-password>"',
    '// env -u GITHUB_TOKEN gh pr create',
    'run: env -u GITHUB_TOKEN gh release create',
  ].join('\n');
  withRepo({ 'src/a.js': body + '\n' }, ({ status, output }) => {
    assert.equal(status, 0, output);
    assert.match(output, /自己点検クリア/);
  });
});

// 教材コンテンツは release.mjs でかつて丸ごと除外していた対象。除外をやめた（＝走査する）ので、
// 見出し語や英文が誤検知を起こさないことを固定しておく。
test('教材コンテンツの見出し語や英文は誤検知しない', () => {
  const ndjson = [
    JSON.stringify({ word: 'token', gloss: 'a thing used to represent something else' }),
    JSON.stringify({ word: 'secret', gloss: 'something kept hidden from others' }),
    JSON.stringify({ word: 'password', gloss: 'a word you use to prove who you are' }),
    JSON.stringify({ word: 'key', gloss: 'a small piece of metal that opens a lock' }),
  ].join('\n');
  const data = [
    "export const words = [",
    "  { word: 'token', kana: 'とーくん' },",
    "  { word: 'secret', kana: 'しーくれっと' },",
    "]",
  ].join('\n');
  withRepo(
    { 'content/words.ndjson': ndjson + '\n', 'src/content/wordsData.js': data + '\n' },
    ({ status, output }) => {
      assert.equal(status, 0, output);
    },
  );
});

// リリース時は 10 万行規模の教材差分を走査しうる。maxBuffer 不足や極端な遅さで落ちないこと。
test('大量の教材行を走査してもクリアで完走する', () => {
  const lines = [];
  for (let i = 0; i < 20000; i++) {
    lines.push(JSON.stringify({ word: `word${i}`, gloss: `the meaning of word ${i} is a token of something` }));
  }
  withRepo({ 'content/big.ndjson': lines.join('\n') + '\n' }, ({ status, output }) => {
    assert.equal(status, 0, output);
    assert.match(output, /自己点検クリア/);
  });
});

// --- 走査範囲 -------------------------------------------------------------

test('差分ゼロならクリアで終わる', () => {
  withRepo({}, ({ status, output }) => {
    assert.equal(status, 0);
    assert.match(output, /走査対象なし/);
  });
});
