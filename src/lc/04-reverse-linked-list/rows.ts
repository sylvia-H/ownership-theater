import type { LcRow } from '../types.ts';

// 手寫的逐行對齊表。行號是標記之間的解法裡的行號，從 1 起算。
// 只有 Rust、不帶 tag 的列是樣板（use、impl Solution { 與它的結尾），畫面上變灰。
// 只有 TS 的列：建構子（第 4–7 行；Rust 的 struct 不需要），以及迴圈最後的 curr = next（第 17 行；
// Rust 在 take 那一行就把下一個節點交給 curr 了）。
export const rows: LcRow[] = [
  { ts: 1, rust: 1 },
  { ts: 2, rust: 2 },
  { ts: 3, rust: 3, tag: 'ownership', note: 'Box：下一個節點只歸這個節點所有；Option 取代 null。' },
  { ts: 4, rust: null },
  { ts: 5, rust: null },
  { ts: 6, rust: null },
  { ts: 7, rust: null },
  { ts: 8, rust: 4 },
  { ts: 9, rust: 5 },
  { ts: null, rust: 6 },
  { ts: 10, rust: 7, tag: 'ownership', note: 'head 不是借來的：整條串列交進函式，反轉完再交出去。' },
  { ts: 11, rust: 8 },
  { ts: 12, rust: 9 },
  { ts: 13, rust: 10, tag: 'option', note: 'curr 可能是 None；打開的同時，節點從 curr 搬到 node 手上。' },
  { ts: 14, rust: 11, tag: 'ownership', note: 'take 把下一個節點拿走、原地留下 None，再交給 curr。' },
  { ts: 15, rust: 12 },
  { ts: 16, rust: 13, tag: 'option', note: 'node 整個搬進 prev；prev 是 Option，所以要包成 Some。' },
  { ts: 17, rust: null },
  { ts: 18, rust: 14 },
  { ts: 19, rust: 15 },
  { ts: 20, rust: 16 },
  { ts: null, rust: 17 },
];
