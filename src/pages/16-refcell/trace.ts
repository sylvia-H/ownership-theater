// 第 16 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// 值的外面多一層 RefCell 的殼；borrow_mut() 是執行時才登記的光束（cell-borrow），登記著的時候殼整圈亮起。
// w 是 RefMut 守衛，有 Drop，不適用 NLL：最後一次使用之後不會自己熄，要到第 4 步 drop(w) 才歸還。
// 「弄壞它」是跳過第 4 步、直接做第 5 步（做完第 2、3 步時可以按）：規則和 &mut 一樣，
// 但被擋下的是執行期的規則 refcell-already-borrowed，訊息是 panic 原文，不是編譯錯誤。

import type { BreakIt, Trace } from '../../core/trace.ts';

export const trace: Trace = {
  steps: [
    {
      rustLine: 4,
      tsLine: 2,
      caption: {
        js: 'cell 連到陣列 [1, 2]。',
        rust: 'cell 握住值，外面包一層 RefCell。',
      },
      js: [
        { type: 'alloc', value: 'o1', label: '[1, 2]' },
        { type: 'bind', binding: 'cell', value: 'o1' },
      ],
      rust: [
        { type: 'alloc', value: 'v1', label: '[1, 2]', cell: true },
        { type: 'bind', binding: 'cell', value: 'v1' },
      ],
    },
    {
      rustLine: 5,
      tsLine: 3,
      caption: {
        js: 'w 多連一條線，不用登記。',
        rust: '執行時登記，w 的實心光束亮起。',
      },
      js: [{ type: 'bind', binding: 'w', value: 'o1' }],
      rust: [{ type: 'cell-borrow', binding: 'w', of: 'cell', mut: true }],
    },
    {
      rustLine: 6,
      tsLine: 4,
      caption: {
        js: '透過 w 改了值。',
        rust: '透過 w 改了值。',
      },
      js: [{ type: 'mutate', binding: 'w', label: '[1, 2, 3]' }],
      rust: [{ type: 'mutate', binding: 'w', label: '[1, 2, 3]' }],
    },
    {
      rustLine: 7,
      tsLine: 5,
      caption: {
        js: '沒有歸還這回事，w 的線還在。',
        rust: 'drop(w) 才歸還，登記清空。',
      },
      js: [],
      rust: [{ type: 'drop', binding: 'w' }],
    },
    {
      rustLine: 8,
      tsLine: 6,
      caption: {
        js: 'w2 再連一條線，三條線都能改。',
        rust: '登記是空的，w2 的光束亮起。',
      },
      js: [{ type: 'bind', binding: 'w2', value: 'o1' }],
      rust: [{ type: 'cell-borrow', binding: 'w2', of: 'cell', mut: true }],
    },
    {
      rustLine: 9,
      tsLine: 7,
      caption: {
        js: '透過 w2 再改一次。',
        rust: '透過 w2 再改一次。',
      },
      js: [{ type: 'mutate', binding: 'w2', label: '[1, 2, 3, 4]' }],
      rust: [{ type: 'mutate', binding: 'w2', label: '[1, 2, 3, 4]' }],
    },
    {
      rustLine: 10,
      tsLine: 8,
      caption: {
        js: '印出 [1, 2, 3, 4]。',
        rust: '印出 [1, 2, 3, 4]。',
      },
      js: [{ type: 'use', binding: 'w2' }],
      rust: [{ type: 'use', binding: 'w2' }],
    },
    {
      rustLine: 11,
      tsLine: 9,
      caption: {
        js: '線都斷了，球等 GC 來收。',
        rust: 'w2 歸還後，值跟著 cell 碎掉。',
      },
      js: [
        { type: 'unbind', binding: 'w2' },
        { type: 'unbind', binding: 'w' },
        { type: 'unbind', binding: 'cell' },
      ],
      rust: [
        { type: 'drop', binding: 'w2' },
        { type: 'drop', binding: 'cell' },
      ],
    },
  ],
};

export const breakIt: BreakIt = {
  attempt: { type: 'cell-borrow', binding: 'w2', of: 'cell', mut: true },
  rule: 'refcell-already-borrowed',
  expect: 'panic',
  at: 'rust:val:v1',
  hint: '弄壞它：w 還亮著時再拉一道 borrow_mut',
  plain:
    '規則和 &mut 一樣，同時只能有一道。差別是 RefCell 在執行時才檢查：這段程式編譯得過，跑到第二個 borrow_mut() 才 panic。w 是守衛，沒有 drop 就不會歸還。',
};
