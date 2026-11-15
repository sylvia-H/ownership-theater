// 軌跡層與 rustc 一致：每頁的片段都驗過（verified.json），
// 而且軌跡規則（checkRust）擋下「弄壞它」的理由，和 rustc 回報的錯誤碼對得上。

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Verified } from '../core/page.ts';
import { breakRange, buildTimeline } from '../core/timeline.ts';
import type { BreakIt, Trace } from '../core/trace.ts';
import { checkRust } from '../core/worlds.ts';

const PAGES_DIR = dirname(fileURLToPath(import.meta.url));
const RERUN = '片段改過之後要重驗：npm run verify:rust';

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const readLf = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

interface TraceModule {
  trace: Trace;
  breakIt?: BreakIt | null;
}

const pageDirs = readdirSync(PAGES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(PAGES_DIR, d.name, 'expect.json')))
  .map((d) => d.name)
  .sort();

test('至少有一頁帶 expect.json', () => {
  assert.ok(pageDirs.length > 0);
});

for (const page of pageDirs) {
  const dir = join(PAGES_DIR, page);
  const expects = JSON.parse(readFileSync(join(dir, 'expect.json'), 'utf8')) as Record<string, string>;
  const verifiedPath = join(dir, 'verified.json');

  const loadVerified = (): Verified => {
    assert.ok(existsSync(verifiedPath), `${page}/verified.json 不存在。${RERUN}`);
    return JSON.parse(readFileSync(verifiedPath, 'utf8')) as Verified;
  };
  const loadTrace = async (): Promise<TraceModule> =>
    (await import(pathToFileURL(join(dir, 'trace.ts')).href)) as TraceModule;

  test(`${page}：verified.json 涵蓋每個片段，而且片段之後沒再改過`, () => {
    const verified = loadVerified();
    assert.ok(verified.rustc, 'verified.json 缺 rustc 版本');
    for (const [name, expect] of Object.entries(expects)) {
      const rec = verified.files[name];
      assert.ok(rec, `${page}/verified.json 沒有 ${name}。${RERUN}`);
      assert.equal(rec.expect, expect, `${page}/${name} 的期望改過了。${RERUN}`);
      assert.equal(rec.sha256, sha256(readLf(join(dir, name))), `${page}/${name} 的內容改過了。${RERUN}`);
    }
  });

  test(`${page}：rustc 的結果與 expect.json 相符`, () => {
    const verified = loadVerified();
    for (const [name, expect] of Object.entries(expects)) {
      const rec = verified.files[name];
      assert.ok(rec, `${page}/verified.json 沒有 ${name}。${RERUN}`);
      if (expect === 'pass') {
        assert.equal(rec.success, true, `${page}/${name} 應該編譯通過`);
        assert.equal(rec.message, '');
      } else if (expect === 'panic') {
        assert.equal(rec.success, false, `${page}/${name} 應該在執行時 panic`);
        assert.ok(rec.message.includes('panicked at'), `${page}/${name} 的 message 應該含 panicked at`);
      } else {
        assert.equal(rec.success, false, `${page}/${name} 應該編譯失敗`);
        assert.ok(rec.message.includes(`error[${expect}]`), `${page}/${name} 的 message 應該含 error[${expect}]`);
      }
    }
  });

  test(`${page}：軌跡合法，「弄壞它」被擋下的規則與 rustc 的錯誤碼對得上`, async () => {
    const { trace, breakIt } = await loadTrace();
    const tl = buildTimeline(trace);
    assert.equal(tl.steps, trace.steps.length);
    if (!breakIt) return;

    assert.equal(breakIt.expect, expects['broken.rs'], 'breakIt.expect 應該等於 expect.json 的 broken.rs');
    const range = breakRange(tl, breakIt);
    assert.ok(range, '整條軌跡沒有任何一步能「弄壞它」');
    for (let k = range.from; k <= range.to; k++) {
      assert.equal(
        checkRust(tl.rustStates[k]!, breakIt.attempt)?.rule,
        breakIt.rule,
        `做完前 ${k} 步時，嘗試應該被 ${breakIt.rule} 擋下`,
      );
    }
  });
}

test('01-move：值搬到 b 之後、a 離開 scope 之前，都可以「弄壞它」', async () => {
  const { trace, breakIt } = (await import('./01-move/trace.ts')) satisfies TraceModule;
  assert.deepEqual(breakRange(buildTimeline(trace), breakIt), { from: 2, to: 4 });
});
