// 第 17 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// 整本圖鑑的收尾：Rust 世界這一頁長得和 JS 世界幾乎一樣——下面兩個名字、上面一顆值、兩條線。
// 值同時包著 Rc（多個擁有者、有計數）與 RefCell（外面一層殼，借用在執行期登記）。
// 第 3、4 步的 borrow_mut()／borrow() 是暫時的守衛，那一行結束就歸還（cell-use）：
// 快照裡沒有光束，只在那一步中途從 b／a 的夾具照到值、殼亮一下。
// 第 10 行的 } 拆成兩拍（b 先離開、a 再離開），計數 2 → 1 → 0 才看得清楚；這兩個數字片段印不出來，是依語意寫的。
// 最後一步的字幕點題：差別不是有沒有，是預設。

import type { Trace } from '../../core/trace.ts';

export const trace: Trace = {
  steps: [
    {
      rustLine: 5,
      tsLine: 2,
      caption: {
        js: 'a 連到陣列 [1, 2]。',
        rust: 'a 連到值：明講可共享、可改。',
      },
      js: [
        { type: 'alloc', value: 'o1', label: '[1, 2]' },
        { type: 'bind', binding: 'a', value: 'o1' },
      ],
      rust: [
        { type: 'alloc', value: 'v1', label: '[1, 2]', rc: true, cell: true },
        { type: 'bind', binding: 'a', value: 'v1' },
      ],
    },
    {
      rustLine: 6,
      tsLine: 3,
      caption: {
        js: 'b 多連一條線到同一顆球。',
        rust: 'b 也連到同一個值，計數變 2。',
      },
      js: [{ type: 'bind', binding: 'b', value: 'o1' }],
      rust: [{ type: 'share', from: 'a', to: 'b' }],
    },
    {
      rustLine: 7,
      tsLine: 4,
      caption: {
        js: '透過 b 改了值。',
        rust: '透過 b 借來改，改完馬上歸還。',
      },
      js: [{ type: 'mutate', binding: 'b', label: '[1, 2, 3]' }],
      rust: [{ type: 'cell-use', via: 'b', mut: true, label: '[1, 2, 3]' }],
    },
    {
      rustLine: 8,
      tsLine: 5,
      caption: {
        js: '從 a 看到 b 改的結果。',
        rust: '從 a 借來看，看到 b 改的結果。',
      },
      js: [{ type: 'use', binding: 'a' }],
      rust: [{ type: 'cell-use', via: 'a' }],
    },
    {
      rustLine: 9,
      tsLine: null,
      caption: {
        js: '幾條線連著，只有 GC 知道。',
        rust: '計數是 2，看得到的數字。',
      },
      js: [],
      rust: [{ type: 'use', binding: 'a' }],
    },
    {
      rustLine: 10,
      tsLine: 6,
      caption: {
        js: 'b 的線斷了，球還在。',
        rust: 'b 離開，計數降到 1，值還在。',
      },
      js: [{ type: 'unbind', binding: 'b' }],
      rust: [{ type: 'drop', binding: 'b' }],
    },
    {
      rustLine: 10,
      tsLine: 6,
      caption: {
        js: '兩邊長得一樣：這裡是預設，不用明講。',
        rust: '計數歸零才碎。差別不是有沒有，是預設。',
      },
      js: [{ type: 'unbind', binding: 'a' }],
      rust: [{ type: 'drop', binding: 'a' }],
    },
  ],
};

export const breakIt = null;
