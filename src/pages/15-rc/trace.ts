// 第 15 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// Rust 世界第一次出現 JS 的東西：值不在任何一隻夾具裡，a、b 各連一條線過去（和 JS 的線同一種畫法），
// 值的下方標著引用計數。第 2 步是 share，不是 move：a 仍然有效，值也沒有被複製。
// 第 4 步和第 4 頁（離開 { } 就碎）正好相反：b 離開只是計數減一。
// 計數 1 變 0（第 6 步）片段印不出來，是依 Rc 的語意寫的；stdout 對得上的數字是 2 和 1。

import type { Trace } from '../../core/trace.ts';

export const trace: Trace = {
  steps: [
    {
      rustLine: 4,
      tsLine: 2,
      caption: {
        js: 'a 連到一顆光球。',
        rust: 'a 是值的擁有者，計數是 1。',
      },
      js: [
        { type: 'alloc', value: 'o1', label: '{ text: "hello" }' },
        { type: 'bind', binding: 'a', value: 'o1' },
      ],
      rust: [
        { type: 'alloc', value: 'v1', label: '"hello"', rc: true },
        { type: 'bind', binding: 'a', value: 'v1' },
      ],
    },
    {
      rustLine: 6,
      tsLine: 4,
      caption: {
        js: 'b 多連一條線到同一顆球。',
        rust: 'b 也連到同一個值，計數變 2。',
      },
      js: [
        { type: 'enter', scope: 'inner', kind: 'block', label: '{ }' },
        { type: 'bind', binding: 'b', value: 'o1' },
      ],
      rust: [
        { type: 'enter', scope: 'inner', kind: 'block', label: '{ }' },
        { type: 'share', from: 'a', to: 'b' },
      ],
    },
    {
      rustLine: 7,
      tsLine: 5,
      caption: {
        js: '順著 b 用得到，沒有數字可看。',
        rust: '印出 hello 與計數 2。',
      },
      js: [{ type: 'use', binding: 'b' }],
      rust: [{ type: 'use', binding: 'b' }],
    },
    {
      rustLine: 8,
      tsLine: 6,
      caption: {
        js: 'b 的線斷了，球還在。',
        rust: 'b 離開，計數降到 1，值沒碎。',
      },
      js: [{ type: 'exit', scope: 'inner' }],
      rust: [{ type: 'exit', scope: 'inner' }],
    },
    {
      rustLine: 9,
      tsLine: 7,
      caption: {
        js: '順著 a 照樣用得到。',
        rust: '印出 hello 與計數 1。',
      },
      js: [{ type: 'use', binding: 'a' }],
      rust: [{ type: 'use', binding: 'a' }],
    },
    {
      rustLine: 10,
      tsLine: 8,
      caption: {
        js: '線斷了，球等 GC 來收。',
        rust: '計數歸零，值這一刻才碎掉。',
      },
      js: [{ type: 'unbind', binding: 'a' }],
      rust: [{ type: 'drop', binding: 'a' }],
    },
  ],
};

export const breakIt = null;
