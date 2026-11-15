// 借用區（第 5–9 頁）：借用的規則、光束的畫面、五頁軌跡。

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { trace as shared } from '../pages/05-shared-borrow/trace.ts';
import { breakIt as mutBreak, trace as mutTrace } from '../pages/06-mut-borrow/trace.ts';
import { trace as nll } from '../pages/07-nll/trace.ts';
import { breakIt as danglingBreak, trace as dangling } from '../pages/08-dangling/trace.ts';
import { trace as slices } from '../pages/09-slices/trace.ts';
import { breakRange, buildTimeline, stateAt, type Visual } from './timeline.ts';
import type { RustEvent, Trace } from './trace.ts';
import { applyRust, checkRust, emptyRust, liveBorrows, type RustState } from './worlds.ts';

const PAGES: [string, Trace][] = [
  ['05-shared-borrow', shared],
  ['06-mut-borrow', mutTrace],
  ['07-nll', nll],
  ['08-dangling', dangling],
  ['09-slices', slices],
];

function find(visuals: Visual[], id: string): Visual {
  const v = visuals.find((x) => x.id === id);
  assert.ok(v, `畫面裡找不到 ${id}`);
  return v;
}

const run = (events: RustEvent[]): RustState => events.reduce(applyRust, emptyRust());

/** s 握著 v1 */
const OWNED: RustEvent[] = [
  { type: 'alloc', value: 'v1', label: '"hello"' },
  { type: 'bind', binding: 's', value: 'v1' },
];

test('多道 & 可以同時存在，值仍握在擁有者手上', () => {
  const tl = buildTimeline(shared);
  const s = tl.rustStates[3]!;
  assert.deepEqual(liveBorrows(s, 'v1'), ['r1', 'r2']);
  assert.deepEqual(s.bindings.s, { state: 'owns', value: 'v1' });
  assert.equal(s.values.v1?.owner, 's');

  const frame = tl.frames[3]!;
  for (const r of ['r1', 'r2']) {
    const beam = frame.get(`rust:beam:${r}`)!;
    assert.equal(beam.kind, 'beam');
    assert.equal(beam.ref, 'rust:val:v1');
    assert.equal(beam.n.lit, 1);
    assert.equal(beam.n.solid, 0, '& 是半透明');
    assert.deepEqual([beam.n.r0, beam.n.r1], [0, 1], '照到整顆值');
    assert.equal(frame.get(`rust:lens:${r}`)?.kind, 'lens');
  }
  // 光束的終點就是值的位置
  const val = frame.get('rust:val:v1')!.n;
  const beam = frame.get('rust:beam:r1')!.n;
  assert.deepEqual([beam.x2, beam.y2], [val.x, val.y]);
});

test('參考變數不佔夾具的位置：擁有者只有一個時仍在正中間', () => {
  const tl = buildTimeline(shared);
  const frame = tl.frames[3]!;
  assert.equal(frame.get('rust:claw:s')!.n.x, 0);
  assert.equal(frame.has('rust:claw:r1'), false);
  assert.ok(frame.get('rust:lens:r1')!.n.y > frame.get('rust:claw:s')!.n.y, '燈排在夾具上方');
});

test('& 亮著時 &mut 被擋下，規則與第 6 頁的 breakIt 一致', () => {
  const s = run([...OWNED, { type: 'borrow', binding: 'r', of: 's' }]);
  const bad = checkRust(s, { type: 'borrow', binding: 'm', of: 's', mut: true });
  assert.equal(bad?.rule, 'mut-while-shared');
  assert.equal(bad?.rule, mutBreak.rule);
  assert.equal(mutBreak.expect, 'E0502');

  const tl = buildTimeline(mutTrace);
  assert.deepEqual(breakRange(tl, mutBreak), { from: 2, to: 2 }, '只有 & 還亮著的那一刻可以弄壞');
  assert.ok(tl.frames[2]!.has(mutBreak.at), '力場要出現的物件在畫面上');
});

test('借用結束後可以再借 &mut', () => {
  const s = run([
    ...OWNED,
    { type: 'borrow', binding: 'r', of: 's' },
    { type: 'use', binding: 'r' },
    { type: 'release', binding: 'r' },
  ]);
  assert.deepEqual(liveBorrows(s, 'v1'), []);
  assert.equal(checkRust(s, { type: 'borrow', binding: 'm', of: 's', mut: true }), null);
  // 結束之後不能再透過它用值
  assert.equal(checkRust(s, { type: 'use', binding: 'r' })?.rule, 'invalid-trace');

  // 第 6 頁：r 熄滅之後，同一個嘗試就不再被擋
  const tl = buildTimeline(mutTrace);
  assert.equal(checkRust(tl.rustStates[3]!, mutBreak.attempt), null);
});

test('&mut 亮著時：不能再借、擁有者不能讀，也不能透過 & 改值', () => {
  const s = run([...OWNED, { type: 'borrow', binding: 'm', of: 's', mut: true }]);
  assert.equal(checkRust(s, { type: 'borrow', binding: 'r', of: 's' })?.rule, 'borrow-while-mut');
  assert.equal(checkRust(s, { type: 'borrow', binding: 'm2', of: 's', mut: true })?.rule, 'borrow-while-mut');
  assert.equal(checkRust(s, { type: 'use', binding: 's' })?.rule, 'use-while-mut');
  assert.equal(checkRust(s, { type: 'mutate', binding: 's', label: 'x' })?.rule, 'mutate-while-borrowed');
  assert.equal(checkRust(s, { type: 'mutate', binding: 'm', label: 'x' }), null);

  const shared1 = run([...OWNED, { type: 'borrow', binding: 'r', of: 's' }]);
  assert.equal(checkRust(shared1, { type: 'mutate', binding: 'r', label: 'x' })?.rule, 'mutate-through-shared');
  assert.equal(checkRust(shared1, { type: 'use', binding: 's' }), null, '& 亮著時擁有者照樣能讀');
});

test('借用亮著時不能 move 或 drop 被借的值；熄滅之後可以', () => {
  const lit = run([...OWNED, { type: 'borrow', binding: 'r', of: 's' }]);
  assert.equal(checkRust(lit, { type: 'move', from: 's', to: 't' })?.rule, 'move-while-borrowed');
  assert.equal(checkRust(lit, { type: 'drop', binding: 's' })?.rule, 'move-while-borrowed');
  assert.equal(checkRust(lit, { type: 'drop', binding: 'r' }), null, '參考變數自己可以先離開');

  const out = applyRust(lit, { type: 'release', binding: 'r' });
  assert.equal(checkRust(out, { type: 'move', from: 's', to: 't' }), null);
  assert.equal(checkRust(out, { type: 'drop', binding: 's' }), null);

  // 參考變數離開 scope，借用跟著消失
  const gone = applyRust(lit, { type: 'drop', binding: 'r' });
  assert.deepEqual(gone.borrows, {});
  assert.equal(checkRust(gone, { type: 'move', from: 's', to: 't' }), null);
});

test('第 8 頁：回傳指向區域值的參考被擋下', () => {
  const tl = buildTimeline(dangling);
  const bad = checkRust(tl.rustStates[2]!, danglingBreak.attempt);
  assert.equal(bad?.rule, 'dangling-ref');
  assert.equal(bad?.rule, danglingBreak.rule);
  assert.equal(danglingBreak.expect, 'E0515');
  assert.deepEqual(breakRange(tl, danglingBreak), { from: 2, to: 2 });
  assert.ok(tl.frames[2]!.has(danglingBreak.at));
  // 值搬出去之後 s 只是空殼，擋下的理由就不是懸空了
  assert.equal(checkRust(tl.rustStates[3]!, danglingBreak.attempt)?.rule, 'use-after-move');
});

test('回傳的參考指向函式外面的值就合法；範圍結束時外面的光束不能還照著裡面的值', () => {
  const inFn = run([...OWNED, { type: 'enter', scope: 'f', kind: 'fn', label: 'fn f' }]);
  assert.equal(checkRust(inFn, { type: 'return-ref', of: 's', to: 'r' }), null);
  const back = applyRust(inFn, { type: 'return-ref', of: 's', to: 'r' });
  assert.equal(back.scopeOf.r, '', 'r 宣告在呼叫端');
  assert.deepEqual(liveBorrows(back, 'v1'), ['r']);

  const leak = run([
    ...OWNED,
    { type: 'borrow', binding: 'outer', of: 's' },
    { type: 'release', binding: 'outer' },
    { type: 'drop', binding: 'outer' },
    { type: 'enter', scope: 'b', kind: 'block', label: '{ }' },
    { type: 'alloc', value: 'v2', label: '"inner"' },
    { type: 'bind', binding: 'x', value: 'v2' },
  ]);
  // 內層自己的參考跟著一起離開，沒問題
  const own = applyRust(leak, { type: 'borrow', binding: 'rx', of: 'x' });
  assert.equal(checkRust(own, { type: 'exit', scope: 'b' }), null);
  assert.deepEqual(applyRust(own, { type: 'exit', scope: 'b' }).borrows, {});
});

for (const [name, trace] of PAGES) {
  test(`${name}：stateAt 在整數 t 與快照嚴格相等`, () => {
    const tl = buildTimeline(trace);
    assert.equal(tl.frames.length, tl.steps + 1);
    for (let k = 0; k <= tl.steps; k++) {
      const frame = tl.frames[k]!;
      const got = stateAt(tl, k);
      for (const [id, v] of frame) {
        const g = find(got, id);
        assert.deepStrictEqual(g.n, v.n, `t=${k} 的 ${id}`);
        assert.equal(g.label, v.label, `t=${k} 的 ${id} 的標籤`);
        assert.equal(g.kind, v.kind);
      }
      for (const v of got) {
        if (!frame.has(v.id)) assert.equal(v.n.alpha, 0, `t=${k} 的 ${v.id} 不該看得見`);
        assert.equal(v.n.pulse, 0, `t=${k} 的 ${v.id} 不該脈動`);
      }
    }
  });

  test(`${name}：字幕 30 字以內，內容維持在 x ±2.6 內`, () => {
    const tl = buildTimeline(trace);
    trace.steps.forEach((step, i) => {
      for (const text of [step.caption.js, step.caption.rust]) {
        assert.ok([...text].length <= 30, `第 ${i + 1} 步的字幕太長（${[...text].length} 字）：${text}`);
      }
    });
    for (const frame of tl.frames) {
      for (const v of frame.values()) {
        const half = v.kind === 'frame' ? v.n.w / 2 : 0;
        assert.ok(Math.abs(v.n.x) + half <= tl.bounds.halfX, `${v.id} 超出範圍：x=${v.n.x}`);
        assert.ok(v.n.y < tl.bounds.y1 && v.n.y > tl.bounds.y0, `${v.id} 超出範圍：y=${v.n.y}`);
      }
    }
  });
}

test('光束在熄滅那一步中途的亮度介於 0 與 1 之間，而且可以倒著拖', () => {
  // 第 5 頁：第 4 步（t 3→4）兩道光束熄滅
  const tl5 = buildTimeline(shared);
  for (const r of ['r1', 'r2']) {
    assert.equal(find(stateAt(tl5, 3), `rust:beam:${r}`).n.lit, 1);
    const mid = find(stateAt(tl5, 3.5), `rust:beam:${r}`).n;
    assert.ok(mid.lit > 0 && mid.lit < 1, `lit=${mid.lit}`);
    assert.equal(mid.alpha, 1, '熄滅靠 lit，不是整個物件淡出');
    assert.ok(mid.pulse > 0, '同一步也是最後一次使用');
    assert.equal(find(stateAt(tl5, 4), `rust:beam:${r}`).n.lit, 0);
    assert.equal(find(stateAt(tl5, 4), `rust:lens:${r}`).n.lit, 0, '燈跟著熄');
  }
  // 純函式：同一個 t 不管從哪邊拖過來都一樣
  assert.deepEqual(stateAt(tl5, 3.5), stateAt(tl5, 3.5));
  const lits = [3, 3.25, 3.5, 3.75, 4].map((t) => find(stateAt(tl5, t), 'rust:beam:r1').n.lit);
  for (let i = 1; i < lits.length; i++) assert.ok(lits[i]! < lits[i - 1]!, `亮度應該遞減：${lits}`);

  // 第 7 頁：熄滅獨立成第 5 步（t 4→5），最後一次使用那一步光束還全亮
  const tl7 = buildTimeline(nll);
  assert.equal(find(stateAt(tl7, 4), 'rust:beam:r1').n.lit, 1);
  const mid7 = find(stateAt(tl7, 4.5), 'rust:beam:r2').n.lit;
  assert.ok(mid7 > 0 && mid7 < 1);
  assert.equal(find(stateAt(tl7, 5), 'rust:beam:r1').n.lit, 0);
  assert.ok(tl7.frames[5]!.has('rust:lens:r1'), '光束熄了，變數還在 scope 裡');
  // JS 那邊的線還連著
  assert.equal(tl7.frames[5]!.get('js:link:r1')?.n.grow, 1);
});

test('光束亮起的那一步：亮度從 0 內插到 1', () => {
  const tl = buildTimeline(mutTrace);
  const mid = find(stateAt(tl, 3.5), 'rust:beam:m').n;
  assert.ok(mid.lit > 0 && mid.lit < 1 && mid.alpha > 0 && mid.alpha < 1);
  const on = find(stateAt(tl, 4), 'rust:beam:m').n;
  assert.deepEqual([on.lit, on.solid], [1, 1], '&mut 是實心的');
  assert.equal(find(stateAt(tl, 4), 'rust:beam:r').n.lit, 0, '& 早就熄了，兩道不會同時亮');
});

test('改值：兩個世界的標籤都在那一步的中途換掉，往回拖會換回來', () => {
  const tl = buildTimeline(mutTrace);
  const label = (t: number, id: string) => find(stateAt(tl, t), id).label;
  assert.equal(label(4, 'rust:val:v1'), '"hello"');
  assert.equal(label(4.25, 'rust:val:v1'), '"hello"');
  assert.equal(label(4.75, 'rust:val:v1'), '"hello world"');
  assert.equal(label(5, 'rust:val:v1'), '"hello world"');
  assert.equal(label(4, 'js:orb:o1'), '{ text: "hello" }');
  assert.equal(label(5, 'js:orb:o1'), '{ text: "hello world" }');
  // 同一顆值被改，不是新值
  assert.deepEqual(Object.keys(tl.rustStates[5]!.values), ['v1']);
  assert.deepEqual(Object.keys(tl.jsStates[5]!.values), ['o1']);
  assert.ok(find(stateAt(tl, 4.5), 'rust:beam:m').n.pulse > 0);
  assert.ok(find(stateAt(tl, 4.5), 'js:link:m').n.pulse > 0);
});

test('slice：光束只照到值的一段；Rust 全程兩個值，JS 做出新的值', () => {
  const tl = buildTimeline(slices);
  const hello = tl.frames[2]!.get('rust:beam:hello')!;
  assert.equal(hello.ref, 'rust:val:v1');
  assert.deepEqual([hello.n.r0, hello.n.r1], [0, 5 / 11]);
  const mid = tl.frames[5]!.get('rust:beam:mid')!;
  assert.equal(mid.ref, 'rust:val:v2');
  assert.deepEqual([mid.n.r0, mid.n.r1], [1 / 5, 3 / 5]);

  assert.deepEqual(Object.keys(tl.rustStates[6]!.values), ['v1', 'v2']);
  assert.deepEqual(Object.keys(tl.jsStates[6]!.values), ['p1', 'p2', 'o1', 'o2']);
  assert.equal(checkRust(emptyRust(), { type: 'alloc', value: 'v', label: '' }), null);
  const s = run(OWNED);
  assert.equal(checkRust(s, { type: 'borrow', binding: 'r', of: 's', part: [0.5, 0.2] })?.rule, 'invalid-trace');
});

test('第 8 頁：JS 的回傳讓呼叫端的 r 連到同一顆球，函式結束後球仍有線連著', () => {
  const tl = buildTimeline(dangling);
  assert.equal(tl.jsStates[3]!.scopeOf.r, '');
  assert.equal(tl.jsStates[4]!.bindings.r?.value, 'o1');
  assert.equal(tl.frames[4]!.get('js:orb:o1')?.n.loose, 0);
  // Rust：值整顆搬到 r，沒有任何光束
  assert.deepEqual(tl.rustStates[4]!.bindings.r, { state: 'owns', value: 'v1' });
  assert.ok([...tl.frames.flatMap((f) => [...f.values()])].every((v) => v.kind !== 'beam'));
});
