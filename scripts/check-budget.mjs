// 首屏體積檢查：npm run build 的最後一步。
// 只算 dist/index.html 直接引用的檔案（script、modulepreload、stylesheet），
// 動態載入的 chunk 不在首屏，不計入。
// 用法：node scripts/check-budget.mjs [dist 目錄]

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = { js: 200, css: 15 };
const LABEL = { js: 'JS', css: 'CSS' };

const distDir = resolve(process.argv[2] ?? 'dist');
const htmlPath = resolve(distDir, 'index.html');

if (!existsSync(htmlPath)) {
  console.error(`找不到 ${htmlPath}，先跑 vite build。`);
  process.exit(1);
}

const html = readFileSync(htmlPath, 'utf8').replace(/<!--[\s\S]*?-->/g, '');

/** 取出標籤的屬性（值可用雙引號、單引號或不加引號）。 */
function attrs(tag) {
  const out = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  const body = tag.replace(/^<\w+/, '').replace(/\/?>$/, '');
  for (const m of body.matchAll(re)) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

/** 首屏引用的檔案：kind → 去重後的相對路徑。 */
const refs = { js: new Set(), css: new Set() };

for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
  const { src } = attrs(tag);
  if (src) refs.js.add(src);
}
for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
  const { rel = '', href } = attrs(tag);
  if (!href) continue;
  const rels = rel.toLowerCase().split(/\s+/);
  if (rels.includes('modulepreload')) refs.js.add(href);
  else if (rels.includes('stylesheet')) refs.css.add(href);
}

/** 把 HTML 裡的網址換成 dist 內的檔案路徑；外部網址回傳 null。 */
function toFile(url) {
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url) || /^data:/i.test(url)) return null;
  const clean = decodeURIComponent(url.split(/[?#]/)[0]);
  return clean.startsWith('/')
    ? resolve(distDir, `.${clean}`)
    : resolve(dirname(htmlPath), clean);
}

const kb = (bytes) => (bytes / 1024).toFixed(1);
const problems = [];
const totals = {};

for (const kind of ['js', 'css']) {
  let raw = 0;
  let gz = 0;
  const rows = [];
  for (const url of refs[kind]) {
    const file = toFile(url);
    if (file === null) {
      rows.push(`  ${url}  （外部網址，不計入）`);
      continue;
    }
    if (!existsSync(file)) {
      problems.push(`index.html 引用的 ${url} 不在 ${distDir} 裡。`);
      continue;
    }
    const buf = readFileSync(file);
    const gzSize = gzipSync(buf).length;
    raw += buf.length;
    gz += gzSize;
    rows.push(`  ${url}  原始 ${kb(buf.length)} KB，gzip ${kb(gzSize)} KB`);
  }
  totals[kind] = gz;
  console.log(`首屏 ${LABEL[kind]}（${rows.length} 個檔案）`);
  for (const row of rows) console.log(row);
  console.log(
    `  合計  原始 ${kb(raw)} KB，gzip ${kb(gz)} KB（上限 ${BUDGET_KB[kind]} KB）\n`,
  );
}

for (const kind of ['js', 'css']) {
  const limit = BUDGET_KB[kind] * 1024;
  if (totals[kind] > limit) {
    problems.push(
      `首屏 ${LABEL[kind]} gzip ${kb(totals[kind])} KB，超過上限 ${BUDGET_KB[kind]} KB，多了 ${kb(totals[kind] - limit)} KB。`,
    );
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(`未通過：${p}`);
  process.exit(1);
}
console.log('首屏體積在預算內。');
