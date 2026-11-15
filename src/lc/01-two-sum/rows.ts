import type { LcRow } from '../types.ts';

// 手寫的逐行對齊表。行號是標記之間的解法裡的行號，從 1 起算。
// 只有 Rust、不帶 tag 的列是樣板（use、impl Solution { 與它的結尾），畫面上變灰。
export const rows: LcRow[] = [
  { ts: null, rust: 1 },
  { ts: null, rust: 2 },
  { ts: 1, rust: 3 },
  { ts: 2, rust: 4 },
  { ts: 3, rust: 5 },
  { ts: 4, rust: 6 },
  { ts: 5, rust: 7, tag: 'option', note: '查表只借 need 去比對（&）；可能查不到，所以用 if let 打開。' },
  { ts: 6, rust: 8, tag: 'types', note: '索引是 usize，題目要 i32；Rust 不會自動轉，要寫 as。' },
  { ts: 7, rust: 9 },
  { ts: 8, rust: 10, tag: 'types', note: '存進表裡的索引也一樣，先轉成 i32。' },
  { ts: 9, rust: 11 },
  { ts: 10, rust: 12 },
  { ts: 11, rust: 13 },
  { ts: null, rust: 14 },
];
