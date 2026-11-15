// 所有權區第 2–4 頁的軌跡：Copy 與 Move、函式範圍、離開 { } 與 GC。
// 也檢查共用的機制：整數 t 與快照嚴格相等、排版不超出範圍、BreakIt 的新形狀。

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { breakIt as moveBreak, trace as moveTrace } from '../pages/01-move/trace.ts';
import { trace as copyTrace } from '../pages/02-copy-vs-move/trace.ts';
import { breakIt as fnBreak, trace as fnTrace } from '../pages/03-functions/trace.ts';
import { trace as scopeTrace } from '../pages/04-scope-drop/trace.ts';
import {
  breakRange,
  buildTimeline,
  JS_GC_ID,
  RUST_PITCH,
  stateAt,
  type Timeline,
  type Visual,
} from './timeline.ts';
import type { RustEvent, Trace } from './trace.ts';
import { applyRust, checkRust, emptyRust, jsRefCount } from './worlds.ts';

const copyTl = buildTimeline(copyTrace);
const fnTl = buildTimeline(fnTrace);
const scopeTl = buildTimeline(scopeTrace);
const moveTl = buildTimeline(moveTrace);

const all: [string, Timeline][] = [
  ['01-move', moveTl],
  ['02-copy-vs-move', copyTl],
  ['03-functions', fnTl],
  ['04-scope-drop', scopeTl],
];

function find(visuals: Visual[], id: string): Visual {
  const v = visuals.find((x) => x.id === id);
  assert.ok(v, `畫面裡找不到 ${id}`);
  return v;
}

const use = (binding: string): RustEvent => ({ type: 'use', binding });

// ---- 共用機制 ----

for (const [name, tl] of all) {
  test(`${name}：stateAt(tl, k) 在每個整數 k 與快照嚴格相等`, () => {
    assert.equal(tl.frames.length, tl.steps + 1);
    for (let k = 0; k <= tl.steps; k++) {
      const frame = tl.frames[k]!;
      const got = stateAt(tl, k);
      for (const [id, v] of frame) {
        const n = find(got, id).n;
        for (const key of Object.keys(v.n) as (keyof typeof v.n)[]) {
          assert.ok(Object.is(n[key], v.n[key]), `t=${k} 的 ${id}.${key}：${n[key]} 應該等於 ${v.n[key]}`);
        }
      }
      // 不在這張快照裡的物件（下一步才出現、這一步剛消失、掃地機）必須看不見
      for (const v of got) {
        if (!frame.has(v.id)) assert.equal(v.n.alpha, 0, `t=${k} 的 ${v.id} 不該看得見`);
        assert.equal(v.n.pulse, 0);
        assert.equal(v.n.flight, 0);
        assert.equal(v.n.swept, 0);
      }
    }
  });

  test(`${name}：stateAt 是純函式，往回拖得到同一個畫面`, () => {
    for (let t = 0; t <= tl.steps; t += 0.25) {
      const first = stateAt(tl, t);
      stateAt(tl, tl.steps);
      stateAt(tl, 0);
      assert.deepEqual(stateAt(tl, t), first, `t=${t}`);
    }
  });

  test(`${name}：每個世界的內容都在 bounds 之內`, () => {
    const { halfX, y0, y1 } = tl.bounds;
    for (let t = 0; t <= tl.steps; t += 0.125) {
      for (const v of stateAt(tl, t)) {
        if (v.n.alpha < 0.01) continue;
        const rx = v.kind === 'frame' ? v.n.w / 2 : 0;
        const ry = v.kind === 'frame' ? v.n.h / 2 : 0;
        assert.ok(Math.abs(v.n.x) + rx <= halfX, `t=${t} 的 ${v.id} x=${v.n.x} 超出 ±${halfX}`);
        assert.ok(v.n.y - ry >= y0 && v.n.y + ry <= y1, `t=${t} 的 ${v.id} y=${v.n.y} 超出 ${y0}..${y1}`);
      }
    }
  });
}

test('01-move 的排版與取景範圍沒有變', () => {
  assert.deepEqual(moveTl.bounds, { halfX: 2.6, y0: -2.0, y1: 2.7 });
  const f = moveTl.frames[2]!;
  assert.deepEqual([f.get('rust:claw:a')!.n.x, f.get('rust:claw:a')!.n.y], [-1.3, 0]);
  assert.deepEqual([f.get('rust:claw:b')!.n.x, f.get('rust:val:v1')!.n.x, f.get('rust:val:v1')!.n.y], [1.3, 1.3, 0]);
  assert.deepEqual([f.get('js:tag:a')!.n.x, f.get('js:tag:b')!.n.x, f.get('js:tag:a')!.n.y], [-1.3, 1.3, -1.3]);
  assert.deepEqual([f.get('js:orb:o1')!.n.x, f.get('js:orb:o1')!.n.y], [0, 1.0]);
  assert.equal(f.get('rust:val:v1')!.kind, 'crystal');
  assert.equal(f.get('js:orb:o1')!.kind, 'orb');
});

test('BreakIt：01-move 仍然是拖值到變數，03-functions 沒有拖曳、力場放在 a 上', () => {
  assert.deepEqual(moveBreak.drag, { value: 'v1', onto: 'a' });
  assert.equal(moveBreak.at, 'rust:claw:a');
  assert.deepEqual(breakRange(moveTl, moveBreak), { from: 2, to: 4 });

  assert.equal(fnBreak.drag, undefined);
  const range = breakRange(fnTl, fnBreak);
  assert.ok(range);
  // 可以弄壞的每一步，力場要放的物件都在畫面上
  for (let k = range.from; k <= range.to; k++) {
    assert.ok(tl(fnTl, k, fnBreak.at).n.alpha > 0.5, `做完前 ${k} 步時 ${fnBreak.at} 應該在畫面上`);
  }
});

function tl(timeline: Timeline, k: number, id: string): Visual {
  const v = timeline.frames[k]!.get(id);
  assert.ok(v, `做完前 ${k} 步的快照裡找不到 ${id}`);
  return v;
}

// ---- 02 Copy vs Move ----

test('02：Copy 之後兩個變數都可用，各握一顆不同的值', () => {
  const s = copyTl.rustStates[2]!;
  assert.deepEqual(s.bindings.x, { state: 'owns', value: 'i1' });
  assert.deepEqual(s.bindings.y, { state: 'owns', value: 'i2' });
  assert.equal(s.values.i1?.copy, true);
  assert.equal(s.values.i2?.copy, true);
  assert.equal(s.values.i2?.label, '5');
  assert.equal(checkRust(s, use('x')), null);
  assert.equal(checkRust(s, use('y')), null);
  // 一路到 main 結束之前 x 都可用
  for (let k = 2; k < copyTl.steps; k++) assert.equal(checkRust(copyTl.rustStates[k]!, use('x')), null, `k=${k}`);
});

test('02：Move 之後原變數不可用，新變數可用', () => {
  const s = copyTl.rustStates[5]!;
  assert.deepEqual(s.bindings.s, { state: 'moved', value: null });
  assert.deepEqual(s.bindings.t, { state: 'owns', value: 'v1' });
  assert.equal(s.values.v1?.copy, false);
  assert.equal(checkRust(s, use('s'))?.rule, 'use-after-move');
  assert.equal(checkRust(s, use('t')), null);
});

test('02：Copy 型別不能用 move 事件、Move 型別不能用 copy 事件', () => {
  const afterInt = copyTl.rustStates[1]!;
  assert.equal(checkRust(afterInt, { type: 'move', from: 'x', to: 'y' })?.rule, 'invalid-trace');
  const afterString = copyTl.rustStates[4]!;
  assert.equal(checkRust(afterString, { type: 'copy', from: 's', to: 't', value: 'v9' })?.rule, 'invalid-trace');
});

test('02：畫面上 Copy 的值是 chip、String 是 crystal；JS 的數字是 bead、物件是 orb', () => {
  const f = copyTl.frames[5]!;
  assert.equal(f.get('rust:val:i1')!.kind, 'chip');
  assert.equal(f.get('rust:val:i2')!.kind, 'chip');
  assert.equal(f.get('rust:val:v1')!.kind, 'crystal');
  assert.equal(f.get('js:orb:n1')!.kind, 'bead');
  assert.equal(f.get('js:orb:n2')!.kind, 'bead');
  assert.equal(f.get('js:orb:o1')!.kind, 'orb');
});

test('02：複製演到一半，新的值從原值的位置分出來，原值留在原地', () => {
  const src = tl(copyTl, 1, 'rust:val:i1').n;
  const dst = tl(copyTl, 2, 'rust:val:i2').n;
  assert.notEqual(src.x, dst.x);
  assert.deepEqual(copyTl.origins[1]!['rust:val:i2'], { x: src.x, y: src.y });

  const early = stateAt(copyTl, 1.05);
  const born = find(early, 'rust:val:i2').n;
  assert.ok(Math.abs(born.x - src.x) < 0.05, `剛分出來時 x=${born.x} 應該貼著原值 ${src.x}`);

  const mid = stateAt(copyTl, 1.5);
  const flying = find(mid, 'rust:val:i2').n;
  assert.ok(flying.x > src.x && flying.x < dst.x);
  assert.ok(flying.flight > 0 && flying.alpha > 0.9);
  // 原值沒有動，也沒有變淡
  assert.deepEqual(find(mid, 'rust:val:i1').n, src);

  // JS 的數字也是複製
  const jsSrc = tl(copyTl, 1, 'js:orb:n1').n;
  const jsMid = find(mid, 'js:orb:n2').n;
  assert.ok(jsMid.x > jsSrc.x && jsMid.x < tl(copyTl, 2, 'js:orb:n2').n.x);
  assert.deepEqual(find(mid, 'js:orb:n1').n, jsSrc);
});

test('02：JS 的數字各有一顆；物件被 s、t 兩條線連著', () => {
  const js = copyTl.jsStates[5]!;
  assert.notEqual(js.bindings.x!.value, js.bindings.y!.value);
  assert.equal(js.bindings.s!.value, js.bindings.t!.value);
  assert.equal(jsRefCount(js, 'o1'), 2);
});

test('02：main 結束時 Rust 的值全碎；JS 的數字跟著變數消失，物件留著等 GC', () => {
  const N = copyTl.steps;
  for (const id of ['i1', 'i2', 'v1']) assert.equal(copyTl.rustStates[N]!.values[id]?.alive, false, id);
  const js = copyTl.jsStates[N]!;
  assert.equal(js.values.n1, undefined);
  assert.equal(js.values.n2, undefined);
  assert.ok(js.values.o1);
  assert.equal(tl(copyTl, N, 'js:orb:o1').n.loose, 1);
});

// ---- 03 函式 ----

test('03：傳進函式後原變數不可用，而且與 broken.rs 的錯誤碼對得上', () => {
  const s = fnTl.rustStates[2]!;
  assert.deepEqual(s.bindings.a, { state: 'moved', value: null });
  assert.deepEqual(s.bindings.s, { state: 'owns', value: 'v1' });
  assert.equal(checkRust(s, use('a'))?.rule, 'use-after-move');

  const expects = JSON.parse(
    readFileSync(new URL('../pages/03-functions/expect.json', import.meta.url), 'utf8'),
  ) as Record<string, string>;
  assert.equal(fnBreak.expect, expects['broken.rs']);
  assert.equal(fnBreak.expect, 'E0382');
  assert.equal(fnBreak.rule, 'use-after-move');
  // 從傳進去的那一步起，到 a 離開 scope 之前，都擋得下來；回傳之後也一樣
  assert.deepEqual(breakRange(fnTl, fnBreak), { from: 2, to: 6 });
});

test('03：參數宣告在函式範圍裡，畫面上有框；框在呼叫端的上面一列', () => {
  const s = fnTl.rustStates[2]!;
  assert.equal(s.scopeOf.s, 'pass');
  assert.equal(s.scopeOf.a, '');
  assert.deepEqual(s.stack, ['', 'pass']);
  assert.equal(s.scopes.pass?.kind, 'fn');

  const f = fnTl.frames[2]!;
  const frame = f.get('rust:frame:pass')!;
  assert.equal(frame.kind, 'frame');
  assert.equal(frame.label, 'fn pass');
  assert.equal(frame.n.dash, 0);
  const claw = f.get('rust:claw:s')!.n;
  assert.equal(claw.y, RUST_PITCH);
  assert.ok(Math.abs(claw.x - frame.n.x) < frame.n.w / 2 && Math.abs(claw.y - frame.n.y) < frame.n.h / 2);
  // 呼叫端的夾具在框外面
  const a = f.get('rust:claw:a')!.n;
  assert.ok(a.y < frame.n.y - frame.n.h / 2);
  // 值跟著搬進框裡
  assert.deepEqual([f.get('rust:val:v1')!.n.x, f.get('rust:val:v1')!.n.y], [claw.x, claw.y]);
  assert.ok(f.get('js:frame:pass'));
  assert.equal(fnTl.bounds.y1, 2.7 + RUST_PITCH);
});

test('03：回傳把值搬回呼叫端的 b，函式的框與參數消失，值還活著', () => {
  const s = fnTl.rustStates[3]!;
  assert.deepEqual(s.bindings.b, { state: 'owns', value: 'v1' });
  assert.equal(s.scopeOf.b, '');
  assert.equal(s.bindings.s?.state, 'gone');
  assert.equal(s.values.v1?.alive, true);
  assert.deepEqual(s.stack, ['']);
  assert.equal(checkRust(s, use('a'))?.rule, 'use-after-move');

  const f = fnTl.frames[3]!;
  assert.equal(f.has('rust:frame:pass'), false);
  assert.equal(f.has('rust:claw:s'), false);
  assert.equal(f.get('rust:val:v1')!.n.y, 0);
  assert.equal(f.get('rust:val:v1')!.n.shatter, 0);
  assert.equal(f.get('rust:val:v1')!.n.x, f.get('rust:claw:b')!.n.x);

  // 回傳演到一半：值在框與 b 之間飛
  const mid = find(stateAt(fnTl, 2.5), 'rust:val:v1').n;
  assert.ok(mid.flight > 0 && mid.y > 0 && mid.y < RUST_PITCH + 1);
});

test('03：函式結束又沒回傳，值跟著參數當場碎掉', () => {
  const before = fnTl.rustStates[5]!;
  assert.deepEqual(before.bindings.s, { state: 'owns', value: 'v1' });
  assert.equal(before.scopeOf.s, 'show');
  assert.equal(before.values.v1?.alive, true);

  const after = fnTl.rustStates[6]!;
  assert.equal(after.values.v1?.alive, false);
  assert.equal(after.bindings.s?.state, 'gone');
  assert.equal(checkRust(after, use('s'))?.rule, 'out-of-scope');
  assert.equal(fnTl.frames[6]!.has('rust:frame:show'), false);
  assert.equal(fnTl.frames[6]!.get('rust:val:v1')!.n.shatter, 1);

  const mid = find(stateAt(fnTl, 5.5), 'rust:val:v1').n;
  assert.ok(mid.shatter > 0 && mid.shatter < 1);
  // 碎的位置在框裡，不是呼叫端
  assert.equal(mid.y, RUST_PITCH);
});

test('03：JS 傳的是同一顆值，函式結束後它還被 a、b 連著', () => {
  assert.equal(jsRefCount(fnTl.jsStates[2]!, 'o1'), 2);
  assert.equal(fnTl.jsStates[2]!.bindings.s!.value, 'o1');
  assert.equal(jsRefCount(fnTl.jsStates[4]!, 'o1'), 3);
  const after = fnTl.jsStates[6]!;
  assert.equal(jsRefCount(after, 'o1'), 2);
  assert.equal(after.bindings.s!.live, false);
  assert.equal(Object.keys(fnTl.jsStates[fnTl.steps]!.values).length, 1);
});

test('03：return 只能在函式範圍裡；exit 只能離開最內層', () => {
  assert.equal(checkRust(fnTl.rustStates[1]!, { type: 'return', from: 'a', to: 'b' })?.rule, 'invalid-trace');
  assert.equal(checkRust(fnTl.rustStates[2]!, { type: 'exit', scope: '' })?.rule, 'invalid-trace');
  assert.equal(checkRust(fnTl.rustStates[2]!, { type: 'exit', scope: 'nope' })?.rule, 'invalid-trace');
  assert.equal(
    checkRust(fnTl.rustStates[3]!, { type: 'enter', scope: 'pass', kind: 'fn', label: 'fn pass' })?.rule,
    'invalid-trace',
  );
});

// ---- 04 離開 { } ----

test('04：離開 } 的那一步，Rust 內層的值當場碎掉，外層的值不受影響', () => {
  const before = scopeTl.rustStates[4]!;
  assert.equal(before.scopeOf.b, 'inner');
  assert.equal(before.scopes.inner?.kind, 'block');
  assert.equal(before.values.v2?.alive, true);
  assert.equal(scopeTl.frames[4]!.get('rust:frame:inner')!.n.dash, 1);

  const after = scopeTl.rustStates[5]!;
  assert.equal(after.values.v2?.alive, false);
  assert.equal(after.values.v1?.alive, true);
  assert.equal(after.bindings.b?.state, 'gone');
  assert.equal(checkRust(after, use('b'))?.rule, 'out-of-scope');
  assert.equal(checkRust(after, use('a')), null);
  assert.equal(scopeTl.frames[5]!.has('rust:frame:inner'), false);

  const mid = find(stateAt(scopeTl, 4.5), 'rust:val:v2').n;
  assert.ok(mid.shatter > 0 && mid.shatter < 1);
});

test('04：JS 的球在 GC 事件之前仍然存在，只是沒有線連著', () => {
  const gcStep = scopeTrace.steps.findIndex((s) => s.js.some((ev) => ev.type === 'gc'));
  assert.equal(gcStep, 6);
  // 離開 { } 之後（第 5 步做完）到 GC 之前（第 6 步做完）
  for (const k of [5, 6]) {
    const js = scopeTl.jsStates[k]!;
    assert.ok(js.values.o2, `做完前 ${k} 步，o2 應該還在`);
    assert.equal(jsRefCount(js, 'o2'), 0);
    const orb = tl(scopeTl, k, 'js:orb:o2').n;
    assert.equal(orb.alpha, 1);
    assert.equal(orb.loose, 1);
    // 同一時間 Rust 那邊早就碎了
    assert.equal(scopeTl.rustStates[k]!.values.v2?.alive, false);
  }
  // GC 經過之後才不見；還有線連著的 o1 不受影響
  const after = scopeTl.jsStates[7]!;
  assert.equal(after.values.o2, undefined);
  assert.ok(after.values.o1);
  assert.equal(scopeTl.frames[7]!.has('js:orb:o2'), false);
  assert.equal(scopeTl.frames[7]!.get('js:orb:o1')!.n.alpha, 1);
});

test('04：GC 那一步，掃地機掃到之前球維持原樣，掃過才消失', () => {
  const sweep = scopeTl.sweeps[6];
  assert.ok(sweep);
  assert.deepEqual(sweep.ids, ['js:orb:o2']);
  assert.equal(scopeTl.sweeps.filter(Boolean).length, 1);
  const orbX = tl(scopeTl, 6, 'js:orb:o2').n.x;

  let last = -Infinity;
  let sawBefore = false;
  let sawAfter = false;
  for (let f = 0.05; f < 1; f += 0.05) {
    const visuals = stateAt(scopeTl, 6 + f);
    const gc = find(visuals, JS_GC_ID);
    assert.equal(gc.kind, 'sweeper');
    assert.ok(gc.n.x >= last, '掃地機只往一個方向走');
    last = gc.n.x;
    const orb = find(visuals, 'js:orb:o2').n;
    if (gc.n.x < orbX - 0.5) {
      sawBefore = true;
      assert.equal(orb.swept, 0);
      assert.equal(orb.alpha, 1);
    }
    if (gc.n.x > orbX + 0.5) {
      sawAfter = true;
      assert.equal(orb.swept, 1);
    }
    // 還有線連著的球不會被收
    assert.equal(find(visuals, 'js:orb:o1').n.swept, 0);
  }
  assert.ok(sawBefore && sawAfter);
  // 整數 t 沒有掃地機
  for (let k = 0; k <= scopeTl.steps; k++) {
    assert.equal(stateAt(scopeTl, k).some((v) => v.id === JS_GC_ID), false, `t=${k}`);
  }
});

test('04：main 結束時 Rust 的 a 也碎了，JS 的 o1 留著等下一次 GC', () => {
  const N = scopeTl.steps;
  assert.equal(scopeTl.rustStates[N]!.values.v1?.alive, false);
  assert.ok(scopeTl.jsStates[N]!.values.o1);
  assert.equal(tl(scopeTl, N, 'js:orb:o1').n.loose, 1);
});

// ---- 規則本身 ----

test('離開範圍時照宣告的反序 drop；被搬空的變數不會讓值碎掉', () => {
  const events: RustEvent[] = [
    { type: 'alloc', value: 'v1', label: 'a' },
    { type: 'bind', binding: 'a', value: 'v1' },
    { type: 'enter', scope: 'f', kind: 'fn', label: 'fn f' },
    { type: 'move', from: 'a', to: 'p' },
    { type: 'alloc', value: 'v2', label: 'b' },
    { type: 'bind', binding: 'q', value: 'v2' },
    { type: 'return', from: 'p', to: 'r' },
    { type: 'exit', scope: 'f' },
  ];
  let s = emptyRust();
  for (const ev of events) s = applyRust(s, ev);
  assert.equal(s.values.v1?.alive, true, '回傳出去的值還活著');
  assert.equal(s.values.v1?.owner, 'r');
  assert.equal(s.values.v2?.alive, false, '留在函式裡的值碎了');
  assert.equal(s.scopeOf.r, '');
  assert.deepEqual(s.scopes.f?.bindings, ['p', 'q']);
  assert.equal(s.scopes.f?.open, false);
});

test('不合法的 JS 軌跡會丟錯：primitive 不能共享、物件不能 copy', () => {
  const step = (js: Trace['steps'][number]['js']): Trace['steps'][number] => ({
    rustLine: null, tsLine: null, caption: { js: '', rust: '' }, js, rust: [],
  });
  const sharePrim: Trace = {
    steps: [
      step([
        { type: 'alloc', value: 'n1', label: '5', prim: true },
        { type: 'bind', binding: 'x', value: 'n1' },
        { type: 'bind', binding: 'y', value: 'n1' },
      ]),
    ],
  };
  assert.throws(() => buildTimeline(sharePrim), /primitive/);
  const copyObject: Trace = {
    steps: [
      step([
        { type: 'alloc', value: 'o1', label: '{}' },
        { type: 'bind', binding: 'x', value: 'o1' },
        { type: 'copy', from: 'x', to: 'y', value: 'o2' },
      ]),
    ],
  };
  assert.throws(() => buildTimeline(copyObject), /不是 primitive/);
});
