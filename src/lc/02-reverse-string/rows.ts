import type { LcRow } from '../types.ts';

// 手寫的逐行對齊表。行號是標記之間的解法裡的行號，從 1 起算。
// 只有 Rust、不帶 tag 的列是樣板（use、impl Solution { 與它的結尾），畫面上變灰。
export const rows: LcRow[] = [
  { ts: null, rust: 1 },
  { ts: 1, rust: 2, tag: 'borrow', note: '&mut：把陣列借來改，改完就還，所以不用回傳。' },
  { ts: 2, rust: 3 },
  { ts: 3, rust: 4 },
  { ts: 4, rust: 5 },
  { ts: 5, rust: 6, tag: 'borrow', note: '不能同時拿著兩個元素的可變參考，所以交給 swap 一次換好。' },
  { ts: 6, rust: 7 },
  { ts: 7, rust: 8 },
  { ts: 8, rust: 9 },
  { ts: 9, rust: 10 },
  { ts: null, rust: 11 },
];
