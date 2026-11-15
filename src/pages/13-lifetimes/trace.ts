// 第 13 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// longest 的呼叫不畫成函式框（三層疊起來物件會縮得太小）：第 4 步直接讓 result 的光束照在 a 上，
// 並用 tied 記下函式簽名的 'a 把它和 a、b 綁在一起。畫面上多一條從 result 拉到 b 的虛線（綁線）：
// 光束實際照著 a，但最多只能活到 b 碎掉。
// 第 6 步把「最後一次使用之後光束熄滅」獨立成一拍（仍對應 Rust 第 10 行），第 7 步 b 才碎。
// 第 8 步 Rust 沒有對應的行：在這裡用 result 就是「弄壞它」（做完第 7、8 步時可以按）。

import type { BreakIt, Trace } from '../../core/trace.ts';

export const trace: Trace = {
  steps: [
    {
      rustLine: 5,
      tsLine: 5,
      caption: {
        js: 'a 連到一顆光球。',
        rust: 'a 握住第一個值。',
      },
      js: [
        { type: 'alloc', value: 'o1', label: '{ text: "long string" }' },
        { type: 'bind', binding: 'a', value: 'o1' },
      ],
      rust: [
        { type: 'alloc', value: 'v1', label: '"long string"' },
        { type: 'bind', binding: 'a', value: 'v1' },
      ],
    },
    {
      rustLine: 6,
      tsLine: 6,
      caption: {
        js: 'result 還沒連到任何東西。',
        rust: 'result 先宣告，燈還沒亮。',
      },
      js: [{ type: 'bind-empty', binding: 'result' }],
      rust: [{ type: 'declare-ref', binding: 'result' }],
    },
    {
      rustLine: 8,
      tsLine: 8,
      caption: {
        js: 'b 連到第二顆光球。',
        rust: 'b 握住第二個值，只活到內層結束。',
      },
      js: [
        { type: 'enter', scope: 'inner', kind: 'block', label: '{ }' },
        { type: 'alloc', value: 'o2', label: '{ text: "xyz" }' },
        { type: 'bind', binding: 'b', value: 'o2' },
      ],
      rust: [
        { type: 'enter', scope: 'inner', kind: 'block', label: '{ }' },
        { type: 'alloc', value: 'v2', label: '"xyz"' },
        { type: 'bind', binding: 'b', value: 'v2' },
      ],
    },
    {
      rustLine: 9,
      tsLine: 9,
      caption: {
        js: 'result 連到比較長的那顆球。',
        rust: "光束照著 a，但 'a 把它也綁在 b 上。",
      },
      js: [{ type: 'bind', binding: 'result', value: 'o1' }],
      rust: [{ type: 'borrow', binding: 'result', of: 'a', tied: ['a', 'b'], life: "'a" }],
    },
    {
      rustLine: 10,
      tsLine: null,
      caption: {
        js: '這邊等到 scope 外面才印。',
        rust: 'b 還活著，用 result 沒問題。',
      },
      js: [],
      rust: [{ type: 'use', binding: 'result' }],
    },
    {
      rustLine: 10,
      tsLine: null,
      caption: {
        js: '線沒有期限，一直連著。',
        rust: '之後用不到 result，光束先熄滅。',
      },
      js: [],
      rust: [{ type: 'release', binding: 'result' }],
    },
    {
      rustLine: 11,
      tsLine: 10,
      caption: {
        js: 'b 的線斷了，球等 GC 來收。',
        rust: 'b 離開 scope，值當場碎掉。',
      },
      js: [{ type: 'exit', scope: 'inner' }],
      rust: [{ type: 'exit', scope: 'inner' }],
    },
    {
      rustLine: null,
      tsLine: 11,
      caption: {
        js: 'scope 外照樣用得到 result。',
        rust: '這邊沒有這一行；試試「弄壞它」。',
      },
      js: [{ type: 'use', binding: 'result' }],
      rust: [],
    },
    {
      rustLine: 12,
      tsLine: 12,
      caption: {
        js: '線都斷了，球等 GC 來收。',
        rust: 'a 離開 scope，值碎掉。',
      },
      js: [
        { type: 'unbind', binding: 'result' },
        { type: 'unbind', binding: 'a' },
      ],
      rust: [
        { type: 'drop', binding: 'result' },
        { type: 'drop', binding: 'a' },
      ],
    },
  ],
};

export const breakIt: BreakIt = {
  attempt: { type: 'use', binding: 'result' },
  rule: 'outlives-value',
  expect: 'E0597',
  at: 'rust:lens:result',
  hint: '弄壞它：b 碎了之後還用 result',
  plain:
    'result 的光束最多只能活到 b 結束。b 已經碎了還想用 result，編譯器不放行；即使它實際指向的是 a 也一樣，因為編譯器只看函式簽名。',
};
