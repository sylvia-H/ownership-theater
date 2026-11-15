// 第 8 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算），依執行順序。
//
// snippet.rs 是正確的寫法：把值整顆搬出函式，沒有光束。
// 「弄壞它」是 broken.rs 的寫法：不交出值，改成回傳一道照著區域變數 s 的 &；
// 只在第 2 步做完、值還握在 make 的 s 手上時可以做。

import type { BreakIt, Trace } from '../../core/trace.ts';

export const trace: Trace = {
  steps: [
    {
      rustLine: 7,
      tsLine: 7,
      caption: {
        js: 'main 呼叫 make，r 還沒有連到任何東西。',
        rust: 'main 呼叫 make，r 還空著。',
      },
      js: [{ type: 'enter', scope: 'make', kind: 'fn', label: 'make()' }],
      rust: [{ type: 'enter', scope: 'make', kind: 'fn', label: 'fn make' }],
    },
    {
      rustLine: 2,
      tsLine: 2,
      caption: {
        js: 'make 裡出現一顆光球，s 連一條線過去。',
        rust: 'make 裡的 s 握住這個值。',
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
        js: '回傳同一顆球，r 也連一條線過去。',
        rust: '值整顆搬出函式，交到 r 手上。',
      },
      js: [{ type: 'return', from: 's', to: 'r' }],
      rust: [{ type: 'return', from: 's', to: 'r' }],
    },
    {
      rustLine: 4,
      tsLine: 4,
      caption: {
        js: 's 的線斷了，球還有 r 連著，不會被收。',
        rust: 'make 結束，s 只是空殼，沒有東西碎掉。',
      },
      js: [{ type: 'exit', scope: 'make' }],
      rust: [{ type: 'exit', scope: 'make' }],
    },
    {
      rustLine: 8,
      tsLine: 8,
      caption: {
        js: '順著 r 的線讀到那顆球。',
        rust: '值在 r 手上，照常使用。',
      },
      js: [{ type: 'use', binding: 'r' }],
      rust: [{ type: 'use', binding: 'r' }],
    },
    {
      rustLine: 9,
      tsLine: 9,
      caption: {
        js: '線都斷了，球留在原地等 GC 來收。',
        rust: 'r 離開 scope，值當場碎掉。',
      },
      js: [{ type: 'unbind', binding: 'r' }],
      rust: [{ type: 'drop', binding: 'r' }],
    },
  ],
};

export const breakIt: BreakIt = {
  attempt: { type: 'return-ref', of: 's', to: 'r' },
  rule: 'dangling-ref',
  expect: 'E0515',
  at: 'rust:val:v1',
  hint: '弄壞它：不交出值，只回傳一道照著 s 的 &',
  plain: 's 在 make 結束時就碎了，回傳出去的參考會照著一堆碎片。Rust 不等執行，編譯期就擋下來。',
};
