import type { LcRow } from '../types.ts';

// 手寫的逐行對齊表。行號是標記之間的解法裡的行號，從 1 起算。
// 只有 Rust、不帶 tag 的列是樣板（use、impl Solution { 與它的結尾），畫面上變灰。
// TS 第 7 行（先查有沒有這一組，沒有就放一個空陣列）在 Rust 併進 entry 那一行，所以是只有 TS 的一列。
export const rows: LcRow[] = [
  { ts: null, rust: 1 },
  { ts: null, rust: 2 },
  { ts: 1, rust: 3 },
  { ts: 2, rust: 4 },
  { ts: 3, rust: 5, tag: 'ownership', note: 'for 把 strs 整個用掉，每個 s 都是搬出來的，不是複製。' },
  { ts: 4, rust: 6, tag: 'types', note: 'collect 能收成很多種容器，要標明這裡收成 Vec<char>。' },
  { ts: 5, rust: 7 },
  { ts: 6, rust: 8, tag: 'types', note: '同一個 collect，標成 String 就把字元接回字串。' },
  { ts: 7, rust: null },
  { ts: 8, rust: 9, tag: 'borrow', note: '先查再放得借 map 兩次；entry 一次借好位置，s 直接搬進去。' },
  { ts: 9, rust: 10 },
  { ts: 10, rust: 11, tag: 'ownership', note: 'into_values 把 map 拆掉，各組整批搬出來，不複製字串。' },
  { ts: 11, rust: 12 },
  { ts: null, rust: 13 },
];
