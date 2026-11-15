// 第 3 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// 兩次呼叫各開一個函式範圍（pass、show），參數 s 是範圍裡的變數。

import type { BreakIt, Trace } from '../../core/trace.ts';

export const trace: Trace = {
  steps: [
    {
      rustLine: 6,
      tsLine: 6,
      caption: {
        js: '一顆光球漂在空中，a 連一條線過去。',
        rust: 'a 這隻夾具握住這個值。',
      },
      js: [
        { type: 'alloc', value: 'o1', label: '["hello"]' },
        { type: 'bind', binding: 'a', value: 'o1' },
      ],
      rust: [
        { type: 'alloc', value: 'v1', label: '"hello"' },
        { type: 'bind', binding: 'a', value: 'v1' },
      ],
    },
    {
      rustLine: 7,
      tsLine: 7,
      caption: {
        js: '參數 s 多連一條線到同一顆球。',
        rust: '值搬進函式，交給參數 s；a 變成空殼。',
      },
      js: [
        { type: 'enter', scope: 'pass', kind: 'fn', label: 'pass()' },
        { type: 'bind', binding: 's', value: 'o1' },
      ],
      rust: [
        { type: 'enter', scope: 'pass', kind: 'fn', label: 'fn pass' },
        { type: 'move', from: 'a', to: 's' },
      ],
    },
    {
      rustLine: 4,
      tsLine: 4,
      caption: {
        js: '回傳的是同一顆球，b 也連上去；s 的線收掉。',
        rust: '回傳把值搬回呼叫端，由 b 接手。',
      },
      js: [
        { type: 'exit', scope: 'pass' },
        { type: 'bind', binding: 'b', value: 'o1' },
      ],
      rust: [
        { type: 'return', from: 's', to: 'b' },
        { type: 'exit', scope: 'pass' },
      ],
    },
    {
      rustLine: 8,
      tsLine: 8,
      caption: {
        js: '又一條線：a、b、s 連的都是同一顆球。',
        rust: '值再搬進 show 的參數 s；b 也變成空殼。',
      },
      js: [
        { type: 'enter', scope: 'show', kind: 'fn', label: 'show()' },
        { type: 'bind', binding: 's', value: 'o1' },
      ],
      rust: [
        { type: 'enter', scope: 'show', kind: 'fn', label: 'fn show' },
        { type: 'move', from: 'b', to: 's' },
      ],
    },
    {
      rustLine: 2,
      tsLine: 2,
      caption: {
        js: '函式裡順著 s 的線用到那顆球。',
        rust: '值在 s 手上，函式裡用它沒問題。',
      },
      js: [{ type: 'use', binding: 's' }],
      rust: [{ type: 'use', binding: 's' }],
    },
    {
      rustLine: 3,
      tsLine: 3,
      caption: {
        js: '函式結束只少一條線，球還被 a、b 連著。',
        rust: '函式結束又沒回傳，值跟著 s 當場碎掉。',
      },
      js: [{ type: 'exit', scope: 'show' }],
      rust: [{ type: 'exit', scope: 'show' }],
    },
    {
      rustLine: 9,
      tsLine: 9,
      caption: {
        js: '線都斷了，球留在原地等 GC 來收。',
        rust: 'a、b 早就是空殼，沒有東西可以碎了。',
      },
      js: [
        { type: 'unbind', binding: 'b' },
        { type: 'unbind', binding: 'a' },
      ],
      rust: [
        { type: 'drop', binding: 'b' },
        { type: 'drop', binding: 'a' },
      ],
    },
  ],
};

export const breakIt: BreakIt = {
  attempt: { type: 'use', binding: 'a' },
  rule: 'use-after-move',
  expect: 'E0382',
  at: 'rust:claw:a',
  hint: '弄壞它：傳進函式之後再用 a',
  plain: '值在傳進 pass 的那一刻就搬走了，a 只剩空殼。就算函式把值回傳，接手的也是 b，不是 a。',
};
