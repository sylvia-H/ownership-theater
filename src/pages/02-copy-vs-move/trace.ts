// 第 2 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// JS 這邊照實畫：數字是 primitive，指定時也是複製（prim + copy）；物件才是多拉一條線。
// 所以兩個世界在整數這一段長得一樣，差別只出現在 String／物件那一段。

import type { Trace } from '../../core/trace.ts';

export const trace: Trace = {
  steps: [
    {
      rustLine: 2,
      tsLine: 2,
      caption: {
        js: '數字是 primitive，直接放在 x 身上。',
        rust: '5 是整數，x 握著這顆小小的值。',
      },
      js: [
        { type: 'alloc', value: 'n1', label: '5', prim: true },
        { type: 'bind', binding: 'x', value: 'n1' },
      ],
      rust: [
        { type: 'alloc', value: 'i1', label: '5', copy: true },
        { type: 'bind', binding: 'x', value: 'i1' },
      ],
    },
    {
      rustLine: 3,
      tsLine: 3,
      caption: {
        js: '數字也是複製一份給 y，兩邊互不相干。',
        rust: '整數是 Copy：複製出一顆新的給 y，x 的還在。',
      },
      js: [{ type: 'copy', from: 'x', to: 'y', value: 'n2' }],
      rust: [{ type: 'copy', from: 'x', to: 'y', value: 'i2' }],
    },
    {
      rustLine: 4,
      tsLine: 4,
      caption: {
        js: 'x 和 y 各有各的 5，都能用。',
        rust: 'x 和 y 各握一顆 5，兩個都能用。',
      },
      js: [
        { type: 'use', binding: 'x' },
        { type: 'use', binding: 'y' },
      ],
      rust: [
        { type: 'use', binding: 'x' },
        { type: 'use', binding: 'y' },
      ],
    },
    {
      rustLine: 5,
      tsLine: 5,
      caption: {
        js: '物件是一顆漂在空中的球，s 連一條線過去。',
        rust: 'String 的內容在 heap 上，s 握住這個值。',
      },
      js: [
        { type: 'alloc', value: 'o1', label: '"hello"' },
        { type: 'bind', binding: 's', value: 'o1' },
      ],
      rust: [
        { type: 'alloc', value: 'v1', label: '"hello"' },
        { type: 'bind', binding: 's', value: 'v1' },
      ],
    },
    {
      rustLine: 6,
      tsLine: 6,
      caption: {
        js: '寫法一樣，但這次沒有複製：t 連到同一顆球。',
        rust: '寫法一樣，但 String 不是 Copy：整顆搬到 t。',
      },
      js: [{ type: 'bind', binding: 't', value: 'o1' }],
      rust: [{ type: 'move', from: 's', to: 't' }],
    },
    {
      rustLine: 7,
      tsLine: 7,
      caption: {
        js: '順著 t 的線用到那顆球；s 的線也還在。',
        rust: '值在 t 手上，只能透過 t 用它；s 是空殼。',
      },
      js: [{ type: 'use', binding: 't' }],
      rust: [{ type: 'use', binding: 't' }],
    },
    {
      rustLine: 8,
      tsLine: 8,
      caption: {
        js: '數字跟著變數消失；球沒人連著，等 GC 來收。',
        rust: '變數離開 scope，握著的值全部當場碎掉。',
      },
      js: [
        { type: 'unbind', binding: 't' },
        { type: 'unbind', binding: 's' },
        { type: 'unbind', binding: 'y' },
        { type: 'unbind', binding: 'x' },
      ],
      rust: [
        { type: 'drop', binding: 't' },
        { type: 'drop', binding: 's' },
        { type: 'drop', binding: 'y' },
        { type: 'drop', binding: 'x' },
      ],
    },
  ],
};

export const breakIt = null;
