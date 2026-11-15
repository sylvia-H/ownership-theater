// 第 10 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// Rust：a、b 握的是盒子（Option），不是值。第 4 步 `if let` 打開 a，值搬給 text（宣告在 `{ }` 裡）；
// 第 7 步打開 b 是空的，整段跳過（第 8 行不執行）。
// JS：b 的線連到空位（`words[1]` 是 undefined），第 8 步碰了才丟 TypeError，沒有人接，程式中止，
// 所以最後一步 JS 沒有事件。TS 第 2 行（words）在 Rust 沒有對應。
// 「弄壞它」在 b 的盒子出現之後、打開之前（做完第 3–6 步）可以做。

import type { BreakIt, Trace } from '../../core/trace.ts';

export const trace: Trace = {
  steps: [
    {
      rustLine: null,
      tsLine: 2,
      caption: {
        js: 'words 連到一個陣列，裡面只有一格。',
        rust: '這邊沒有對應的行。',
      },
      js: [
        { type: 'alloc', value: 'o1', label: '["hi"]' },
        { type: 'bind', binding: 'words', value: 'o1' },
      ],
      rust: [],
    },
    {
      rustLine: 2,
      tsLine: 3,
      caption: {
        js: 'a 拿到 words[0]，是 "hi"。',
        rust: 'a 握著一個盒子，裡面裝著 "hi"。',
      },
      js: [
        { type: 'alloc', value: 'p1', label: '"hi"', prim: true },
        { type: 'bind', binding: 'a', value: 'p1' },
      ],
      rust: [
        { type: 'alloc', value: 'v1', label: '"hi"' },
        { type: 'wrap', binding: 'a', variant: 'Some', value: 'v1' },
      ],
    },
    {
      rustLine: 3,
      tsLine: 4,
      caption: {
        js: 'b 連到空位，線看起來和 a 的一樣。',
        rust: 'b 握著一個空盒，型別就寫著可能沒有。',
      },
      js: [{ type: 'bind-empty', binding: 'b' }],
      rust: [{ type: 'wrap', binding: 'b', variant: 'None' }],
    },
    {
      rustLine: 4,
      tsLine: null,
      caption: {
        js: '這邊不用開盒子。',
        rust: '打開 a：有值，交給 text。',
      },
      js: [],
      rust: [
        { type: 'enter', scope: 'if1', kind: 'block', label: 'if let { }' },
        { type: 'open', binding: 'a', to: 'text' },
      ],
    },
    {
      rustLine: 5,
      tsLine: 5,
      caption: {
        js: '順著 a 的線讀到值，印出 HI。',
        rust: '值在 text 手上，印出 HI。',
      },
      js: [{ type: 'use', binding: 'a' }],
      rust: [{ type: 'use', binding: 'text' }],
    },
    {
      rustLine: 6,
      tsLine: null,
      caption: {
        js: '這邊沒有對應的行。',
        rust: 'text 離開 scope，"hi" 碎掉。',
      },
      js: [],
      rust: [{ type: 'exit', scope: 'if1' }],
    },
    {
      rustLine: 7,
      tsLine: null,
      caption: {
        js: '這邊不用開盒子。',
        rust: '打開 b：空的，這段直接跳過。',
      },
      js: [],
      rust: [{ type: 'open', binding: 'b' }],
    },
    {
      rustLine: null,
      tsLine: 6,
      caption: {
        js: '碰到空位才炸：TypeError。',
        rust: '空盒那段沒執行，什麼事都沒有。',
      },
      js: [
        { type: 'throw', label: 'TypeError', binding: 'b' },
        { type: 'unwind' },
      ],
      rust: [],
    },
    {
      rustLine: 10,
      tsLine: null,
      caption: {
        js: '程式已經中止。',
        rust: 'main 結束，盒子收掉。',
      },
      js: [],
      rust: [
        { type: 'drop', binding: 'b' },
        { type: 'drop', binding: 'a' },
      ],
    },
  ],
};

export const breakIt: BreakIt = {
  attempt: { type: 'use-inner', binding: 'b' },
  rule: 'unopened-box',
  expect: 'E0599',
  at: 'rust:box:b',
  hint: '弄壞它：不開盒子，直接用 b',
  plain:
    'b 的型別是 Option<String>，不是 String。盒子本身沒有 to_uppercase 這個方法，要先打開、確認裡面有值才能用。',
};
