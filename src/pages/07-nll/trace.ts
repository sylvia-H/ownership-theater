// 第 7 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// 本頁重點是第 5 步：r1、r2 最後一次使用之後，兩道 & 光束就熄滅，不等到 scope 結尾。
// 這一拍特別拆出來（仍對應 Rust 第 5 行，TS 沒有對應），JS 那邊什麼都沒發生。

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
        rust: 'r1 照出一道半透明光束。',
      },
      js: [{ type: 'bind', binding: 'r1', value: 'o1' }],
      rust: [{ type: 'borrow', binding: 'r1', of: 's' }],
    },
    {
      rustLine: 4,
      tsLine: 4,
      caption: {
        js: 'r2 再連一條線。',
        rust: 'r2 的光束也亮起，兩道並存。',
      },
      js: [{ type: 'bind', binding: 'r2', value: 'o1' }],
      rust: [{ type: 'borrow', binding: 'r2', of: 's' }],
    },
    {
      rustLine: 5,
      tsLine: 5,
      caption: {
        js: '順著 r1、r2 的線讀到同一顆球。',
        rust: '透過兩道光束讀值，這是最後一次用。',
      },
      js: [
        { type: 'use', binding: 'r1' },
        { type: 'use', binding: 'r2' },
      ],
      rust: [
        { type: 'use', binding: 'r1' },
        { type: 'use', binding: 'r2' },
      ],
    },
    {
      rustLine: 5,
      tsLine: null,
      caption: {
        js: '線還連著，要到函式結束才會斷。',
        rust: '之後用不到 r1、r2，光束現在就熄滅。',
      },
      js: [],
      rust: [
        { type: 'release', binding: 'r1' },
        { type: 'release', binding: 'r2' },
      ],
    },
    {
      rustLine: 6,
      tsLine: 6,
      caption: {
        js: 'm 再連一條線，四條線連同一顆球。',
        rust: '沒有光束擋著，m 的實心光束進得來。',
      },
      js: [{ type: 'bind', binding: 'm', value: 'o1' }],
      rust: [{ type: 'borrow', binding: 'm', of: 's', mut: true }],
    },
    {
      rustLine: 7,
      tsLine: 7,
      caption: {
        js: '順著 m 的線把球改掉。',
        rust: '透過 m 改值；m 之後也不再用，熄滅。',
      },
      js: [{ type: 'mutate', binding: 'm', label: '{ text: "hello world" }' }],
      rust: [
        { type: 'mutate', binding: 'm', label: '"hello world"' },
        { type: 'release', binding: 'm' },
      ],
    },
    {
      rustLine: 8,
      tsLine: 8,
      caption: {
        js: '透過 s 讀到改過的值。',
        rust: 'm 也熄了，擁有者 s 可以直接讀。',
      },
      js: [{ type: 'use', binding: 's' }],
      rust: [{ type: 'use', binding: 's' }],
    },
    {
      rustLine: 9,
      tsLine: 9,
      caption: {
        js: '線都斷了，球留在原地等 GC 來收。',
        rust: 's 離開 scope，值當場碎掉。',
      },
      js: [
        { type: 'unbind', binding: 'm' },
        { type: 'unbind', binding: 'r2' },
        { type: 'unbind', binding: 'r1' },
        { type: 'unbind', binding: 's' },
      ],
      rust: [
        { type: 'drop', binding: 'm' },
        { type: 'drop', binding: 'r2' },
        { type: 'drop', binding: 'r1' },
        { type: 'drop', binding: 's' },
      ],
    },
  ],
};

export const breakIt = null;
