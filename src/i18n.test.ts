// 英文版的內容與中文原文對得上：每頁的字幕數、「弄壞它」的有無、LeetCode 註記的鍵、首頁用的標題對照表、
// 介面字典兩邊的鍵、英文版程式碼片段的行數，而且英文內容裡沒有中日韓字元。
//
// 這個檔案由 Node 直接執行，所以不能匯入 .tsx、?raw 或各頁的 index.ts；用 fs 讀檔、動態 import 純資料的檔案。

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { localizeLabel, localizePage } from './core/localize.ts';
import type { Page, PageEn } from './core/page.ts';
import { buildTimeline, rustCountId, stateAt } from './core/timeline.ts';
import type { BreakIt, Trace } from './core/trace.ts';
import { problems } from './lc/index.ts';
import { LC_TAGS_EN } from './lc/tags.en.ts';
import { TEASERS_EN } from './lc/teasers.en.ts';
import { LC_TAGS, type LcEn, type LcRow } from './lc/types.ts';
import { pages } from './pages/index.ts';
import { TITLES_EN } from './pages/titles.en.ts';
import { HOME_EN } from './ui/home.en.ts';
import { HOME_ZH } from './ui/home.zh.ts';
import { splitInlineCode, stripInlineCode } from './ui/inline.ts';
import { buildIntroTrace, INTRO_STEPS } from './ui/intro.ts';
import { langFromHash, pickLang, siteName, stripLangFromHash } from './ui/lang.ts';
import { sections } from './ui/sections.ts';
import { STRINGS } from './ui/strings.ts';

const SRC = dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = join(SRC, 'pages');
const LC_DIR = join(SRC, 'lc');

/** 中日韓字元：部首、注音、假名、漢字、相容漢字，以及全形標點與全形英數 */
const CJK = /[⺀-鿿豈-﫿︰-﹏＀-￯]/;

const lf = (text: string) => text.replace(/\r\n/g, '\n');
const load = async <T>(path: string): Promise<T> => (await import(pathToFileURL(path).href)) as T;

/** 物件裡所有的字串（含巢狀與陣列）；函式用給定的參數呼叫一次，取它的回傳值 */
function strings(value: unknown, path = ''): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }];
  if (typeof value === 'function') {
    const args = Array.from({ length: (value as (...a: unknown[]) => unknown).length }, (_, i) => i + 2);
    return strings((value as (...a: unknown[]) => unknown)(...args), `${path}()`);
  }
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

/** 物件的形狀：每個葉節點的路徑與型別（陣列看長度），用來比對兩個語言的鍵是否完全相同 */
function shape(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return [`${path}[${value.length}]`, ...value.flatMap((v, i) => shape(v, `${path}[${i}]`))];
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
  }
  return [`${path}:${typeof value}`];
}

function assertEnglish(value: unknown, where: string): void {
  for (const { path, text } of strings(value)) {
    assert.ok(!CJK.test(text), `${where} 的 ${path} 含中日韓字元：${text}`);
    assert.equal((text.match(/`/g) ?? []).length % 2, 0, `${where} 的 ${path} 的反引號沒有成對：${text}`);
  }
}

const dirsWith = (root: string, file: string) =>
  readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, file)))
    .map((d) => d.name)
    .sort();

const slugOf = (dir: string) => dir.replace(/^\d+-/, '');

// ── 行內程式碼 ─────────────────────────────

test('splitInlineCode：成對的反引號之間是程式碼，其餘是一般文字', () => {
  assert.deepEqual(splitInlineCode('plain text'), [{ text: 'plain text', code: false }]);
  assert.deepEqual(splitInlineCode('The claw `a` holds it.'), [
    { text: 'The claw ', code: false },
    { text: 'a', code: true },
    { text: ' holds it.', code: false },
  ]);
  assert.deepEqual(splitInlineCode('`b` moves to `a`'), [
    { text: 'b', code: true },
    { text: ' moves to ', code: false },
    { text: 'a', code: true },
  ]);
  // 中文也適用；程式碼裡的空白與符號原樣保留
  assert.deepEqual(splitInlineCode('`let b = a;` 之後再用 `a`'), [
    { text: 'let b = a;', code: true },
    { text: ' 之後再用 ', code: false },
    { text: 'a', code: true },
  ]);
});

test('splitInlineCode：落單的反引號照原樣顯示，空的程式碼略過，不處理其他 markdown', () => {
  assert.deepEqual(splitInlineCode(''), []);
  assert.deepEqual(splitInlineCode('a ` b'), [{ text: 'a ` b', code: false }]);
  assert.deepEqual(splitInlineCode('`a` and ` b'), [
    { text: 'a', code: true },
    { text: ' and ` b', code: false },
  ]);
  assert.deepEqual(splitInlineCode('x `` y'), [
    { text: 'x ', code: false },
    { text: ' y', code: false },
  ]);
  assert.deepEqual(splitInlineCode('**bold** _it_'), [{ text: '**bold** _it_', code: false }]);
});

test('stripInlineCode：去掉標記用的反引號，文字不變', () => {
  assert.equal(stripInlineCode('Using `a` after `let b = a;`'), 'Using a after let b = a;');
  assert.equal(stripInlineCode('no code'), 'no code');
});

// ── 語言狀態 ──────────────────────────────

test('pickLang：網址的 lang 參數 → 記住的選擇 → 瀏覽器語言', () => {
  assert.equal(pickLang('en', 'zh', 'zh-TW'), 'en');
  assert.equal(pickLang('zh', 'en', 'en-US'), 'zh');
  assert.equal(pickLang(null, 'en', 'zh-TW'), 'en');
  assert.equal(pickLang(null, 'zh', 'en-US'), 'zh');
  assert.equal(pickLang(null, null, 'zh-TW'), 'zh');
  assert.equal(pickLang(null, null, 'ZH-Hant'), 'zh');
  assert.equal(pickLang(null, null, 'en-US'), 'en');
  assert.equal(pickLang(null, null, 'ja'), 'en');
  assert.equal(pickLang(null, null, undefined), 'en');
  // 不認得的值當作沒有
  assert.equal(pickLang('fr', 'de', 'zh-TW'), 'zh');
});

test('langFromHash／stripLangFromHash：lang 與 t、tab 並存', () => {
  assert.equal(langFromHash('#/move?lang=en'), 'en');
  assert.equal(langFromHash('#/?lang=zh'), 'zh');
  assert.equal(langFromHash('#/move?t=2.5&lang=en'), 'en');
  assert.equal(langFromHash('#/move?t=2.5'), null);
  assert.equal(langFromHash('#/move?lang=fr'), null);
  assert.equal(langFromHash(''), null);

  assert.equal(stripLangFromHash('#/move?lang=en'), '#/move');
  assert.equal(stripLangFromHash('#/move?t=2.5&lang=en'), '#/move?t=2.5');
  assert.equal(stripLangFromHash('#/?lang=en&tab=lc'), '#/?tab=lc');
  assert.equal(stripLangFromHash('#/move'), '#/move');
});

test('網站名稱兩個語言各一個', () => {
  assert.equal(siteName('zh'), '所有權劇場');
  assert.equal(siteName('en'), 'Ownership Theater');
});

// ── 介面字典 ──────────────────────────────

test('介面字典：zh 與 en 的鍵完全相同，en 的值不含中日韓字元', () => {
  assert.deepEqual(shape(STRINGS.en), shape(STRINGS.zh));
  assertEnglish(STRINGS.en, 'STRINGS.en');
  assert.equal(STRINGS.en.stepOf(3, 7), 'Step 3 of 7');
  // 英文模式不顯示繁中譯本的連結
  assert.equal(STRINGS.en.bookZh, '');
});

test('首頁文字：中英的欄位完全相同，英文不含中日韓字元，每個分區都有名稱', () => {
  assert.deepEqual(shape(HOME_EN), shape(HOME_ZH));
  assertEnglish(HOME_EN, 'HOME_EN');
  assert.equal(HOME_EN.hero.title, siteName('en'));
  assert.equal(HOME_ZH.hero.title, siteName('zh'));
  for (const text of [HOME_EN, HOME_ZH]) {
    assert.deepEqual(Object.keys(text.sections).sort(), [...sections.map((s) => s.id), 'lc'].sort());
    assert.equal(text.intro.captions.length, INTRO_STEPS);
  }
});

test('首頁開場：軌跡依語言產生，標籤與字幕來自該語言的文字，事件相同', () => {
  const zh = buildIntroTrace(HOME_ZH.intro);
  const en = buildIntroTrace(HOME_EN.intro);
  assert.equal(zh.steps.length, INTRO_STEPS);
  assert.equal(en.steps.length, INTRO_STEPS);
  assert.deepEqual(zh.steps[0]!.rust[0], { type: 'alloc', value: 'v1', label: '值' });
  assert.deepEqual(en.steps[0]!.rust[0], { type: 'alloc', value: 'v1', label: 'value' });
  assert.deepEqual(en.steps.map((s) => s.caption), HOME_EN.intro.captions);
  assertEnglish(en, '英文的開場軌跡');
  // 除了標籤與字幕，兩個語言的軌跡一模一樣
  const bare = (trace: Trace) =>
    trace.steps.map((s) => ({ ...s, caption: null, js: s.js.map((e) => ({ ...e, label: '' })), rust: s.rust.map((e) => ({ ...e, label: '' })) }));
  assert.deepEqual(bare(en), bare(zh));
  assert.equal(buildTimeline(en).steps, INTRO_STEPS);
});

test('LeetCode 類別：英文版的鍵與順序和 LC_TAGS 相同，不含中日韓字元', () => {
  assert.deepEqual(Object.keys(LC_TAGS_EN), Object.keys(LC_TAGS));
  assertEnglish(LC_TAGS_EN, 'LC_TAGS_EN');
});

// ── 各頁的 en.ts ───────────────────────────

const pageDirs = dirsWith(PAGES_DIR, 'trace.ts');

test('每一頁都有 en.ts，資料夾與註冊表一一對應', () => {
  assert.deepEqual(pageDirs.map(slugOf), pages.map((p) => p.slug));
  for (const dir of pageDirs) assert.ok(existsSync(join(PAGES_DIR, dir, 'en.ts')), `${dir} 缺 en.ts`);
});

for (const dir of pageDirs) {
  test(`${dir}/en.ts：字幕數等於步數，「弄壞它」的有無與 trace.ts 一致，不含中日韓字元`, async () => {
    const { trace, breakIt } = await load<{ trace: Trace; breakIt?: BreakIt | null }>(join(PAGES_DIR, dir, 'trace.ts'));
    const en = (await load<{ default: PageEn }>(join(PAGES_DIR, dir, 'en.ts'))).default;

    assert.equal(en.captions.length, trace.steps.length, `${dir} 的英文字幕數要等於軌跡的步數`);
    for (const [i, cap] of en.captions.entries()) {
      assert.ok(cap.js && cap.rust, `${dir} 第 ${i + 1} 步的英文字幕兩邊都要有`);
    }
    assert.equal(en.breakIt !== undefined, !!breakIt, `${dir} 的 breakIt 有無要與 trace.ts 一致`);
    assert.ok(en.kicker && en.title, `${dir} 缺 kicker 或 title`);
    assert.ok(en.lead.length > 0, `${dir} 缺 lead`);
    assertEnglish(en, `${dir}/en.ts`);

    // labels 的鍵必須是軌跡裡真的出現過的標籤
    const used = new Set<string>();
    for (const step of trace.steps) {
      for (const ev of [...step.js, ...step.rust]) {
        if ('label' in ev && typeof ev.label === 'string') used.add(ev.label);
      }
    }
    for (const key of Object.keys(en.labels ?? {})) assert.ok(used.has(key), `${dir} 的 labels「${key}」不是軌跡裡的標籤`);
    // 沒有對照表的頁：軌跡裡不能有中文標籤（否則英文模式的舞台會出現中文）
    for (const label of used) {
      assert.ok(!CJK.test(localizeLabel(label, en.labels)), `${dir} 的舞台標籤「${label}」在英文模式下仍是中文，要寫進 labels`);
    }
  });
}

test('titles.en.ts：涵蓋註冊表的每個 slug，而且與各頁 en.ts 的 title 相同', async () => {
  assert.deepEqual(Object.keys(TITLES_EN), pages.map((p) => p.slug));
  for (const dir of pageDirs) {
    const en = (await load<{ default: PageEn }>(join(PAGES_DIR, dir, 'en.ts'))).default;
    assert.equal(TITLES_EN[slugOf(dir)], en.title, `${dir} 的英文標題在 titles.en.ts 與 en.ts 不一致`);
  }
});

// ── localizePage ──────────────────────────

test('localizePage：只換顯示的文字，軌跡事件、行號、verified 不變；有英文版片段就換程式碼', async () => {
  const { trace, breakIt } = await load<{ trace: Trace; breakIt: BreakIt }>(join(PAGES_DIR, '01-move', 'trace.ts'));
  const en = (await load<{ default: PageEn }>(join(PAGES_DIR, '01-move', 'en.ts'))).default;
  const verified = { rustc: '1.0.0', checkedAt: '', files: {} };
  const page: Page = {
    slug: 'move',
    kicker: '所有權',
    title: '標題',
    lead: ['說明'],
    book: { quote: ['q'], cite: 'c', url: 'u', urlZh: 'z' },
    rust: 'fn main() {} // 中文',
    ts: 'function main() {} // 中文',
    tsEn: 'function main() {} // english',
    trace,
    breakIt,
    verified,
  };
  const out = localizePage(page, en);

  assert.equal(out.kicker, en.kicker);
  assert.equal(out.title, en.title);
  assert.deepEqual(out.lead, en.lead);
  assert.deepEqual(out.trace.steps.map((s) => s.caption), en.captions);
  assert.equal(out.breakIt?.hint, en.breakIt?.hint);
  assert.equal(out.breakIt?.plain, en.breakIt?.plain);
  // 有英文版就用英文版，沒有就用原文
  assert.equal(out.ts, page.tsEn);
  assert.equal(out.rust, page.rust);

  // 軌跡事件是同一份、行號相同：用原本的 trace 建的時間軸可以繼續用
  for (const [i, step] of out.trace.steps.entries()) {
    const base = trace.steps[i]!;
    assert.equal(step.js, base.js);
    assert.equal(step.rust, base.rust);
    assert.equal(step.rustLine, base.rustLine);
    assert.equal(step.tsLine, base.tsLine);
  }
  assert.deepEqual({ ...out.breakIt, hint: '', plain: '' }, { ...breakIt, hint: '', plain: '' });
  assert.equal(out.verified, verified);
  assert.equal(out.book, page.book);
  // 原本的 page 沒有被改到
  assert.equal(page.title, '標題');
  assert.equal(trace.steps[0]!.caption.js, '一顆光球漂在空中，a 連一條線過去。');

  // 字幕數對不上就 throw，不默默錯位
  assert.throws(() => localizePage(page, { ...en, captions: en.captions.slice(1) }));
  // 沒有「弄壞它」的頁維持 null
  assert.equal(localizePage({ ...page, breakIt: null }, en).breakIt, null);
});

test('localizeLabel：照對照表換，表裡沒有的原樣回傳', () => {
  assert.equal(localizeLabel('值', { 值: 'value' }), 'value');
  assert.equal(localizeLabel('"hello"', { 值: 'value' }), '"hello"');
  assert.equal(localizeLabel('值', undefined), '值');
  assert.equal(localizeLabel('toString', {}), 'toString');
});

test('Rc 的計數標籤：數字另外放在 count，與 label 的數字一致，顯示端才能換語言', async () => {
  const { trace } = await load<{ trace: Trace }>(join(PAGES_DIR, '15-rc', 'trace.ts'));
  const tl = buildTimeline(trace);
  for (const [t, n] of [[1, 1], [2, 2], [4, 1], [6, 0]] as const) {
    const v = stateAt(tl, t).find((x) => x.id === rustCountId('v1'));
    assert.ok(v, `t=${t} 應該有計數標籤`);
    assert.equal(v.count, n);
    assert.equal(v.label, `計數 ${n}`);
  }
  // 換到一半（前半步）數字還是舊的，和標籤一起換
  assert.equal(stateAt(tl, 1.25).find((x) => x.id === rustCountId('v1'))?.count, 1);
  assert.equal(stateAt(tl, 1.75).find((x) => x.id === rustCountId('v1'))?.count, 2);
  // 其他物件沒有 count
  for (const v of stateAt(tl, 2)) if (v.kind !== 'note') assert.equal(v.count, undefined);
});

// ── LeetCode 各題的 en.ts ─────────────────────

const lcDirs = dirsWith(LC_DIR, 'rows.ts');

test('每一題都有 en.ts，資料夾與註冊表一一對應', () => {
  assert.deepEqual(lcDirs.map(slugOf), problems.map((p) => p.slug));
  for (const dir of lcDirs) assert.ok(existsSync(join(LC_DIR, dir, 'en.ts')), `lc/${dir} 缺 en.ts`);
});

for (const dir of lcDirs) {
  test(`lc/${dir}/en.ts：notes 的鍵等於有 tag 的列的 Rust 行號，summary 的數字等於有 tag 的列數，不含中日韓字元`, async () => {
    const { rows } = await load<{ rows: LcRow[] }>(join(LC_DIR, dir, 'rows.ts'));
    const en = (await load<{ default: LcEn }>(join(LC_DIR, dir, 'en.ts'))).default;
    const tagged = rows.filter((r) => r.tag !== undefined);

    assert.deepEqual(
      Object.keys(en.notes).map(Number).sort((a, b) => a - b),
      tagged.map((r) => r.rust).sort((a, b) => a! - b!),
      `lc/${dir} 的 notes 的鍵要恰好是有 tag 的列的 Rust 行號`,
    );
    for (const [line, note] of Object.entries(en.notes)) assert.ok(note, `lc/${dir} 的 notes[${line}] 是空的`);
    assert.equal(
      /\d+/.exec(en.summary)?.[0],
      String(tagged.length),
      `lc/${dir} 的英文 summary 第一個數字要等於有 tag 的列數（${tagged.length}）：${en.summary}`,
    );
    assert.equal(en.lead.length, 2, `lc/${dir} 的英文 lead 要兩段`);
    assert.ok(en.teaser, `lc/${dir} 缺 teaser`);
    assertEnglish(en, `lc/${dir}/en.ts`);
  });
}

test('teasers.en.ts：涵蓋註冊表的每個 slug，而且與各題 en.ts 的 teaser 相同', async () => {
  assert.deepEqual(Object.keys(TEASERS_EN), problems.map((p) => p.slug));
  for (const dir of lcDirs) {
    const en = (await load<{ default: LcEn }>(join(LC_DIR, dir, 'en.ts'))).default;
    assert.equal(TEASERS_EN[slugOf(dir)], en.teaser, `lc/${dir} 的英文 teaser 在 teasers.en.ts 與 en.ts 不一致`);
  }
});

// ── 英文版的程式碼片段 ───────────────────────

/** 一頁資料夾裡會顯示在畫面上、或送去 rustc 的原始片段 */
const SNIPPETS = ['snippet.ts', 'snippet.rs', 'broken.rs'];
const enName = (name: string) => name.replace(/\.(ts|rs)$/, '.en.$1');

for (const dir of pageDirs) {
  test(`${dir}：有中文的片段都有英文版，行數相同、只有含中文的行不同，英文版不含中日韓字元`, () => {
    for (const name of SNIPPETS) {
      const path = join(PAGES_DIR, dir, name);
      if (!existsSync(path)) continue;
      const original = lf(readFileSync(path, 'utf8'));
      const enPath = join(PAGES_DIR, dir, enName(name));
      if (!CJK.test(original)) {
        assert.ok(!existsSync(enPath), `${dir}/${name} 沒有中文，不需要 ${enName(name)}`);
        continue;
      }
      assert.ok(existsSync(enPath), `${dir}/${name} 有中文，要有 ${enName(name)}`);
      const english = lf(readFileSync(enPath, 'utf8'));
      assert.ok(!CJK.test(english), `${dir}/${enName(name)} 含中日韓字元`);

      const a = original.split('\n');
      const b = english.split('\n');
      assert.equal(b.length, a.length, `${dir}/${enName(name)} 的行數要與 ${name} 相同（軌跡照行號對應）`);
      for (const [i, line] of a.entries()) {
        if (CJK.test(line)) {
          // 只翻註解與字串：行首到第一個中文字之前的程式碼，除了註解或字串的開頭，都要一樣
          const code = line.slice(0, line.search(/\/\/|"/));
          assert.ok(b[i]!.startsWith(code), `${dir}/${enName(name)} 第 ${i + 1} 行的程式碼和原文不同`);
        } else {
          assert.equal(b[i], line, `${dir}/${enName(name)} 第 ${i + 1} 行沒有中文，應該與原文相同`);
        }
      }
    }
  });

  test(`${dir}：英文版的 .rs 也用 rustc 驗過，結果與原文那一份相同`, () => {
    const expects = JSON.parse(readFileSync(join(PAGES_DIR, dir, 'expect.json'), 'utf8')) as Record<string, string>;
    const verified = JSON.parse(readFileSync(join(PAGES_DIR, dir, 'verified.json'), 'utf8')) as {
      files: Record<string, { success: boolean; message: string }>;
    };
    for (const name of SNIPPETS.filter((n) => n.endsWith('.rs'))) {
      if (!existsSync(join(PAGES_DIR, dir, enName(name)))) continue;
      assert.equal(expects[enName(name)], expects[name], `${dir}/expect.json 要有 ${enName(name)}，期望與 ${name} 相同`);
      const a = verified.files[name];
      const b = verified.files[enName(name)];
      assert.ok(a && b, `${dir}/verified.json 要有 ${name} 與 ${enName(name)}`);
      assert.equal(b.success, a.success);
      // 行號相同，所以 rustc 的錯誤訊息應該一字不差
      assert.equal(b.message, a.message);
    }
  });
}

test('LeetCode：顯示給讀者的解法（兩個標記之間）不含中日韓字元', () => {
  for (const dir of lcDirs) {
    for (const name of ['solution.ts', 'solution.rs']) {
      const lines = lf(readFileSync(join(LC_DIR, dir, name), 'utf8')).split('\n');
      const start = lines.findIndex((l) => l.trim() === '// --- solution ---');
      const end = lines.findIndex((l) => l.trim() === '// --- end ---');
      assert.ok(start >= 0 && end > start, `lc/${dir}/${name} 找不到標記`);
      const shown = lines.slice(start + 1, end).join('\n');
      assert.ok(!CJK.test(shown), `lc/${dir}/${name} 顯示的解法裡有中日韓字元`);
    }
  }
});
