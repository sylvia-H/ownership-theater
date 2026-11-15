// LeetCode 對照區：每題的 Rust 版用 rustc 驗過（verified.json）、TS 版實際執行的輸出與 Rust 版逐字相同，
// 而且手寫的逐行對齊表（rows.ts）涵蓋兩邊解法的每一行。
//
// 這個檔案由 Node 直接執行，所以不能匯入 ?raw 或各題的 index.ts；用 fs 讀檔、動態 import rows.ts。

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Verified } from '../core/page.ts';
import { pages } from '../pages/index.ts';
import { extractSolution, SOLUTION_END, SOLUTION_START } from './extract.ts';
import { problems } from './index.ts';
import { LC_TAGS, type LcRow } from './types.ts';

const LC_DIR = dirname(fileURLToPath(import.meta.url));
const RERUN = '解法改過之後要重驗：npm run verify:rust -- lc/<資料夾名稱>';
const EXPECTED_SLUGS = ['two-sum', 'reverse-string', 'group-anagrams', 'reverse-linked-list', 'invert-binary-tree'];

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const lf = (text: string) => text.replace(/\r\n/g, '\n');
const readLf = (path: string) => lf(readFileSync(path, 'utf8'));
/** 字數：一個中文字、一個英文字母、一個標點都算一個字 */
const chars = (text: string) => [...text].length;

const problemDirs = readdirSync(LC_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(LC_DIR, d.name, 'expect.json')))
  .map((d) => d.name)
  .sort();

test('extractSolution：回傳兩個標記之間的文字', () => {
  const source = ['外殼', SOLUTION_START, '', 'fn a() {', '    b();', '}', '', SOLUTION_END, 'fn main() {}'].join('\r\n');
  assert.equal(extractSolution(source), 'fn a() {\n    b();\n}');
});

test('extractSolution：缺任何一個標記就 throw', () => {
  assert.throws(() => extractSolution('fn main() {}'));
  assert.throws(() => extractSolution(`${SOLUTION_START}\nfn a() {}`));
  assert.throws(() => extractSolution(`fn a() {}\n${SOLUTION_END}`));
  assert.throws(() => extractSolution(`${SOLUTION_END}\nfn a() {}\n${SOLUTION_START}`));
});

test('註冊表：五題依序、slug 不重複，而且與資料夾一一對應', () => {
  const slugs = problems.map((p) => p.slug);
  assert.deepEqual(slugs, EXPECTED_SLUGS);
  assert.equal(new Set(slugs).size, slugs.length);
  // 資料夾名稱是「兩位數序號-slug」，排序後就是閱讀順序
  assert.deepEqual(
    problemDirs.map((d) => d.replace(/^\d+-/, '')),
    slugs,
  );
  for (const p of problems) {
    assert.ok(Number.isInteger(p.number) && p.number > 0, `${p.slug} 的題號`);
    assert.ok(p.title, `${p.slug} 缺 title`);
    assert.ok(p.teaser && chars(p.teaser) <= 30, `${p.slug} 的 teaser 要在 30 字以內`);
  }
});

for (const name of problemDirs) {
  const dir = join(LC_DIR, name);
  const slug = name.replace(/^\d+-/, '');
  const rustPath = join(dir, 'solution.rs');
  const tsPath = join(dir, 'solution.ts');
  const verifiedPath = join(dir, 'verified.json');

  const loadRecord = () => {
    assert.ok(existsSync(verifiedPath), `${name}/verified.json 不存在。${RERUN}`);
    const verified = JSON.parse(readFileSync(verifiedPath, 'utf8')) as Verified;
    assert.ok(verified.rustc, 'verified.json 缺 rustc 版本');
    const rec = verified.files['solution.rs'];
    assert.ok(rec, `${name}/verified.json 沒有 solution.rs。${RERUN}`);
    return rec;
  };
  const loadRows = async (): Promise<LcRow[]> =>
    ((await import(pathToFileURL(join(dir, 'rows.ts')).href)) as { rows: LcRow[] }).rows;
  const lineCount = (path: string) => extractSolution(readFileSync(path, 'utf8')).split('\n').length;

  test(`${name}：rustc 驗過目前的 solution.rs，編譯通過且沒有 warning`, () => {
    const expects = JSON.parse(readFileSync(join(dir, 'expect.json'), 'utf8')) as Record<string, string>;
    assert.deepEqual(expects, { 'solution.rs': 'pass' });
    const rec = loadRecord();
    assert.equal(rec.sha256, sha256(readLf(rustPath)), `${name}/solution.rs 的內容改過了。${RERUN}`);
    assert.equal(rec.expect, 'pass');
    assert.equal(rec.success, true, `${name}/solution.rs 應該編譯通過並執行成功`);
    assert.ok(!rec.stderr.includes('warning'), `${name}/solution.rs 有 warning：\n${rec.stderr}`);
    assert.ok(rec.stdout.trim(), `${name}/solution.rs 應該印出測資的結果`);
  });

  test(`${name}：node solution.ts 的輸出與 Rust 版逐字相同`, () => {
    const rec = loadRecord();
    const stdout = execFileSync(process.execPath, [tsPath], { encoding: 'utf8' });
    assert.equal(lf(stdout), lf(rec.stdout));
  });

  test(`${name}：rows 涵蓋兩邊解法的每一行，各出現一次、行號遞增`, async () => {
    const rows = await loadRows();
    for (const side of ['ts', 'rust'] as const) {
      const total = lineCount(side === 'ts' ? tsPath : rustPath);
      const seen = rows.map((r) => r[side]).filter((n): n is number => n !== null);
      // 每一行各一次且遞增，等同於「恰好是 1..total」
      assert.deepEqual(
        seen,
        Array.from({ length: total }, (_, i) => i + 1),
        `${name} 的 ${side} 行號要恰好是 1 到 ${total}，不重複、不遺漏、不超出範圍`,
      );
    }
    for (const [i, row] of rows.entries()) {
      assert.ok(row.ts !== null || row.rust !== null, `${name} 第 ${i + 1} 列兩邊都是 null`);
    }
  });

  test(`${name}：有 tag 的列一定有 40 字以內的 note`, async () => {
    const rows = await loadRows();
    for (const [i, row] of rows.entries()) {
      const where = `${name} 第 ${i + 1} 列（ts ${row.ts}、rust ${row.rust}）`;
      if (row.rust === null) assert.equal(row.tag, undefined, `${where} 只有 TS，不該有 tag`);
      if (row.tag === undefined) {
        assert.equal(row.note, undefined, `${where} 沒有 tag，不該有 note`);
        continue;
      }
      assert.ok(Object.hasOwn(LC_TAGS, row.tag), `${where} 的 tag「${row.tag}」不在 LC_TAGS 裡`);
      assert.ok(row.note, `${where} 有 tag，要有 note`);
      assert.ok(chars(row.note) <= 40, `${where} 的 note 有 ${chars(row.note)} 字，上限 40`);
    }
  });

  test(`${name}：index.ts 的 slug、文案長度與 related，summary 的數字等於有 tag 的列數`, async () => {
    // 不能匯入 index.ts（它用了 ?raw），所以直接讀原始碼裡的字串常值。
    const source = readLf(join(dir, 'index.ts'));
    const str = (key: string) => new RegExp(`^  ${key}: '([^']*)',$`, 'm').exec(source)?.[1];
    const list = (key: string) => {
      const body = new RegExp(`^  ${key}: \\[([^\\]]*)\\],$`, 'm').exec(source)?.[1];
      assert.ok(body !== undefined, `${name}/index.ts 找不到 ${key}`);
      return [...body.matchAll(/'([^']*)'/g)].map((m) => m[1]!);
    };

    assert.equal(str('slug'), slug);
    assert.equal(str('url'), `https://leetcode.com/problems/${slug}/`);
    const entry = problems.find((p) => p.slug === slug);
    assert.equal(str('title'), entry?.title);
    assert.equal(new RegExp('^  number: (\\d+),$', 'm').exec(source)?.[1], String(entry?.number));

    const summary = str('summary');
    assert.ok(summary && chars(summary) <= 60, `${name} 的 summary 要在 60 字以內（目前 ${chars(summary ?? '')}）`);
    // summary 裡第一個阿拉伯數字就是「Rust 多出來幾處」，要等於有 tag 的列數
    const tagged = (await loadRows()).filter((r) => r.tag !== undefined).length;
    assert.equal(
      /\d+/.exec(summary)?.[0],
      String(tagged),
      `${name} 的 summary 第一個數字要等於有 tag 的列數（${tagged}）：${summary}`,
    );
    const lead = list('lead');
    assert.equal(lead.length, 2, `${name} 的 lead 要兩段`);
    for (const p of lead) assert.ok(chars(p) <= 80, `${name} 的 lead 每段 80 字以內（目前 ${chars(p)}）：${p}`);

    const related = list('related');
    assert.ok(related.length >= 1 && related.length <= 3, `${name} 的 related 要 1 到 3 個`);
    const known = new Set(pages.map((p) => p.slug));
    for (const r of related) assert.ok(known.has(r), `${name} 的 related「${r}」不是 src/pages/index.ts 裡的 slug`);
  });
}
