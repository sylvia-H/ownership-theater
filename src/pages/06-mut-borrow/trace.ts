// 第 6 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// r 的 & 光束在最後一次使用（第 4 行）那一步熄滅，所以第 5 行的 &mut 進得來。
// 「弄壞它」只在第 2 步做完、& 還亮著的時候可以做。
// TS 第 8 行在 Rust 沒有對應（第 7 步的 rustLine 是 null）。

import type { BreakIt, Trace } from '../../core/trace.ts';

export const trace: Trace = {
  steps: [
    {
      rustLine: 2,
      tsLine: 2,
      caption: {
        js: '一顆光球漂在空中，s 連一條線過去。',
        rust: 's 這隻夾具握住這個值。',
      },
      js: [
        { type: 'alloc', value: 'o1', label: '{ text: "hello" }' },
        { type: 'bind', binding: 's', value: 'o1' },
      ],
      rust: [
        { type: 'alloc', value: 'v1', label: '"hello"' },
        { type: 'bind', binding: 's', value: 'v1' },
      ],
    },
    {
      rustLine: 3,
      tsLine: 3,
      caption: {
        js: 'r 多連一條線到同一顆球。',
        rust: 'r 照出一道半透明光束，只能讀。',
      },
      js: [{ type: 'bind', binding: 'r', value: 'o1' }],
      rust: [{ type: 'borrow', binding: 'r', of: 's' }],
    },
    {
      rustLine: 4,
      tsLine: 4,
      caption: {
        js: '順著 r 的線讀到那顆球。',
        rust: 'r 讀完值，之後不再用，光束熄滅。',
      },
      js: [{ type: 'use', binding: 'r' }],
      rust: [
        { type: 'use', binding: 'r' },
        { type: 'release', binding: 'r' },
      ],
    },
    {
      rustLine: 5,
      tsLine: 5,
      caption: {
        js: 'm 再連一條線，和 r 沒有差別。',
        rust: 'm 照出唯一一道實心光束。',
      },
      js: [{ type: 'bind', binding: 'm', value: 'o1' }],
      rust: [{ type: 'borrow', binding: 'm', of: 's', mut: true }],
    },
    {
      rustLine: 6,
      tsLine: 6,
      caption: {
        js: '順著 m 的線把球改掉。',
        rust: '透過實心光束改值，這時沒有別人在看。',
      },
      js: [{ type: 'mutate', binding: 'm', label: '{ text: "hello world" }' }],
      rust: [{ type: 'mutate', binding: 'm', label: '"hello world"' }],
    },
    {
      rustLine: 7,
      tsLine: 7,
      caption: {
        js: '透過 m 讀到改過的值。',
        rust: '透過 m 讀到改過的值，讀完光束熄滅。',
      },
      js: [{ type: 'use', binding: 'm' }],
      rust: [
        { type: 'use', binding: 'm' },
        { type: 'release', binding: 'm' },
      ],
    },
    {
      rustLine: null,
      tsLine: 8,
      caption: {
        js: 'r 的線一直連著，讀到的值已被改掉。',
        rust: '這邊沒有這一行：r 的光束早就熄了。',
      },
      js: [{ type: 'use', binding: 'r' }],
      rust: [],
    },
    {
      rustLine: 8,
      tsLine: 9,
      caption: {
        js: '線都斷了，球留在原地等 GC 來收。',
        rust: 's 離開 scope，值當場碎掉。',
      },
      js: [
        { type: 'unbind', binding: 'm' },
        { type: 'unbind', binding: 'r' },
        { type: 'unbind', binding: 's' },
      ],
      rust: [
        { type: 'drop', binding: 'm' },
        { type: 'drop', binding: 'r' },
        { type: 'drop', binding: 's' },
      ],
    },
  ],
};

export const breakIt: BreakIt = {
  attempt: { type: 'borrow', binding: 'm', of: 's', mut: true },
  rule: 'mut-while-shared',
  expect: 'E0502',
  at: 'rust:val:v1',
  hint: '弄壞它：趁 & 還亮著，拉一道 &mut',
  plain: 'r 這道共享借用後面還要用，這時不能再借出 &mut；否則 r 讀到一半，值就可能被改掉。',
};
