// 用真的 rustc（Rust Playground）驗證每頁的 Rust 片段，結果寫進該頁的 verified.json。
//
//   node scripts/verify-rust.mjs          只驗內容或期望有變的頁
//   node scripts/verify-rust.mjs --force  全部重驗
//   node scripts/verify-rust.mjs 02-copy-vs-move 05-shared-borrow
//                                         只處理指定的頁（src/pages 底下的資料夾名稱，可多個；可與 --force 並用）
//
// 指定頁時只讀寫那幾頁的檔案，不碰其他頁，所以可以多個行程同時各跑各的頁。
//
// 每頁的 expect.json：{ "檔名.rs": "pass" | "E0382" 之類的錯誤碼 | "panic" }
//   pass   編譯通過且執行成功
//   E0382  編譯失敗，stderr 含 error[E0382]
//   panic  編譯通過，但執行時 panic

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'pages');
const PLAYGROUND = 'https://play.rust-lang.org';
const USER_AGENT = 'ownership-theater-verify';
/** 請求之間的間隔（毫秒）；逐一送，不並行 */
const GAP_MS = 1000;
const TIMEOUT_MS = 60_000;

const args = process.argv.slice(2);
const force = args.includes('--force');
const unknownFlags = args.filter((a) => a.startsWith('--') && a !== '--force');
/** 位置參數：指定要處理的頁；空的就是全部 */
const requested = [...new Set(args.filter((a) => !a.startsWith('--')))];

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const readLf = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

let lastRequestAt = 0;
async function request(path, init = {}) {
  const wait = lastRequestAt + GAP_MS - Date.now();
  if (lastRequestAt && wait > 0) await new Promise((r) => setTimeout(r, wait));
  try {
    const res = await fetch(PLAYGROUND + path, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`${path} 回應 HTTP ${res.status}`);
    return await res.json();
  } finally {
    lastRequestAt = Date.now();
  }
}

const compile = (code) =>
  request('/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: 'stable',
      mode: 'debug',
      edition: '2021',
      crateType: 'bin',
      tests: false,
      code,
      backtrace: false,
    }),
  });

let rustcVersion = null;
async function rustc() {
  if (rustcVersion === null) {
    const meta = await request('/meta/versions');
    const version = meta?.stable?.rustc?.version;
    if (typeof version !== 'string' || !version) throw new Error('/meta/versions 沒有 stable.rustc.version');
    rustcVersion = version;
  }
  return rustcVersion;
}

const STOP = ['warning:', 'For more information', 'error: could not compile', 'error: aborting'];

/** stderr 裡的 error 區塊原文；沒有 error 就是空字串 */
function errorBlock(stderr) {
  const lines = stderr.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.startsWith('error'));
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (STOP.some((p) => lines[i].startsWith(p))) {
      end = i;
      break;
    }
  }
  const block = lines.slice(start, end);
  while (block.length && block[block.length - 1].trim() === '') block.pop();
  return block.join('\n');
}

const stderrLines = (stderr) => stderr.replace(/\r\n/g, '\n').split('\n');

/** stderr 裡有編譯錯誤行（error[...] 或 error: 開頭） */
const hasCompileError = (stderr) => stderrLines(stderr).some((l) => l.startsWith('error[') || l.startsWith('error:'));

/** panic 的原文：從含 panicked at 的那一行，到 note: run with 那一行之前；沒有 panic 就是空字串 */
function panicBlock(stderr) {
  const lines = stderrLines(stderr);
  const start = lines.findIndex((l) => l.includes('panicked at'));
  if (start < 0) return '';
  const note = lines.findIndex((l, i) => i > start && l.startsWith('note: run with'));
  const block = lines.slice(start, note < 0 ? lines.length : note);
  while (block.length && block[block.length - 1].trim() === '') block.pop();
  return block.join('\n');
}

function matches(expect, res) {
  if (expect === 'pass') return res.success === true;
  if (expect === 'panic')
    return res.success === false && res.stderr.includes('panicked at') && !hasCompileError(res.stderr);
  return res.success === false && res.stderr.includes(`error[${expect}]`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** 該頁每個檔案的 sha256 與期望都和上次驗證時相同 */
function upToDate(prev, items) {
  const files = prev?.files;
  if (!files || typeof files !== 'object') return false;
  if (Object.keys(files).length !== items.length) return false;
  return items.every((it) => files[it.name]?.sha256 === it.sha256 && files[it.name]?.expect === it.expect);
}

async function verifyPage(page) {
  const dir = join(PAGES_DIR, page);
  const expects = JSON.parse(readFileSync(join(dir, 'expect.json'), 'utf8'));
  const items = Object.entries(expects).map(([name, expect]) => {
    const code = readLf(join(dir, name));
    return { name, expect, code, sha256: sha256(code) };
  });
  const outPath = join(dir, 'verified.json');

  if (!force && upToDate(readJson(outPath), items)) {
    for (const it of items) console.log(`略過  ${page}/${it.name}（內容與期望都沒變）`);
    return true;
  }

  // 同一頁共用一組 rustc 版本與檢查時間，所以只要有一個檔案變了就整頁重驗。
  const version = await rustc();
  const files = {};
  let ok = true;
  for (const it of items) {
    const res = await compile(it.code);
    const stdout = String(res.stdout ?? '');
    const stderr = String(res.stderr ?? '');
    const success = res.success === true;
    if (matches(it.expect, { success, stderr })) {
      console.log(`通過  ${page}/${it.name}（期望 ${it.expect}，rustc ${version}）`);
    } else {
      ok = false;
      console.error(`失敗  ${page}/${it.name}`);
      console.error(`  期望：${it.expect}`);
      console.error(`  實際：success=${success}，stderr 如下`);
      console.error(stderr.replace(/^/gm, '    '));
    }
    files[it.name] = {
      sha256: it.sha256,
      expect: it.expect,
      success,
      message: success ? '' : it.expect === 'panic' ? panicBlock(stderr) : errorBlock(stderr),
      stdout,
      stderr,
    };
  }

  if (!ok) {
    console.error(`${page}：與期望不符，沒有寫入 verified.json`);
    return false;
  }
  const verified = { rustc: version, checkedAt: new Date().toISOString(), files };
  writeFileSync(outPath, JSON.stringify(verified, null, 2) + '\n', 'utf8');
  return true;
}

/** 要處理的頁；指定了就只看那幾頁（不列舉、不讀其他頁），參數有問題回傳 null */
function selectPages() {
  if (unknownFlags.length) {
    console.error(`不認得的選項：${unknownFlags.join(' ')}（只支援 --force）`);
    return null;
  }
  if (!requested.length) {
    return readdirSync(PAGES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(PAGES_DIR, d.name, 'expect.json')))
      .map((d) => d.name)
      .sort();
  }
  let bad = false;
  for (const name of requested) {
    if (name === '.' || name === '..' || /[\\/]/.test(name)) {
      console.error(`${name}：要給 src/pages 底下的資料夾名稱，不是路徑`);
      bad = true;
    } else if (!existsSync(join(PAGES_DIR, name)) || !statSync(join(PAGES_DIR, name)).isDirectory()) {
      console.error(`${name}：src/pages 底下沒有這個資料夾`);
      bad = true;
    } else if (!existsSync(join(PAGES_DIR, name, 'expect.json'))) {
      console.error(`${name}：沒有 expect.json`);
      bad = true;
    }
  }
  return bad ? null : [...requested].sort();
}

const selected = selectPages();
const pages = selected ?? [];
let failed = selected === null;
for (const page of pages) {
  try {
    if (!(await verifyPage(page))) failed = true;
  } catch (err) {
    failed = true;
    console.error(`失敗  ${page}：${err instanceof Error ? err.message : String(err)}`);
  }
}
if (selected && !pages.length) console.log('src/pages 底下沒有任何 expect.json');
process.exitCode = failed ? 1 : 0;
