// 第 9 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// Rust：hello、mid 是只照到值其中一段的 & 光束（part 是 0..1 的比例），全程只有兩個值。
//   &s[0..5]：字串長 11 個位元組，照到 [0, 5/11]；&nums[1..3]：陣列長 5，照到 [1/5, 3/5]。
// JS：照本站的慣例，字串是 primitive（貼在變數上的珠子，不歸 GC 管），陣列是光球；
//   slice() 兩種都做出新的值，所以最後有四個值，其中兩顆陣列球等 GC。

import type { Trace } from '../../core/trace.ts';

export const trace: Trace = {
  steps: [
    {
      rustLine: 2,
      tsLine: 2,
      caption: {
        js: '字串是 primitive，直接放在 s 身上。',
        rust: 's 這隻夾具握住整個字串。',
      },
      js: [
        { type: 'alloc', value: 'p1', label: '"hello world"', prim: true },
        { type: 'bind', binding: 's', value: 'p1' },
      ],
      rust: [
        { type: 'alloc', value: 'v1', label: '"hello world"' },
        { type: 'bind', binding: 's', value: 'v1' },
      ],
    },
    {
      rustLine: 3,
      tsLine: 3,
      caption: {
        js: 'slice 做出一個新的字串，交給 hello。',
        rust: 'hello 的光束只照到字串的前五個字。',
      },
      js: [
        { type: 'alloc', value: 'p2', label: '"hello"', prim: true },
        { type: 'bind', binding: 'hello', value: 'p2' },
      ],
      rust: [{ type: 'borrow', binding: 'hello', of: 's', part: [0, 5 / 11] }],
    },
    {
      rustLine: 4,
      tsLine: 4,
      caption: {
        js: '讀的是新做出來的那個字串。',
        rust: '透過光束讀到 s 手上值的其中一段。',
      },
      js: [{ type: 'use', binding: 'hello' }],
      rust: [
        { type: 'use', binding: 'hello' },
        { type: 'release', binding: 'hello' },
      ],
    },
    {
      rustLine: 5,
      tsLine: 5,
      caption: {
        js: '陣列是一顆光球，nums 連一條線過去。',
        rust: 'nums 這隻夾具握住整個陣列。',
      },
      js: [
        { type: 'alloc', value: 'o1', label: '[1, 2, 3, 4, 5]' },
        { type: 'bind', binding: 'nums', value: 'o1' },
      ],
      rust: [
        { type: 'alloc', value: 'v2', label: '[1, 2, 3, 4, 5]' },
        { type: 'bind', binding: 'nums', value: 'v2' },
      ],
    },
    {
      rustLine: 6,
      tsLine: 6,
      caption: {
        js: 'slice 又做出一顆新的球，mid 連過去。',
        rust: 'mid 的光束只照到陣列中間兩個元素。',
      },
      js: [
        { type: 'alloc', value: 'o2', label: '[2, 3]' },
        { type: 'bind', binding: 'mid', value: 'o2' },
      ],
      rust: [{ type: 'borrow', binding: 'mid', of: 'nums', part: [1 / 5, 3 / 5] }],
    },
    {
      rustLine: 7,
      tsLine: 7,
      caption: {
        js: '讀的是複製出來的 [2, 3]。',
        rust: '透過光束讀到 nums 的其中一段。',
      },
      js: [{ type: 'use', binding: 'mid' }],
      rust: [
        { type: 'use', binding: 'mid' },
        { type: 'release', binding: 'mid' },
      ],
    },
    {
      rustLine: 8,
      tsLine: 8,
      caption: {
        js: '線都斷了，兩顆陣列球留著等 GC。',
        rust: '兩個值隨擁有者離開 scope 碎掉。',
      },
      js: [
        { type: 'unbind', binding: 'mid' },
        { type: 'unbind', binding: 'nums' },
        { type: 'unbind', binding: 'hello' },
        { type: 'unbind', binding: 's' },
      ],
      rust: [
        { type: 'drop', binding: 'mid' },
        { type: 'drop', binding: 'hello' },
        { type: 'drop', binding: 'nums' },
        { type: 'drop', binding: 's' },
      ],
    },
  ],
};

export const breakIt = null;
