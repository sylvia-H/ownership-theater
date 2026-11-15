// 第 11 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// 兩邊各立一排閘門：Rust 的 match 三道（Less、Equal、Greater），JS 的 switch 只有兩道（-1、1）。
// 值刻意是 Equal／0：Rust 走進 Equal 那一道，JS 沒有任何一道接住，值從旁邊溜過去，text 還連著空位。
// Ordering 是 Copy、"same" 是字串常值，所以兩顆都是 chip；第 7 行的 Greater 沒走到，不佔一步。
// 「弄壞它」在閘門立著的時候（做完第 3–5 步）可以做：拔掉 Equal 那一道。

import type { BreakIt, Trace } from '../../core/trace.ts';

const ARMS = ['Less', 'Equal', 'Greater'];

export const trace: Trace = {
  steps: [
    {
      rustLine: 3,
      tsLine: 3,
      caption: {
        js: '5 和 5 比完得到 0，order 拿到它。',
        rust: '5 和 5 比完得到 Equal，order 握住。',
      },
      js: [
        { type: 'alloc', value: 'p1', label: '0', prim: true },
        { type: 'bind', binding: 'order', value: 'p1' },
      ],
      rust: [
        { type: 'alloc', value: 'v1', label: 'Equal', copy: true },
        { type: 'bind', binding: 'order', value: 'v1' },
      ],
    },
    {
      rustLine: null,
      tsLine: 4,
      caption: {
        js: 'text 先宣告，還沒有值，連著空位。',
        rust: '這邊沒有對應的行。',
      },
      js: [{ type: 'bind-empty', binding: 'text' }],
      rust: [],
    },
    {
      rustLine: 4,
      tsLine: 5,
      caption: {
        js: 'switch 只寫了 -1 和 1 兩道門。',
        rust: 'match 有三道門，三種可能都接得到。',
      },
      js: [{ type: 'match', id: 's', on: 'order', arms: ['-1', '1'] }],
      rust: [{ type: 'match', id: 'm', on: 'order', arms: ARMS, of: ARMS }],
    },
    {
      rustLine: 5,
      tsLine: 6,
      caption: {
        js: '不是 -1，往下。',
        rust: '不是 Less，往下。',
      },
      js: [{ type: 'arm', match: 's', arm: '-1' }],
      rust: [{ type: 'arm', match: 'm', arm: 'Less' }],
    },
    {
      rustLine: 6,
      tsLine: 7,
      caption: {
        js: '不是 1，往下。',
        rust: '是 Equal，值走進這一道門。',
      },
      js: [{ type: 'arm', match: 's', arm: '1' }],
      rust: [{ type: 'arm', match: 'm', arm: 'Equal' }],
    },
    {
      rustLine: 8,
      tsLine: 9,
      caption: {
        js: '沒有門接住 0，值從旁邊溜過去。',
        rust: 'match 的結果 "same" 交給 text。',
      },
      js: [{ type: 'end-match', match: 's' }],
      rust: [
        { type: 'alloc', value: 'v2', label: '"same"', copy: true },
        { type: 'bind', binding: 'text', value: 'v2' },
        { type: 'end-match', match: 'm', yields: 'v2' },
      ],
    },
    {
      rustLine: 9,
      tsLine: 10,
      caption: {
        js: '印出 undefined，沒有任何錯誤。',
        rust: '印出 same。',
      },
      js: [{ type: 'use', binding: 'text' }],
      rust: [{ type: 'use', binding: 'text' }],
    },
    {
      rustLine: 10,
      tsLine: 11,
      caption: {
        js: 'main 結束。',
        rust: 'main 結束。',
      },
      js: [
        { type: 'unbind', binding: 'text' },
        { type: 'unbind', binding: 'order' },
      ],
      rust: [
        { type: 'drop', binding: 'text' },
        { type: 'drop', binding: 'order' },
      ],
    },
  ],
};

export const breakIt: BreakIt = {
  attempt: { type: 'remove-arm', match: 'm', arm: 'Equal' },
  rule: 'non-exhaustive-match',
  expect: 'E0004',
  at: 'rust:gate:m:Equal',
  hint: '弄壞它：刪掉 Equal 這個分支',
  plain: 'match 少了 Equal 這一種情況。Rust 在編譯期就指出漏了哪一個，不會等到執行時才落空。',
};
