// 第 1 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。

import type { BreakIt, Trace } from '../../core/trace.ts';

export const trace: Trace = {
  steps: [
    {
      rustLine: 2,
      tsLine: 2,
      caption: {
        js: '一顆光球漂在空中，a 連一條線過去。',
        rust: 'a 這隻夾具握住這個值。',
      },
      js: [
        { type: 'alloc', value: 'o1', label: '"hello"' },
        { type: 'bind', binding: 'a', value: 'o1' },
      ],
      rust: [
        { type: 'alloc', value: 'v1', label: '"hello"' },
        { type: 'bind', binding: 'a', value: 'v1' },
      ],
    },
    {
      rustLine: 3,
      tsLine: 3,
      caption: {
        js: 'b 多連一條線到同一顆球。',
        rust: '值整顆搬到 b，a 變成空殼。',
      },
      js: [{ type: 'bind', binding: 'b', value: 'o1' }],
      rust: [{ type: 'move', from: 'a', to: 'b' }],
    },
    {
      rustLine: 4,
      tsLine: 4,
      caption: {
        js: '順著 b 的線，用得到那顆球。',
        rust: '值在 b 手上，透過 b 用它沒問題。',
      },
      js: [{ type: 'use', binding: 'b' }],
      rust: [{ type: 'use', binding: 'b' }],
    },
    {
      rustLine: null,
      tsLine: 5,
      caption: {
        js: 'a 的線還在，照樣能用。',
        rust: '這邊沒有對應的行，寫了就編譯不過；試試「弄壞它」。',
      },
      js: [{ type: 'use', binding: 'a' }],
      rust: [],
    },
    {
      rustLine: 5,
      tsLine: 6,
      caption: {
        js: '線都斷了，球留在原地等 GC 來收。',
        rust: 'b 離開 scope，值當場碎掉。',
      },
      js: [
        { type: 'unbind', binding: 'a' },
        { type: 'unbind', binding: 'b' },
      ],
      rust: [
        { type: 'drop', binding: 'b' },
        { type: 'drop', binding: 'a' },
      ],
    },
  ],
};

export const breakIt: BreakIt = {
  attempt: { type: 'use', binding: 'a' },
  rule: 'use-after-move',
  expect: 'E0382',
  at: 'rust:claw:a',
  drag: { value: 'v1', onto: 'a' },
  hint: '弄壞它：把 "hello" 拖回 a',
  plain: '值已經搬到 b，a 只剩空殼。Rust 在編譯期就把這行擋下來，不等執行時才出事。',
};
