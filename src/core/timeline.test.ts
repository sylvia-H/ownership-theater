import assert from 'node:assert/strict';
import { test } from 'node:test';

import { trace } from '../pages/01-move/trace.ts';
import { buildTimeline, idsForLine, linesForId, stateAt, type Visual } from './timeline.ts';
import type { Trace } from './trace.ts';
import { jsRefCount } from './worlds.ts';

const tl = buildTimeline(trace);
const N = tl.steps;

function find(visuals: Visual[], id: string): Visual {
  const v = visuals.find((x) => x.id === id);
  assert.ok(v, `畫面裡找不到 ${id}`);
  return v;
}

test('做完第 2 步：Rust 的 a 被搬空、b 握著 v1；JS 的 a、b 都連到 o1', () => {
  const rust = tl.rustStates[2]!;
  assert.deepEqual(rust.bindings.a, { state: 'moved', value: null });
  assert.deepEqual(rust.bindings.b, { state: 'owns', value: 'v1' });
  assert.equal(rust.values.v1?.owner, 'b');

  const js = tl.jsStates[2]!;
  assert.deepEqual(js.bindings.a, { live: true, value: 'o1' });
  assert.deepEqual(js.bindings.b, { live: true, value: 'o1' });
  assert.equal(jsRefCount(js, 'o1'), 2);
});

test('做完全部：Rust 的值碎了；JS 的值還在，只是沒有線連著', () => {
  assert.equal(tl.rustStates[N]!.values.v1?.alive, false);

  const js = tl.jsStates[N]!;
  assert.ok(js.values.o1, 'o1 應該還在');
  assert.equal(jsRefCount(js, 'o1'), 0);
  assert.equal(tl.frames[N]!.get('js:orb:o1')?.n.loose, 1);
});

test('stateAt 在整數 t 與快照 frames[k] 一致', () => {
  assert.equal(tl.frames.length, N + 1);
  for (let k = 0; k <= N; k++) {
    const frame = tl.frames[k]!;
    const got = stateAt(tl, k);
    for (const [id, v] of frame) {
      assert.deepEqual(find(got, id).n, v.n, `t=${k} 的 ${id}`);
    }
    // 不在這張快照裡的物件（下一步才出現、或這一步剛消失）必須是看不見的
    for (const v of got) {
      if (!frame.has(v.id)) assert.equal(v.n.alpha, 0, `t=${k} 的 ${v.id} 不該看得見`);
    }
  }
});

test('move 演到一半：值在 a、b 兩個欄位之間，而且飛行抬高', () => {
  const ax = tl.frames[1]!.get('rust:claw:a')!.n.x;
  const bx = tl.frames[2]!.get('rust:claw:b')!.n.x;
  assert.ok(ax < bx);

  const val = find(stateAt(tl, 1.5), 'rust:val:v1').n;
  assert.ok(val.x > ax && val.x < bx, `x=${val.x} 應該介於 ${ax} 與 ${bx}`);
  assert.ok(val.y > 0, `y=${val.y} 應該高於 0`);
  assert.ok(val.flight > 0);
});

test('stateAt 是純函式，t 超出範圍會被夾住', () => {
  const direct = stateAt(buildTimeline(trace), 1.5);
  stateAt(tl, 4.7);
  stateAt(tl, 0.2);
  assert.deepEqual(stateAt(tl, 1.5), direct);

  assert.deepEqual(stateAt(tl, -1), stateAt(tl, 0));
  assert.deepEqual(stateAt(tl, 99), stateAt(tl, N));
});

test('use 那一步演到一半會脈動，整數 t 不脈動', () => {
  const mid = stateAt(tl, 2.5);
  assert.ok(find(mid, 'rust:claw:b').n.pulse > 0);
  assert.ok(find(mid, 'rust:val:v1').n.pulse > 0);

  for (let k = 0; k <= N; k++) {
    for (const v of stateAt(tl, k)) assert.equal(v.n.pulse, 0, `t=${k} 的 ${v.id}`);
  }
});

test('最後一步演到一半：值正在碎', () => {
  const shatter = find(stateAt(tl, 4.5), 'rust:val:v1').n.shatter;
  assert.ok(shatter > 0 && shatter < 1, `shatter=${shatter}`);
});

test('程式碼行與畫面物件互相對得上', () => {
  const ids = idsForLine(tl, trace, 'rust', 3);
  for (const id of ['rust:claw:a', 'rust:claw:b', 'rust:val:v1']) {
    assert.ok(ids.includes(id), `Rust 第 3 行應該包含 ${id}`);
  }

  const hit = linesForId(tl, trace, 'js:orb:o1');
  assert.equal(hit.lang, 'ts');
  for (const line of [2, 3, 4, 5]) {
    assert.ok(hit.lines.includes(line), `js:orb:o1 應該對到第 ${line} 行`);
  }
});

test('以 move 收尾的軌跡：stateAt(tl, N) 與 frames[N] 嚴格相等', () => {
  const endsWithMove: Trace = {
    steps: [
      {
        rustLine: 1,
        tsLine: null,
        caption: { js: '', rust: '' },
        js: [],
        rust: [
          { type: 'alloc', value: 'v1', label: '"hello"' },
          { type: 'bind', binding: 'a', value: 'v1' },
        ],
      },
      {
        rustLine: 2,
        tsLine: null,
        caption: { js: '', rust: '' },
        js: [],
        rust: [{ type: 'move', from: 'a', to: 'b' }],
      },
    ],
  };
  const t2 = buildTimeline(endsWithMove);
  const last = t2.frames[t2.steps]!;
  const got = stateAt(t2, t2.steps);

  // 前提：最後一步真的讓值換了位置，而且演到一半時有在飛
  assert.notEqual(t2.frames[t2.steps - 1]!.get('rust:val:v1')!.n.x, last.get('rust:val:v1')!.n.x);
  assert.ok(find(stateAt(t2, t2.steps - 0.5), 'rust:val:v1').n.flight > 0);

  assert.equal(got.length, last.size);
  for (const [id, v] of last) {
    const n = find(got, id).n;
    for (const key of Object.keys(v.n) as (keyof typeof v.n)[]) {
      assert.ok(Object.is(n[key], v.n[key]), `${id} 的 ${key}：${n[key]} 應該等於 ${v.n[key]}`);
    }
  }
  const val = find(got, 'rust:val:v1').n;
  assert.equal(val.flight, 0);
  assert.equal(val.y, 0);
  assert.equal(val.pulse, 0);
});

test('不合法的軌跡會丟錯', () => {
  const step = (rust: Trace['steps'][number]['rust']): Trace['steps'][number] => ({
    rustLine: null,
    tsLine: null,
    caption: { js: '', rust: '' },
    js: [],
    rust,
  });
  const useAfterMove: Trace = {
    steps: [
      step([
        { type: 'alloc', value: 'v1', label: '"hello"' },
        { type: 'bind', binding: 'a', value: 'v1' },
      ]),
      step([{ type: 'move', from: 'a', to: 'b' }]),
      step([{ type: 'use', binding: 'a' }]),
    ],
  };
  assert.throws(() => buildTimeline(useAfterMove), /use-after-move/);

  const useUndeclared: Trace = { steps: [step([{ type: 'use', binding: 'zzz' }])] };
  assert.throws(() => buildTimeline(useUndeclared), /undeclared/);
});
