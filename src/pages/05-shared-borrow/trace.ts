// 第 5 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// r1、r2 是參考變數：不握值，各發出一道 & 光束照著 s 握的值。
// 兩道光束在最後一次使用（第 5 行）那一步熄滅，照 rustc 的行為；第 7 頁才正式講這件事。

import type { Trace } from '../../core/trace.ts';

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
        js: 'r1 多連一條線到同一顆球。',
        rust: 'r1 照出一道半透明光束，值還在 s 手上。',
      },
      js: [{ type: 'bind', binding: 'r1', value: 'o1' }],
      rust: [{ type: 'borrow', binding: 'r1', of: 's' }],
    },
    {
      rustLine: 4,
      tsLine: 4,
      caption: {
        js: 'r2 再連一條線，三條線連同一顆球。',
        rust: '第二道光束也亮起，共享借用可以並存。',
      },
      js: [{ type: 'bind', binding: 'r2', value: 'o1' }],
      rust: [{ type: 'borrow', binding: 'r2', of: 's' }],
    },
    {
      rustLine: 5,
      tsLine: 5,
      caption: {
        js: '順著 r1、r2 的線讀到同一顆球。',
        rust: '透過兩道光束讀值，讀完光束就熄滅。',
      },
      js: [
        { type: 'use', binding: 'r1' },
        { type: 'use', binding: 'r2' },
      ],
      rust: [
        { type: 'use', binding: 'r1' },
        { type: 'use', binding: 'r2' },
        { type: 'release', binding: 'r1' },
        { type: 'release', binding: 'r2' },
      ],
    },
    {
      rustLine: 6,
      tsLine: 6,
      caption: {
        js: 's 的線也還在，照樣能讀。',
        rust: '擁有者 s 一直握著值，也能讀。',
      },
      js: [{ type: 'use', binding: 's' }],
      rust: [{ type: 'use', binding: 's' }],
    },
    {
      rustLine: 7,
      tsLine: 7,
      caption: {
        js: '線都斷了，球留在原地等 GC 來收。',
        rust: 's 離開 scope，值當場碎掉。',
      },
      js: [
        { type: 'unbind', binding: 'r2' },
        { type: 'unbind', binding: 'r1' },
        { type: 'unbind', binding: 's' },
      ],
      rust: [
        { type: 'drop', binding: 'r2' },
        { type: 'drop', binding: 'r1' },
        { type: 'drop', binding: 's' },
      ],
    },
  ],
};

export const breakIt = null;
