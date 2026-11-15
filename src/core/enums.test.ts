// enum 區（第 10–12 頁）：盒子（Option／Result）、match 的閘門、JS 的空位與閃電，以及三頁軌跡。

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { breakIt as optionBreak, trace as option } from '../pages/10-option/trace.ts';
import { breakIt as matchBreak, trace as match } from '../pages/11-match/trace.ts';
import { breakIt as resultBreak, trace as result } from '../pages/12-result/trace.ts';
import { breakRange, buildTimeline, stateAt, type Visual } from './timeline.ts';
import type { JsEvent, RustEvent, Trace } from './trace.ts';
import { applyJs, applyRust, checkRust, emptyJs, emptyRust, type JsState, type RustState } from './worlds.ts';

const PAGES: [string, Trace][] = [
  ['10-option', option],
  ['11-match', match],
  ['12-result', result],
];

function find(visuals: Visual[], id: string): Visual {
  const v = visuals.find((x) => x.id === id);
  assert.ok(v, `畫面裡找不到 ${id}`);
  return v;
}

const run = (events: RustEvent[]): RustState => events.reduce(applyRust, emptyRust());
const runJs = (events: JsEvent[]): JsState => events.reduce(applyJs, emptyJs());

const SOME: RustEvent[] = [
  { type: 'alloc', value: 'v1', label: '"hi"' },
  { type: 'wrap', binding: 'a', variant: 'Some', value: 'v1' },
];
const ORDER: RustEvent[] = [
  { type: 'alloc', value: 'v1', label: 'Equal', copy: true },
  { type: 'bind', binding: 'order', value: 'v1' },
];
const ALL = ['Less', 'Equal', 'Greater'];

// ---- 盒子 ----

test('盒子沒打開：把它當成裡面的值來用會被 unopened-box 擋下，和第 10、12 頁的 breakIt.rule 一致', () => {
  const s = run(SOME);
  assert.deepEqual(s.bindings.a, { state: 'owns', value: 'v1' });
  assert.equal(s.boxes.a?.open, false);
  assert.equal(checkRust(s, { type: 'use-inner', binding: 'a' })?.rule, 'unopened-box');
  assert.equal(optionBreak.rule, 'unopened-box');
  assert.equal(resultBreak.rule, 'unopened-box');
});

test('空盒（None）沒打開也一樣被擋；打開之後沒有東西可以交出去', () => {
  const s = run([{ type: 'wrap', binding: 'b', variant: 'None' }]);
  assert.deepEqual(s.bindings.b, { state: 'owns', value: null });
  assert.equal(checkRust(s, { type: 'use-inner', binding: 'b' })?.rule, 'unopened-box');
  assert.equal(checkRust(s, { type: 'open', binding: 'b', to: 'text' })?.rule, 'invalid-trace');
  const opened = applyRust(s, { type: 'open', binding: 'b' });
  assert.equal(opened.boxes.b?.open, true);
  assert.notEqual(checkRust(opened, { type: 'use-inner', binding: 'b' })?.rule, 'unopened-box');
  // 空盒離開 scope：沒有值可以碎，也不會出錯
  const gone = applyRust(opened, { type: 'drop', binding: 'b' });
  assert.equal(gone.bindings.b?.state, 'gone');
  assert.equal(gone.boxes.b, undefined);
});

test('打開盒子：值搬給接手的變數，可以用；原本握著盒子的變數成了空殼', () => {
  const s = applyRust(run(SOME), { type: 'open', binding: 'a', to: 'text' });
  assert.deepEqual(s.bindings.text, { state: 'owns', value: 'v1' });
  assert.deepEqual(s.bindings.a, { state: 'moved', value: null });
  assert.equal(s.values.v1?.owner, 'text');
  assert.equal(checkRust(s, { type: 'use', binding: 'text' }), null);
  assert.equal(checkRust(s, { type: 'use-inner', binding: 'text' }), null, '一般的值 use-inner 等於 use');
  assert.equal(checkRust(s, { type: 'use-inner', binding: 'a' })?.rule, 'use-after-move');
  assert.equal(checkRust(s, { type: 'open', binding: 'a', to: 'again' })?.rule, 'use-after-move');
});

test('盒子裡有值，打開時一定要交給一個變數；握著盒子的變數不能直接 move', () => {
  const s = run(SOME);
  assert.equal(checkRust(s, { type: 'open', binding: 'a' })?.rule, 'invalid-trace');
  assert.equal(checkRust(s, { type: 'move', from: 'a', to: 'b' })?.rule, 'invalid-trace');
  assert.equal(checkRust(s, { type: 'open', binding: 'nobody', to: 'x' })?.rule, 'undeclared');
});

// ---- match ----

test('match 分支齊全時合法；少一個分支被 non-exhaustive-match 擋下，和第 11 頁的 breakIt.rule 一致', () => {
  const s = run(ORDER);
  assert.equal(checkRust(s, { type: 'match', id: 'm', on: 'order', arms: ALL, of: ALL }), null);
  const bad = checkRust(s, { type: 'match', id: 'm', on: 'order', arms: ['Less', 'Greater'], of: ALL });
  assert.equal(bad?.rule, 'non-exhaustive-match');
  assert.ok(bad?.detail.includes('Equal'), '要指出漏了哪一個');
  assert.equal(matchBreak.rule, 'non-exhaustive-match');
});

test('從進行中的 match 拔掉分支也被 non-exhaustive-match 擋下；match 結束後就沒有東西可拔', () => {
  const open = applyRust(run(ORDER), { type: 'match', id: 'm', on: 'order', arms: ALL, of: ALL });
  assert.equal(checkRust(open, { type: 'remove-arm', match: 'm', arm: 'Equal' })?.rule, 'non-exhaustive-match');
  assert.equal(checkRust(open, { type: 'remove-arm', match: 'm', arm: 'Other' })?.rule, 'invalid-trace');
  assert.equal(checkRust(run(ORDER), { type: 'remove-arm', match: 'm', arm: 'Equal' })?.rule, 'invalid-trace');
});

test('閘門照順序試：值走進符合的那一道，之後的不再試；沒有符合之前不能結束', () => {
  let s = applyRust(run(ORDER), { type: 'match', id: 'm', on: 'order', arms: ALL, of: ALL });
  assert.equal(checkRust(s, { type: 'end-match', match: 'm' })?.rule, 'invalid-trace');
  s = applyRust(s, { type: 'arm', match: 'm', arm: 'Less' });
  assert.equal(s.matches.m?.taken, null);
  assert.equal(checkRust(s, { type: 'arm', match: 'm', arm: 'Less' })?.rule, 'invalid-trace', '同一道不能試兩次');
  s = applyRust(s, { type: 'arm', match: 'm', arm: 'Equal' });
  assert.equal(s.matches.m?.taken, 'Equal');
  assert.equal(checkRust(s, { type: 'arm', match: 'm', arm: 'Greater' })?.rule, 'invalid-trace');
  s = applyRust(s, { type: 'end-match', match: 'm' });
  assert.equal(s.matches.m?.open, false);
  // match 不會把 Copy 的值搬走
  assert.equal(checkRust(s, { type: 'use', binding: 'order' }), null);
});

test('對盒子做 match：看的是變體，而且盒子被掀開（之後不再算「沒打開就用」）', () => {
  const boxed = run([
    { type: 'alloc', value: 'v1', label: 'ParseIntError' },
    { type: 'wrap', binding: 'result', variant: 'Err', value: 'v1', side: 'err' },
  ]);
  assert.equal(checkRust(boxed, { type: 'use-inner', binding: 'result' })?.rule, 'unopened-box');
  let s = applyRust(boxed, { type: 'match', id: 'm', on: 'result', arms: ['Ok', 'Err'], of: ['Ok', 'Err'] });
  assert.equal(s.boxes.result?.open, true);
  assert.notEqual(checkRust(s, { type: 'use-inner', binding: 'result' })?.rule, 'unopened-box');
  s = applyRust(s, { type: 'arm', match: 'm', arm: 'Ok' });
  assert.equal(s.matches.m?.taken, null);
  s = applyRust(s, { type: 'arm', match: 'm', arm: 'Err' });
  assert.equal(s.matches.m?.taken, 'Err');
  s = applyRust(s, { type: 'open', binding: 'result', to: 'e' });
  assert.equal(s.values.v1?.owner, 'e');
  assert.equal(checkRust(s, { type: 'use', binding: 'e' }), null);
});

// ---- JS：空位、switch、閃電 ----

test('JS：變數連到空位照樣能讀；碰它才丟錯，沒有人接就中止，之後不能再有事件', () => {
  let s = runJs([{ type: 'bind-empty', binding: 'b' }]);
  assert.deepEqual(s.bindings.b, { live: true, value: null });
  assert.deepEqual(s.holes, ['b']);
  s = applyJs(s, { type: 'use', binding: 'b' });
  s = applyJs(s, { type: 'throw', label: 'TypeError', binding: 'b' });
  assert.deepEqual(s.error, { label: 'TypeError', binding: 'b', trail: [''], out: false });
  s = applyJs(s, { type: 'unwind' });
  assert.equal(s.error?.out, true);
  assert.throws(() => applyJs(s, { type: 'use', binding: 'b' }), /中止/);
});

test('JS：連著真的值的變數，碰它不會炸', () => {
  const s = runJs([
    { type: 'alloc', value: 'p1', label: '"hi"', prim: true },
    { type: 'bind', binding: 'a', value: 'p1' },
  ]);
  assert.throws(() => applyJs(s, { type: 'throw', label: 'TypeError', binding: 'a' }));
});

test('JS：throw 每往上飛一層，那一層當場結束、裡面的變數跟著消失', () => {
  let s = runJs([
    { type: 'enter', scope: 'main', kind: 'fn', label: 'main()' },
    { type: 'enter', scope: 'parse', kind: 'fn', label: 'parse()' },
    { type: 'alloc', value: 'p1', label: '"abc"', prim: true },
    { type: 'bind', binding: 'text', value: 'p1' },
    { type: 'throw', label: 'SyntaxError' },
  ]);
  assert.deepEqual(s.error?.trail, ['parse']);
  s = applyJs(s, { type: 'unwind' });
  assert.deepEqual(s.error?.trail, ['parse', 'main']);
  assert.equal(s.scopes.parse?.open, false);
  assert.equal(s.bindings.text?.live, false);
  s = applyJs(s, { type: 'unwind' });
  assert.deepEqual(s.stack, ['']);
  assert.equal(s.error?.out, false);
  s = applyJs(s, { type: 'unwind' });
  assert.equal(s.error?.out, true);
});

test('JS：switch 漏了一種情況不會被擋，只是沒有任何一道門接住', () => {
  let s = runJs([
    { type: 'alloc', value: 'p1', label: '0', prim: true },
    { type: 'bind', binding: 'order', value: 'p1' },
    { type: 'match', id: 's', on: 'order', arms: ['-1', '1'] },
    { type: 'arm', match: 's', arm: '-1' },
    { type: 'arm', match: 's', arm: '1' },
  ]);
  assert.equal(s.matches.s?.taken, null);
  s = applyJs(s, { type: 'end-match', match: 's' });
  assert.equal(s.matches.s?.open, false);
});

// ---- 三頁軌跡 ----

test('三頁的弄壞它：只在盒子存在而且還沒打開、閘門還立著的那幾步可以做', () => {
  assert.deepEqual(breakRange(buildTimeline(option), optionBreak), { from: 3, to: 6 });
  assert.deepEqual(breakRange(buildTimeline(match), matchBreak), { from: 3, to: 5 });
  assert.deepEqual(breakRange(buildTimeline(result), resultBreak), { from: 3, to: 3 });
});

test('三頁的弄壞它都是按鈕觸發（不用拖），力場出現的物件在可以做的每一步都看得見', () => {
  for (const [trace, breakIt] of [[option, optionBreak], [match, matchBreak], [result, resultBreak]] as const) {
    assert.equal(breakIt.drag, undefined);
    const tl = buildTimeline(trace);
    const range = breakRange(tl, breakIt)!;
    for (let k = range.from; k <= range.to; k++) {
      assert.equal(find(stateAt(tl, k), breakIt.at).n.alpha, 1, `t=${k} 的 ${breakIt.at}`);
    }
  }
});

for (const [name, trace] of PAGES) {
  const tl = buildTimeline(trace);

  test(`${name}：stateAt 在整數 t 與快照嚴格相等`, () => {
    assert.equal(tl.frames.length, tl.steps + 1);
    for (let k = 0; k <= tl.steps; k++) {
      const frame = tl.frames[k]!;
      const got = stateAt(tl, k);
      for (const [id, v] of frame) {
        const g = find(got, id);
        assert.deepEqual(g.n, v.n, `t=${k} 的 ${id}`);
        assert.equal(g.label, v.label, `t=${k} 的 ${id} 的標籤`);
      }
      for (const v of got) {
        if (!frame.has(v.id)) assert.equal(v.n.alpha, 0, `t=${k} 的 ${v.id} 不該看得見`);
      }
    }
  });

  test(`${name}：往回拖得到同一個畫面（純函式）`, () => {
    for (const t of [0.3, 2.5, 3.75, tl.steps - 0.4]) {
      assert.deepEqual(stateAt(tl, t), stateAt(tl, t));
    }
  });

  test(`${name}：字幕 30 字以內`, () => {
    trace.steps.forEach((step, i) => {
      for (const text of [step.caption.js, step.caption.rust]) {
        assert.ok([...text].length <= 30, `第 ${i + 1} 步「${text}」有 ${[...text].length} 字`);
        assert.ok(text.length > 0);
      }
    });
  });

  test(`${name}：內容在 x ±2.6 內，高度在 bounds 內`, () => {
    assert.equal(tl.bounds.halfX, 2.6);
    for (let t = 0; t <= tl.steps; t += 0.25) {
      for (const v of stateAt(tl, t)) {
        if (v.n.alpha < 0.01) continue;
        const half = v.kind === 'frame' ? v.n.w / 2 : 0;
        assert.ok(Math.abs(v.n.x) + half <= 2.6 + 1e-9, `t=${t} 的 ${v.id} x=${v.n.x}`);
        assert.ok(v.n.y >= tl.bounds.y0 && v.n.y <= tl.bounds.y1, `t=${t} 的 ${v.id} y=${v.n.y}`);
        if (v.kind === 'bolt') {
          assert.ok(Math.abs(v.n.x2) <= 2.6 && v.n.y2 <= tl.bounds.y1, `t=${t} 的 ${v.id} 終點`);
        }
      }
    }
  });
}

// ---- 畫面 ----

test('10-option：盒子打開那一步，蓋子從 0 掀到 1，值從 a 飛到 text；a 的盒子變成空殼', () => {
  const tl = buildTimeline(option);
  assert.equal(tl.frames[3]!.get('rust:box:a')!.n.open, 0);
  assert.equal(tl.frames[4]!.get('rust:box:a')!.n.open, 1);
  assert.equal(tl.frames[4]!.get('rust:box:a')!.n.ghost, 1);
  const mid = stateAt(tl, 3.5);
  const lid = find(mid, 'rust:box:a').n.open;
  assert.ok(lid > 0 && lid < 1, `open=${lid}`);
  const from = tl.frames[3]!.get('rust:val:v1')!.n;
  const to = tl.frames[4]!.get('rust:val:v1')!.n;
  assert.deepEqual([to.x, to.y], [tl.frames[4]!.get('rust:claw:text')!.n.x, tl.frames[4]!.get('rust:claw:text')!.n.y]);
  const val = find(mid, 'rust:val:v1').n;
  assert.ok(val.y > from.y && val.flight > 0, '值在飛');
  // 空盒：有盒子、沒有值；打開之後還是空的
  assert.equal(tl.frames[3]!.get('rust:box:b')!.label, 'None');
  assert.equal(tl.frames[7]!.get('rust:box:b')!.n.open, 1);
  assert.equal(tl.rustStates[7]!.bindings.b?.value, null);
});

test('10-option：JS 的 b 連到空位，線和 a 的一樣長；碰了之後閃電從空位劈到頂端', () => {
  const tl = buildTimeline(option);
  const f = tl.frames[3]!;
  const hole = f.get('js:hole:b')!;
  const link = f.get('js:link:b')!;
  assert.equal(hole.kind, 'hole');
  assert.equal(link.ref, 'js:hole:b');
  assert.deepEqual([link.n.x2, link.n.y2], [hole.n.x, hole.n.y]);
  const a = f.get('js:link:a')!.n;
  assert.equal(link.n.y2 - link.n.y, a.y2 - a.y);

  assert.equal(tl.frames[7]!.has('js:spark'), false);
  const bolt = tl.frames[8]!.get('js:bolt:1')!.n;
  assert.deepEqual([bolt.x, bolt.y], [hole.n.x, hole.n.y]);
  assert.ok(bolt.y2 > bolt.y);
  const mid = stateAt(tl, 7.5);
  const g = find(mid, 'js:bolt:1').n.grow;
  assert.ok(g > 0 && g < 1);
  // 閃電的頭跟著劈出去的那一端走
  const spark = find(mid, 'js:spark').n;
  assert.ok(Math.abs(spark.y - (bolt.y + (bolt.y2 - bolt.y) * g)) < 1e-9);
});

test('11-match：Rust 三道門、值走進 Equal；JS 只有兩道、沒有一道亮，值從旁邊溜過去', () => {
  const tl = buildTimeline(match);
  const f = tl.frames[5]!;
  assert.deepEqual(
    ['Less', 'Equal', 'Greater'].map((arm) => [f.get(`rust:gate:m:${arm}`)!.n.lit, f.get(`rust:gate:m:${arm}`)!.n.ghost]),
    [[0, 1], [1, 0], [0, 0]],
  );
  assert.deepEqual(
    ['-1', '1'].map((arm) => [f.get(`js:gate:s:${arm}`)!.n.lit, f.get(`js:gate:s:${arm}`)!.n.ghost]),
    [[0, 1], [0, 1]],
  );
  assert.equal(f.has('js:gate:s:0'), false);
  // 亮起可以倒著拖
  const lit = find(stateAt(tl, 4.5), 'rust:gate:m:Equal').n.lit;
  assert.ok(lit > 0 && lit < 1);
  // match 結束：閘門收掉，"same" 從 Equal 那道門冒出來飛到 text
  assert.equal(tl.frames[6]!.has('rust:gate:m:Equal'), false);
  assert.deepEqual(tl.origins[5]!['rust:val:v2'], { x: f.get('rust:gate:m:Equal')!.n.x, y: f.get('rust:gate:m:Equal')!.n.y });
  // JS：只有落空的那一步中途有溜過去的影子，整數 t 沒有
  assert.ok(tl.slips[5]);
  assert.ok(find(stateAt(tl, 5.5), 'js:slip').n.alpha > 0.5);
  assert.equal(stateAt(tl, 5).some((v) => v.id === 'js:slip'), false);
  assert.equal(stateAt(tl, 6).some((v) => v.id === 'js:slip'), false);
  assert.equal(tl.slips.filter(Boolean).length, 1);
  // text 一直連著空位
  assert.ok(tl.frames[7]!.has('js:hole:text'));
});

test('12-result：雙色盒子亮 Err；閃電一層一層往上，劈過的留著，框被劈穿就消失', () => {
  const tl = buildTimeline(result);
  const box = tl.frames[3]!.get('rust:box:result')!;
  assert.deepEqual([box.n.duo, box.n.err, box.n.open, box.label], [1, 1, 0, 'Err']);
  assert.equal(tl.frames[4]!.get('rust:box:result')!.n.open, 1, 'match 把盒子掀開');
  assert.equal(tl.frames[6]!.get('rust:gate:m:Err')!.n.lit, 1);
  assert.equal(tl.rustStates[6]!.values.v1?.owner, 'e');

  assert.equal(tl.frames[2]!.get('js:spark')!.label, 'SyntaxError');
  assert.equal(tl.frames[2]!.has('js:bolt:1'), false);
  assert.ok(tl.frames[2]!.has('js:frame:parse'));
  assert.ok(tl.frames[3]!.has('js:bolt:1') && !tl.frames[3]!.has('js:frame:parse'));
  assert.ok(tl.frames[4]!.has('js:bolt:2') && !tl.frames[4]!.has('js:frame:main'));
  assert.ok(tl.frames[6]!.has('js:bolt:3'));
  // 一段接一段，而且一路往上
  for (let i = 2; i <= 3; i++) {
    const prev = tl.frames[6]!.get(`js:bolt:${i - 1}`)!.n;
    const cur = tl.frames[6]!.get(`js:bolt:${i}`)!.n;
    assert.deepEqual([cur.x, cur.y], [prev.x2, prev.y2]);
    assert.ok(cur.y2 > cur.y);
  }
  const tip = tl.frames[6]!.get('js:bolt:3')!.n;
  const spark = tl.frames[7]!.get('js:spark')!.n;
  assert.deepEqual([spark.x, spark.y], [tip.x2, tip.y2]);
});

test('前九頁不受影響：沒有盒子、閘門、空位、閃電', async () => {
  const { trace } = await import('../pages/06-mut-borrow/trace.ts');
  const tl = buildTimeline(trace);
  for (const frame of tl.frames) {
    for (const v of frame.values()) {
      assert.ok(!['box', 'gate', 'hole', 'bolt', 'spark'].includes(v.kind));
      assert.deepEqual([v.n.open, v.n.duo, v.n.err], [0, 0, 0]);
    }
  }
  assert.ok(tl.slips.every((s) => s === null));
  assert.deepEqual(tl.bounds, { halfX: 2.6, y0: -2.0, y1: 2.7 + 0.9 });
});
