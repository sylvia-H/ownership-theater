import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTimeline } from '../core/timeline.ts';
import type { RustEvent, Trace } from '../core/trace.ts';
import {
  createTrigger,
  crossedStep,
  MIN_GAP_MS,
  RECIPES,
  SETTLE_MS,
  stepSound,
  type SoundKind,
} from './sound.ts';

test('crossedStep：往前越過中點才算，回傳那一步的索引', () => {
  assert.equal(crossedStep(0, 0.4, 5), -1);
  assert.equal(crossedStep(0.4, 0.6, 5), 0);
  assert.equal(crossedStep(2.2, 2.5, 5), 2, '剛好停在中點算越過');
  assert.equal(crossedStep(2.5, 2.9, 5), -1, '從中點出發不再算一次');
  assert.equal(crossedStep(4.6, 5, 5), -1);
});

test('crossedStep：往回走、沒動都不算', () => {
  assert.equal(crossedStep(0.6, 0.4, 5), -1);
  assert.equal(crossedStep(3, 0, 5), -1);
  assert.equal(crossedStep(1.2, 1.2, 5), -1);
});

test('crossedStep：一次越過很多步只回傳最後一步，而且不超出步數', () => {
  assert.equal(crossedStep(0, 3, 5), 2);
  assert.equal(crossedStep(0.2, 4.7, 5), 4);
  assert.equal(crossedStep(0, 9, 5), 4);
  assert.equal(crossedStep(0, 2.4, 5), 1);
});

test('trigger：初始值不觸發，之後一步一步慢慢走每步各觸發一次', () => {
  const tr = createTrigger(2, 5);
  assert.equal(tr.dueIn(0), -1);
  assert.equal(tr.settle(1000), -1);
  // 下一步按鈕：650 毫秒走一步，每 16 毫秒一格
  const fired: number[] = [];
  let now = 5000;
  for (let step = 2; step < 5; step++) {
    for (let i = 1; i <= 40; i++) {
      const k = tr.move(step + i / 40, (now += 16.25));
      if (k >= 0) fired.push(k);
    }
    now += 400;
  }
  assert.deepEqual(fired, [2, 3, 4]);
  assert.equal(tr.dueIn(now), -1);
});

test('trigger：往回拖不觸發；同一步要先往回拖過中點才會再響', () => {
  const tr = createTrigger(0, 5);
  assert.equal(tr.move(0.7, 1000), 0);
  assert.equal(tr.move(0.9, 1300), -1, '還在同一步裡往前，不重複');
  assert.equal(tr.move(0.6, 1600), -1, '往回但沒過中點');
  assert.equal(tr.move(0.8, 1900), -1);
  assert.equal(tr.move(0.3, 2200), -1, '往回拖過中點');
  assert.equal(tr.move(0.7, 2500), 0, '再往前就再響一次');
  assert.equal(tr.move(3, 2800), 2);
  assert.equal(tr.move(0, 3100), -1, '整段拖回開頭也不出聲');
});

test('trigger：一次跳很多步（沒有補間）只觸發最後一步', () => {
  const tr = createTrigger(0, 6);
  assert.equal(tr.move(4, 1000), 3);
  assert.equal(tr.dueIn(1000), -1);
});

test('trigger：快速掃過好幾步時先不出聲，靜下來才播最後一步', () => {
  const tr = createTrigger(0, 6);
  // 點程式碼行：650 毫秒內從 0 走到 4
  const fired: number[] = [];
  let now = 1000;
  for (let i = 1; i <= 40; i++) {
    const k = tr.move((4 * i) / 40, (now += 16.25));
    if (k >= 0) fired.push(k);
  }
  assert.deepEqual(fired, []);
  assert.equal(tr.settle(now + SETTLE_MS - 20), -1, '還沒靜下來');
  assert.ok(tr.dueIn(now + SETTLE_MS - 20) > 0);
  assert.equal(tr.settle(now + SETTLE_MS), 3);
  assert.equal(tr.settle(now + SETTLE_MS + 500), -1, '只播一次');
  assert.equal(tr.dueIn(now + SETTLE_MS + 500), -1);
});

test('trigger：掃過之後又往回拖過那一步的中點，就取消', () => {
  const tr = createTrigger(0, 6);
  let now = 1000;
  for (let i = 1; i <= 10; i++) tr.move(i * 0.3, (now += 16));
  assert.ok(tr.dueIn(now) >= 0);
  tr.move(2.2, (now += 16));
  assert.equal(tr.dueIn(now), -1);
  assert.equal(tr.settle(now + 1000), -1);
});

test('trigger：兩個聲音之間有最小間隔，太近的那一步延後到靜下來', () => {
  const tr = createTrigger(0, 6);
  assert.equal(tr.move(0.6, 1000), 0);
  // 在中點附近慢慢抖：速度不快（每秒不到一步），但離上一聲太近
  assert.equal(tr.move(0.49, 1000 + MIN_GAP_MS - 60), -1);
  assert.equal(tr.move(0.51, 1000 + MIN_GAP_MS - 30), -1);
  assert.equal(tr.settle(1000 + MIN_GAP_MS - 30 + SETTLE_MS), 0);
});

test('trigger：reset 之後從新的位置出發，不補播', () => {
  const tr = createTrigger(0, 6);
  tr.reset(3.2);
  assert.equal(tr.move(3.4, 1000), -1);
  assert.equal(tr.move(3.6, 1400), 3);
});

/** 用一小段軌跡算出每一步的聲音 */
function sounds(steps: RustEvent[][]): (SoundKind | null)[] {
  const trace: Trace = {
    steps: steps.map((rust) => ({ rustLine: 1, tsLine: 1, caption: { js: '', rust: '' }, js: [], rust })),
  };
  const tl = buildTimeline(trace);
  return trace.steps.map((step, k) => stepSound(step, tl.rustStates[k]!, tl.rustStates[k + 1]!));
}

test('stepSound：第 1 頁的走法（出現、搬走、使用、碎掉）', () => {
  assert.deepEqual(
    sounds([
      [{ type: 'alloc', value: 'v1', label: '"hello"' }, { type: 'bind', binding: 'a', value: 'v1' }],
      [{ type: 'move', from: 'a', to: 'b' }],
      [{ type: 'use', binding: 'b' }],
      [{ type: 'drop', binding: 'b' }],
      [{ type: 'drop', binding: 'a' }],
    ]),
    ['alloc', 'move', 'tick', 'shatter', 'soft'],
  );
});

test('stepSound：借用分 & 與 &mut，結束時用同一個音色', () => {
  assert.deepEqual(
    sounds([
      [{ type: 'alloc', value: 'v1', label: '"hi"' }, { type: 'bind', binding: 'a', value: 'v1' }],
      [{ type: 'borrow', binding: 'r', of: 'a' }],
      [{ type: 'release', binding: 'r' }],
      [{ type: 'borrow', binding: 'w', of: 'a', mut: true }],
      [{ type: 'release', binding: 'w' }],
    ]),
    ['alloc', 'borrow', 'release', 'borrowMut', 'releaseMut'],
  );
});

test('stepSound：範圍結束時有值碎掉就是碎掉的聲音；複製是 copy', () => {
  assert.deepEqual(
    sounds([
      [{ type: 'enter', scope: 's', kind: 'block', label: '{ }' }],
      [{ type: 'alloc', value: 'n1', label: '5', copy: true }, { type: 'bind', binding: 'x', value: 'n1' }],
      [{ type: 'copy', from: 'x', to: 'y', value: 'n2' }],
      [{ type: 'exit', scope: 's' }],
    ]),
    ['soft', 'alloc', 'copy', 'shatter'],
  );
});

test('stepSound：Rust 沒有事件時看 JS（GC、丟出錯誤），都沒有就不出聲', () => {
  const tl = buildTimeline({ steps: [] });
  const empty = tl.rustStates[0]!;
  const step = (js: Trace['steps'][number]['js']) => ({
    rustLine: null, tsLine: 1, caption: { js: '', rust: '' }, js, rust: [],
  });
  assert.equal(stepSound(step([{ type: 'gc' }]), empty, empty), 'sweep');
  assert.equal(stepSound(step([{ type: 'use', binding: 'a' }, { type: 'throw', label: 'TypeError' }]), empty, empty), 'zap');
  assert.equal(stepSound(step([{ type: 'use', binding: 'a' }]), empty, empty), 'soft');
  assert.equal(stepSound(step([]), empty, empty), null);
});

test('配方：每個聲音 80–450 毫秒，各 voice 的增益加起來不超過 -18 dBFS', () => {
  for (const [kind, voices] of Object.entries(RECIPES)) {
    const len = Math.max(...voices.map((v) => v.at + v.len));
    const peak = voices.reduce((sum, v) => sum + v.gain, 0);
    assert.ok(len >= 0.08 && len <= 0.45, `${kind} 長 ${len} 秒`);
    assert.ok(peak <= 10 ** (-18 / 20), `${kind} 的增益總和 ${peak}`);
  }
});
