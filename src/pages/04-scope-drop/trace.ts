// 第 4 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// 重點是時間差：Rust 的值在 `}` 那一步碎掉；JS 的球要到之後 GC 經過才被收走。
// GC 什麼時候來由引擎決定，軌跡把它排在離開 `{ }` 的兩步之後，不對應任何一行程式碼。

import type { Trace } from '../../core/trace.ts';

export const trace: Trace = {
  steps: [
    {
      rustLine: 2,
      tsLine: 2,
      caption: {
        js: '一顆光球漂在空中，a 連一條線過去。',
        rust: 'a 這隻夾具握住 "outer"。',
      },
      js: [
        { type: 'alloc', value: 'o1', label: '"outer"' },
        { type: 'bind', binding: 'a', value: 'o1' },
      ],
      rust: [
        { type: 'alloc', value: 'v1', label: '"outer"' },
        { type: 'bind', binding: 'a', value: 'v1' },
      ],
    },
    {
      rustLine: 3,
      tsLine: 3,
      caption: {
        js: '進入內層的 { }，裡面宣告的變數只活在裡面。',
        rust: '進入內層的 { }，裡面宣告的變數只活在裡面。',
      },
      js: [{ type: 'enter', scope: 'inner', kind: 'block', label: '{ }' }],
      rust: [{ type: 'enter', scope: 'inner', kind: 'block', label: '{ }' }],
    },
    {
      rustLine: 4,
      tsLine: 4,
      caption: {
        js: '第二顆球出現，b 連一條線過去。',
        rust: '內層的 b 握住 "inner"。',
      },
      js: [
        { type: 'alloc', value: 'o2', label: '"inner"' },
        { type: 'bind', binding: 'b', value: 'o2' },
      ],
      rust: [
        { type: 'alloc', value: 'v2', label: '"inner"' },
        { type: 'bind', binding: 'b', value: 'v2' },
      ],
    },
    {
      rustLine: 5,
      tsLine: 5,
      caption: {
        js: '內層用得到外面的 a，也用得到自己的 b。',
        rust: '內層用得到外面的 a，也用得到自己的 b。',
      },
      js: [
        { type: 'use', binding: 'a' },
        { type: 'use', binding: 'b' },
      ],
      rust: [
        { type: 'use', binding: 'a' },
        { type: 'use', binding: 'b' },
      ],
    },
    {
      rustLine: 6,
      tsLine: 6,
      caption: {
        js: 'b 的線斷了，球沒人連著，卻還漂在那裡。',
        rust: '走到 } 的這一刻，b 握著的值當場碎掉。',
      },
      js: [{ type: 'exit', scope: 'inner' }],
      rust: [{ type: 'exit', scope: 'inner' }],
    },
    {
      rustLine: 7,
      tsLine: 7,
      caption: {
        js: '照常使用 a；那顆沒人要的球還在佔記憶體。',
        rust: '照常使用 a；"inner" 的記憶體早就還回去了。',
      },
      js: [{ type: 'use', binding: 'a' }],
      rust: [{ type: 'use', binding: 'a' }],
    },
    {
      rustLine: null,
      tsLine: null,
      caption: {
        js: '不知道哪一刻 GC 經過，才把沒有線的球收走。',
        rust: '沒有 GC，這一步什麼事也沒發生。',
      },
      js: [{ type: 'gc' }],
      rust: [],
    },
    {
      rustLine: 8,
      tsLine: 8,
      caption: {
        js: 'a 的線也斷了，這顆球要等下一次 GC。',
        rust: 'a 離開 scope，"outer" 也當場碎掉。',
      },
      js: [{ type: 'unbind', binding: 'a' }],
      rust: [{ type: 'drop', binding: 'a' }],
    },
  ],
};

export const breakIt = null;
