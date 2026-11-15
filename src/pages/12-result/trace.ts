// 第 12 頁的執行軌跡。純資料：不 import 任何 ?raw 或 JSON，測試才能用 node 直接載入。
// 行號對應 snippet.rs 與 snippet.ts（1 起算）。
//
// JS：這一頁的 main 也畫成一個框（call stack 兩層：main、parse），閃電才有東西可以劈穿。
// throw 之後每一步往上一層（unwind），都沒有人接，最後劈出頂端、程式中止，所以最後一步 JS 沒有事件。
// Rust：parse 回傳的是雙色盒子（這次亮 Err 那一色），第 4 步 match 把盒子掀開，
// 第 6 步走進 Err 那一道門、錯誤值搬給 e。前兩步 Rust 還在等 parse 回傳，場景上沒有東西。
// 「弄壞它」只在 result 握住盒子、還沒 match 的時候（做完第 3 步）可以做。

import type { BreakIt, Trace } from '../../core/trace.ts';

export const trace: Trace = {
  steps: [
    {
      rustLine: 2,
      tsLine: 5,
      caption: {
        js: 'main 呼叫 parse，stack 疊了兩層。',
        rust: '呼叫 parse，試著把 "abc" 轉成整數。',
      },
      js: [
        { type: 'enter', scope: 'main', kind: 'fn', label: 'main()' },
        { type: 'enter', scope: 'parse', kind: 'fn', label: 'parse()' },
        { type: 'alloc', value: 'p1', label: '"abc"', prim: true },
        { type: 'bind', binding: 'text', value: 'p1' },
      ],
      rust: [],
    },
    {
      rustLine: null,
      tsLine: 2,
      caption: {
        js: '"abc" 不是合法 JSON，丟出錯誤。',
        rust: '這邊沒有對應的行。',
      },
      js: [{ type: 'throw', label: 'SyntaxError' }],
      rust: [],
    },
    {
      rustLine: 2,
      tsLine: 5,
      caption: {
        js: '錯誤穿過 parse 往上飛，n 沒被賦值。',
        rust: '回傳的是盒子，這次是 Err，result 握住。',
      },
      js: [{ type: 'unwind' }],
      rust: [
        { type: 'alloc', value: 'v1', label: 'ParseIntError' },
        { type: 'wrap', binding: 'result', variant: 'Err', value: 'v1', side: 'err' },
      ],
    },
    {
      rustLine: 3,
      tsLine: null,
      caption: {
        js: 'main 沒寫 try/catch，錯誤繼續往上。',
        rust: 'match 拆開盒子，看是 Ok 還是 Err。',
      },
      js: [{ type: 'unwind' }],
      rust: [{ type: 'match', id: 'm', on: 'result', arms: ['Ok', 'Err'], of: ['Ok', 'Err'] }],
    },
    {
      rustLine: 4,
      tsLine: 6,
      caption: {
        js: '這一行跑不到。',
        rust: '不是 Ok，這一支跳過。',
      },
      js: [],
      rust: [{ type: 'arm', match: 'm', arm: 'Ok' }],
    },
    {
      rustLine: 5,
      tsLine: null,
      caption: {
        js: '沒有人接，整支程式中止。',
        rust: '是 Err，錯誤交給 e，印出訊息。',
      },
      js: [{ type: 'unwind' }],
      rust: [
        { type: 'arm', match: 'm', arm: 'Err' },
        { type: 'open', binding: 'result', to: 'e' },
        { type: 'use', binding: 'e' },
      ],
    },
    {
      rustLine: 7,
      tsLine: null,
      caption: {
        js: '程式已經中止。',
        rust: '處理完了，main 正常結束。',
      },
      js: [],
      rust: [
        { type: 'end-match', match: 'm' },
        { type: 'drop', binding: 'e' },
        { type: 'drop', binding: 'result' },
      ],
    },
  ],
};

export const breakIt: BreakIt = {
  attempt: { type: 'use-inner', binding: 'result' },
  rule: 'unopened-box',
  expect: 'E0369',
  at: 'rust:box:result',
  hint: '弄壞它：不拆盒子，直接拿來加 1',
  plain:
    'result 是 Result<i32, ParseIntError>，不是 i32。盒子不能拿來做加法，要先拆開、Ok 和 Err 都處理過才拿得到數字。',
};
