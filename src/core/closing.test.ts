// 收尾區（第 13–17 頁）：生命週期、管線（迭代器）、共享擁有（Rc）、執行期借用（RefCell），以及五頁軌跡。

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { breakIt as lifetimesBreak, trace as lifetimes } from '../pages/13-lifetimes/trace.ts';
import { breakIt as iteratorsBreak, trace as iterators } from '../pages/14-iterators/trace.ts';
import { breakIt as rcBreak, trace as rc } from '../pages/15-rc/trace.ts';
import { breakIt as refcellBreak, trace as refcell } from '../pages/16-refcell/trace.ts';
import { breakIt as rcRefcellBreak, trace as rcRefcell } from '../pages/17-rc-refcell/trace.ts';
import {
  breakRange,
  buildTimeline,
  rustBeamId,
  rustClawId,
  rustCountId,
  rustLensId,
  rustPipeId,
  rustShareId,
  rustTetherId,
  rustValId,
  RUST_FLOW_ID,
  stateAt,
  type Visual,
} from './timeline.ts';
import type { RustEvent, Trace } from './trace.ts';
import { applyRust, checkRust, emptyRust, liveBorrows, rcCount, type RustState } from './worlds.ts';

const PAGES: [string, Trace][] = [
  ['13-lifetimes', lifetimes],
  ['14-iterators', iterators],
  ['15-rc', rc],
  ['16-refcell', refcell],
  ['17-rc-refcell', rcRefcell],
];

function find(visuals: Visual[], id: string): Visual {
  const v = visuals.find((x) => x.id === id);
  assert.ok(v, `畫面裡找不到 ${id}`);
  return v;
}

const run = (events: RustEvent[]): RustState => events.reduce(applyRust, emptyRust());

const RC: RustEvent[] = [
  { type: 'alloc', value: 'v1', label: '"hello"', rc: true },
  { type: 'bind', binding: 'a', value: 'v1' },
];
const CELL: RustEvent[] = [
  { type: 'alloc', value: 'v1', label: '[1, 2]', cell: true },
  { type: 'bind', binding: 'cell', value: 'v1' },
];
const PIPE: RustEvent[] = [
  { type: 'alloc', value: 'v1', label: '[1, 2, 3]' },
  { type: 'bind', binding: 'v', value: 'v1' },
  { type: 'pipe', id: 'p', binding: 'doubled', of: 'v', stage: 'map ×2' },
  { type: 'pipe-extend', pipe: 'p', to: 'big', stage: 'filter >2' },
];

// ---- 共享擁有（Rc） ----

test('Rc：share 讓計數加一，值沒有被複製，原本的擁有者仍然有效', () => {
  const one = run(RC);
  assert.equal(rcCount(one, 'v1'), 1);
  assert.deepEqual(one.bindings.a, { state: 'shares', value: 'v1' });
  const two = applyRust(one, { type: 'share', from: 'a', to: 'b' });
  assert.equal(rcCount(two, 'v1'), 2);
  assert.deepEqual(Object.keys(two.values), ['v1']);
  assert.equal(checkRust(two, { type: 'use', binding: 'a' }), null);
  assert.equal(checkRust(two, { type: 'use', binding: 'b' }), null);
  // 不是 Rc 的值不能 share，也沒有計數
  const plain = run([{ type: 'alloc', value: 'v1', label: 'x' }, { type: 'bind', binding: 'a', value: 'v1' }]);
  assert.equal(rcCount(plain, 'v1'), null);
  assert.equal(checkRust(plain, { type: 'share', from: 'a', to: 'b' })?.rule, 'invalid-trace');
});

test('Rc：擁有者離開計數減一，歸零才 drop（不論是 drop 還是範圍結束）', () => {
  let s = run([...RC, { type: 'enter', scope: 'inner', kind: 'block', label: '{ }' }, { type: 'share', from: 'a', to: 'b' }]);
  assert.equal(rcCount(s, 'v1'), 2);
  s = applyRust(s, { type: 'exit', scope: 'inner' });
  assert.equal(rcCount(s, 'v1'), 1);
  assert.equal(s.values.v1?.alive, true);
  assert.equal(s.bindings.b?.state, 'gone');
  s = applyRust(s, { type: 'drop', binding: 'a' });
  assert.equal(rcCount(s, 'v1'), 0);
  assert.equal(s.values.v1?.alive, false);
  // 順序反過來也一樣：先丟 a，值還被 b 擁有
  const other = applyRust(applyRust(run(RC), { type: 'share', from: 'a', to: 'b' }), { type: 'drop', binding: 'a' });
  assert.equal(other.values.v1?.alive, true);
  assert.equal(checkRust(other, { type: 'use', binding: 'b' }), null);
  assert.equal(checkRust(other, { type: 'use', binding: 'a' })?.rule, 'out-of-scope');
});

test('第 15 頁：計數 1 → 2 → 1 → 0，畫面上的線與計數標示跟著走，值到最後一步才碎', () => {
  const tl = buildTimeline(rc);
  assert.deepEqual(tl.rustStates.map((s) => rcCount(s, 'v1')), [null, 1, 2, 2, 1, 1, 0]);
  assert.deepEqual(tl.rustStates.map((s) => s.values.v1?.alive ?? null), [null, true, true, true, true, true, false]);
  const at2 = stateAt(tl, 2);
  assert.equal(find(at2, rustCountId('v1')).label, '計數 2');
  // 兩條線都是 link（和 JS 的線同一種畫面物件），連到同一顆值
  for (const name of ['a', 'b']) {
    const link = find(at2, rustShareId(name));
    assert.equal(link.kind, 'link');
    assert.equal(link.world, 'rust');
    assert.equal(link.ref, rustValId('v1'));
  }
  // 擁有者的夾具沒有夾東西
  assert.equal(find(at2, rustClawId('a')).n.grip, 0);
  assert.equal(find(stateAt(tl, 4), rustCountId('v1')).label, '計數 1');
  assert.equal(stateAt(tl, 4).some((v) => v.id === rustShareId('b')), false);
  assert.equal(find(stateAt(tl, 4), rustValId('v1')).n.shatter, 0);
  assert.equal(find(stateAt(tl, 6), rustValId('v1')).n.shatter, 1);
  assert.equal(find(stateAt(tl, 6), rustCountId('v1')).label, '計數 0');
  assert.equal(rcBreak, null);
});

// ---- 執行期借用（RefCell） ----

test('RefCell：同時兩個可變借用被執行期的規則擋下，規則名與第 16 頁的 breakIt.rule 一致', () => {
  const s = applyRust(run(CELL), { type: 'cell-borrow', binding: 'w', of: 'cell', mut: true });
  assert.equal(s.borrows.w?.runtime, true);
  const again = checkRust(s, { type: 'cell-borrow', binding: 'w2', of: 'cell', mut: true });
  assert.equal(again?.rule, 'refcell-already-borrowed');
  assert.equal(refcellBreak.rule, 'refcell-already-borrowed');
  assert.equal(refcellBreak.expect, 'panic');
  // 可變借用亮著時，共享的也不行；一行之內借了就還的也一樣
  assert.equal(checkRust(s, { type: 'cell-borrow', binding: 'r', of: 'cell' })?.rule, 'refcell-already-borrowed');
  assert.equal(checkRust(s, { type: 'cell-use', via: 'cell' })?.rule, 'refcell-already-borrowed');
  // 這條規則和編譯期的借用規則是分開的名字
  assert.notEqual(again?.rule, 'borrow-while-mut');
});

test('RefCell：守衛不適用 NLL（不能 release），drop 歸還之後可以再借；兩道共享的可以並存', () => {
  const s = applyRust(run(CELL), { type: 'cell-borrow', binding: 'w', of: 'cell', mut: true });
  assert.equal(checkRust(s, { type: 'release', binding: 'w' })?.rule, 'invalid-trace');
  const back = applyRust(s, { type: 'drop', binding: 'w' });
  assert.deepEqual(liveBorrows(back, 'v1'), []);
  assert.equal(checkRust(back, { type: 'cell-borrow', binding: 'w2', of: 'cell', mut: true }), null);
  const shared = applyRust(run(CELL), { type: 'cell-borrow', binding: 'r1', of: 'cell' });
  assert.equal(checkRust(shared, { type: 'cell-borrow', binding: 'r2', of: 'cell' }), null);
  assert.equal(checkRust(shared, { type: 'cell-borrow', binding: 'w', of: 'cell', mut: true })?.rule, 'refcell-already-borrowed');
  // 不是 RefCell 的值不能在執行期借
  const plain = run([{ type: 'alloc', value: 'v1', label: 'x' }, { type: 'bind', binding: 'a', value: 'v1' }]);
  assert.equal(checkRust(plain, { type: 'cell-borrow', binding: 'w', of: 'a' })?.rule, 'invalid-trace');
});

test('第 16 頁：只有 w 還沒歸還的那兩步可以弄壞；殼的登記燈跟著守衛亮滅', () => {
  const tl = buildTimeline(refcell);
  assert.deepEqual(breakRange(tl, refcellBreak), { from: 2, to: 3 });
  const lent = (k: number) => find(stateAt(tl, k), rustValId('v1')).n.lent;
  assert.deepEqual([1, 2, 3, 4, 5, 7].map(lent), [0, 1, 1, 0, 1, 1]);
  assert.equal(find(stateAt(tl, 1), rustValId('v1')).n.cell, 1);
  assert.equal(find(stateAt(tl, 2), rustBeamId('w')).n.solid, 1);
  assert.equal(stateAt(tl, 4).some((v) => v.id === rustLensId('w')), false);
  assert.equal(find(stateAt(tl, 6), rustValId('v1')).label, '[1, 2, 3, 4]');
  // 弄壞它的力場出現在畫面上存在的物件
  for (let k = 2; k <= 3; k++) assert.ok(tl.frames[k]!.has(refcellBreak.at));
});

test('第 17 頁：透過任何一個擁有者都能借來改；光束只在那一步中途出現，整數 t 的快照裡沒有', () => {
  const tl = buildTimeline(rcRefcell);
  assert.equal(rcRefcellBreak, null);
  assert.deepEqual(tl.rustStates.map((s) => rcCount(s, 'v1')), [null, 1, 2, 2, 2, 2, 1, 0]);
  assert.equal(tl.rustStates[3]!.values.v1?.label, '[1, 2, 3]');
  assert.deepEqual(Object.keys(tl.rustStates[3]!.borrows), []);
  for (const [k, solid] of [[2, 1], [3, 0]] as const) {
    assert.equal(stateAt(tl, k).some((v) => v.kind === 'beam'), false);
    const mid = stateAt(tl, k + 0.5);
    const beam = mid.find((v) => v.kind === 'beam');
    assert.ok(beam, `第 ${k + 1} 步中途應該有一道光束`);
    assert.equal(beam.n.solid, solid);
    assert.ok(beam.n.lit > 0.99);
    assert.ok(find(mid, rustValId('v1')).n.lent > 0.99);
    assert.equal(find(stateAt(tl, k + 1), rustValId('v1')).n.lent, 0);
  }
  // 兩個世界長得一樣：下面兩個名字、上面一顆值、兩條線
  const at2 = stateAt(tl, 2);
  const val = find(at2, rustValId('v1'));
  for (const name of ['a', 'b']) {
    assert.ok(find(at2, rustClawId(name)).n.y < val.n.y);
    assert.equal(find(at2, rustShareId(name)).kind, find(at2, `js:link:${name}`).kind);
  }
  assert.equal(find(at2, rustClawId('a')).n.x, find(at2, 'js:tag:a').n.x);
  assert.equal(val.n.x, find(at2, 'js:orb:o1').n.x);
  // 最後一步的字幕點題
  assert.match(rcRefcell.steps.at(-1)!.caption.rust, /預設/);
});

// ---- 生命週期 ----

test('生命週期：綁著的值碎了之後再用參考被 outlives-value 擋下，規則名與第 13 頁的 breakIt.rule 一致', () => {
  const tl = buildTimeline(lifetimes);
  assert.equal(lifetimesBreak.rule, 'outlives-value');
  assert.equal(lifetimesBreak.expect, 'E0597');
  // b 碎掉之後（做完第 7 步）到 result 離開 scope 之前
  assert.deepEqual(breakRange(tl, lifetimesBreak), { from: 7, to: 8 });
  // 光束實際照著 a（v1），而 a 還活著：被擋是因為生命週期也綁著 b
  const s = tl.rustStates[7]!;
  assert.equal(s.borrows.result?.value, 'v1');
  assert.equal(s.values.v1?.alive, true);
  assert.equal(s.values.v2?.alive, false);
  assert.equal(checkRust(s, lifetimesBreak.attempt)?.rule, 'outlives-value');
  for (let k = 7; k <= 8; k++) assert.ok(tl.frames[k]!.has(lifetimesBreak.at));
  // b 還活著的時候用 result 沒問題
  assert.equal(checkRust(tl.rustStates[4]!, lifetimesBreak.attempt), null);
});

test('生命週期：參考還亮著時，它綁著的值不能先碎（範圍結束或 drop 都被擋）', () => {
  const tl = buildTimeline(lifetimes);
  // 做完第 5 步：result 用過了但還沒熄
  const s = tl.rustStates[5]!;
  assert.equal(checkRust(s, { type: 'exit', scope: 'inner' })?.rule, 'outlives-value');
  assert.equal(checkRust(s, { type: 'drop', binding: 'b' })?.rule, 'outlives-value');
  // 熄了之後就可以
  assert.equal(checkRust(tl.rustStates[6]!, { type: 'exit', scope: 'inner' }), null);
});

test('第 13 頁：result 宣告在外層；綁線從 result 拉到 b 的值，跟著光束亮滅', () => {
  const tl = buildTimeline(lifetimes);
  assert.equal(tl.rustStates[2]!.scopeOf.result, '');
  assert.equal(tl.rustStates[4]!.scopeOf.result, '', '指定之後 result 還是外層的變數');
  assert.equal(find(stateAt(tl, 2), rustLensId('result')).n.lit, 0);
  const tether = find(stateAt(tl, 4), rustTetherId('result', 'v2'));
  assert.equal(tether.kind, 'tether');
  assert.equal(tether.label, "'a");
  assert.equal(tether.ref, rustValId('v2'));
  assert.equal(tether.n.lit, 1);
  assert.equal(find(stateAt(tl, 4), rustBeamId('result')).ref, rustValId('v1'));
  assert.equal(find(stateAt(tl, 6), rustTetherId('result', 'v2')).n.lit, 0);
  // 內層結束：b 的值碎掉，result 的燈還在（熄著）
  assert.equal(find(stateAt(tl, 7), rustValId('v2')).n.shatter, 1);
  assert.equal(find(stateAt(tl, 7), rustLensId('result')).n.lit, 0);
});

// ---- 管線（迭代器） ----

test('管線：接上去的時候沒有任何新值；還沒 collect 就不能讓值流過', () => {
  const s = run(PIPE);
  assert.deepEqual(Object.keys(s.values), ['v1']);
  assert.deepEqual(s.pipes.p?.stages, ['map ×2', 'filter >2']);
  assert.equal(s.bindings.doubled?.state, 'moved');
  assert.equal(s.bindings.big?.state, 'pipe');
  assert.equal(checkRust(s, { type: 'use', binding: 'doubled' })?.rule, 'use-after-move');
  assert.equal(checkRust(s, { type: 'pull', pipe: 'p', path: ['1', '2'] })?.rule, 'invalid-trace');
  // 管線借著源頭：這時不能搬走或丟掉 v
  assert.deepEqual(liveBorrows(s, 'v1'), ['big']);
  assert.equal(checkRust(s, { type: 'move', from: 'v', to: 'w' })?.rule, 'move-while-borrowed');
});

test('管線：collect 之後值才流；走完全程的才收進產出的值，流完之後借用結束', () => {
  let s = applyRust(run(PIPE), { type: 'collect', pipe: 'p', to: 'out', value: 'v2', label: '[]' });
  assert.deepEqual(Object.keys(s.values), ['v1', 'v2']);
  assert.equal(s.bindings.big?.state, 'moved');
  // 被擋下的不能改產出的值，走完全程的一定要給
  assert.equal(checkRust(s, { type: 'pull', pipe: 'p', path: ['1', '2'], label: '[2]' })?.rule, 'invalid-trace');
  assert.equal(checkRust(s, { type: 'pull', pipe: 'p', path: ['2', '4', '4'] })?.rule, 'invalid-trace');
  s = applyRust(s, { type: 'pull', pipe: 'p', path: ['1', '2'] });
  assert.equal(s.values.v2?.label, '[]');
  s = applyRust(s, { type: 'pull', pipe: 'p', path: ['2', '4', '4'], label: '[4]' });
  assert.equal(s.values.v2?.label, '[4]');
  assert.equal(checkRust(s, { type: 'drop', binding: 'v' })?.rule, 'move-while-borrowed');
  s = applyRust(s, { type: 'end-pipe', pipe: 'p' });
  assert.deepEqual(liveBorrows(s, 'v1'), []);
  assert.equal(checkRust(s, { type: 'drop', binding: 'v' }), null);
});

test('第 14 頁：產出之前 Rust 沒有任何新值，JS 已經多了兩顆陣列', () => {
  const tl = buildTimeline(iterators);
  assert.equal(iteratorsBreak, null);
  const collectAt = iterators.steps.findIndex((step) => step.rust.some((ev) => ev.type === 'collect'));
  assert.equal(collectAt, 4);
  for (let k = 0; k <= collectAt; k++) {
    assert.deepEqual(Object.keys(tl.rustStates[k]!.values), k === 0 ? [] : ['v1'], `做完前 ${k} 步`);
    assert.equal(stateAt(tl, k).filter((v) => v.world === 'rust' && v.n.alpha > 0 && (v.kind === 'crystal' || v.kind === 'chip')).length, k === 0 ? 0 : 1);
  }
  assert.deepEqual(Object.keys(tl.jsStates[collectAt]!.values), ['o1', 'o2', 'o3']);
  // 管線一段一段接上去
  assert.equal(stateAt(tl, 2).filter((v) => v.kind === 'pipe' && v.n.alpha > 0).length, 1);
  assert.equal(stateAt(tl, 3).filter((v) => v.kind === 'pipe' && v.n.alpha > 0).length, 2);
  assert.equal(find(stateAt(tl, 2.5), rustPipeId('p', 1)).n.grow, 0.5);
  assert.equal(find(stateAt(tl, 3), rustLensId('doubled')).n.lit, 0);
  assert.equal(find(stateAt(tl, 3), rustLensId('big')).n.lit, 1);
  // 產出的值一個一個收：[] → [] → [4] → [4, 6]
  assert.deepEqual([5, 6, 7, 8].map((k) => tl.rustStates[k]!.values.v2?.label), ['[]', '[]', '[4]', '[4, 6]']);
  // 流完之後管線消失
  assert.equal(stateAt(tl, 9).some((v) => v.kind === 'pipe'), false);
});

test('第 14 頁：流過管線的值只在 pull 那一步的中途出現，一路上的樣子照 path 換', () => {
  const tl = buildTimeline(iterators);
  // 第 7 步（做完 6 步之後）：2 → 4 → 4，共三段路
  assert.equal(stateAt(tl, 6).some((v) => v.id === RUST_FLOW_ID), false);
  assert.equal(stateAt(tl, 7).some((v) => v.id === RUST_FLOW_ID), false);
  const early = find(stateAt(tl, 6.15), RUST_FLOW_ID);
  const late = find(stateAt(tl, 6.85), RUST_FLOW_ID);
  assert.equal(early.kind, 'item');
  assert.equal(early.label, '2');
  assert.equal(late.label, '4');
  assert.ok(late.n.x > early.n.x, '從源頭往出口流');
  // 被擋下的只走到擋住它的那一段：終點是 filter 的節點
  const flow = tl.flows[5]!;
  const node = find(stateAt(tl, 5), rustPipeId('p', 1));
  assert.deepEqual(flow.points.at(-1), { x: node.n.x, y: node.n.y });
  assert.equal(flow.points.length, 3);
  assert.equal(tl.flows[6]!.points.length, 4);
  // 往回拖是倒著演：同一個 t 永遠得到同一個畫面
  assert.deepEqual(stateAt(tl, 6.4), stateAt(tl, 6.4));
});

// ---- 五頁共同的檢查 ----

for (const [name, trace] of PAGES) {
  test(`${name}：stateAt 在整數 t 與快照嚴格相等`, () => {
    const tl = buildTimeline(trace);
    assert.equal(tl.steps, trace.steps.length);
    for (let k = 0; k <= tl.steps; k++) {
      const frame = tl.frames[k]!;
      const got = stateAt(tl, k);
      for (const [id, v] of frame) {
        const g = find(got, id);
        assert.deepStrictEqual(g.n, v.n, `t = ${k} 的 ${id}`);
        assert.equal(g.label, v.label, `t = ${k} 的 ${id} 的標籤`);
      }
      // 下一步才出現的物件已經在清單裡，但還看不見
      for (const v of got) {
        if (!frame.has(v.id)) assert.equal(v.n.alpha, 0, `t = ${k} 的 ${v.id} 不該看得見`);
      }
    }
  });

  test(`${name}：字幕 30 字以內，內容在 x ±2.6 內`, () => {
    const tl = buildTimeline(trace);
    for (const [i, step] of trace.steps.entries()) {
      for (const text of [step.caption.js, step.caption.rust]) {
        assert.ok([...text].length <= 30, `第 ${i + 1} 步的字幕太長（${[...text].length} 字）：${text}`);
        assert.ok(text.length > 0);
      }
    }
    assert.equal(tl.bounds.halfX, 2.6);
    for (let t = 0; t <= tl.steps; t += 0.25) {
      for (const v of stateAt(tl, t)) {
        const xs = v.kind === 'frame' ? [v.n.x - v.n.w / 2, v.n.x + v.n.w / 2] : [v.n.x, v.n.x2 === 0 && v.kind !== 'link' ? v.n.x : v.n.x2];
        for (const x of xs) assert.ok(Math.abs(x) <= 2.6, `t = ${t} 的 ${v.id} 超出 x ±2.6（${x}）`);
        assert.ok(v.n.y >= tl.bounds.y0 && v.n.y <= tl.bounds.y1, `t = ${t} 的 ${v.id} 超出高度範圍（${v.n.y}）`);
      }
    }
  });
}
