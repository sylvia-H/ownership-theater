import type { LcRow } from '../types.ts';

// 手寫的逐行對齊表。行號是標記之間的解法裡的行號，從 1 起算。
// 只有 Rust、不帶 tag 的列是樣板（use、impl Solution { 與它的結尾），畫面上變灰。
// 只有 TS 的列：建構子（第 5–9 行；Rust 的 struct 不需要）。
export const rows: LcRow[] = [
  { ts: null, rust: 1 },
  { ts: null, rust: 2 },
  { ts: 1, rust: 3 },
  { ts: 2, rust: 4 },
  { ts: 3, rust: 5, tag: 'shared', note: '三層各管一件事：Option 可能沒有、Rc 可共享、RefCell 可改。' },
  { ts: 4, rust: 6, tag: 'shared', note: 'JS 的物件參考預設就能共享、能改；Rust 要寫在型別上。' },
  { ts: 5, rust: null },
  { ts: 6, rust: null },
  { ts: 7, rust: null },
  { ts: 8, rust: null },
  { ts: 9, rust: null },
  { ts: 10, rust: 7 },
  { ts: 11, rust: 8 },
  { ts: null, rust: 9 },
  { ts: 12, rust: 10 },
  { ts: 13, rust: 11, tag: 'option', note: '借 root 來打開：有節點才往下做，root 留著最後回傳。' },
  { ts: null, rust: 12, tag: 'shared', note: '向 RefCell 借可變的權限才能改節點；重複借會在執行期 panic。' },
  { ts: 14, rust: 13, tag: 'ownership', note: 'take 把左子樹整棵拿出來交給遞迴，原地暫時留下 None。' },
  { ts: 15, rust: 14, tag: 'ownership', note: '右子樹也一樣：先拿走，等一下再放回另一邊。' },
  { ts: 16, rust: 15 },
  { ts: 17, rust: 16 },
  { ts: 18, rust: 17 },
  { ts: 19, rust: 18 },
  { ts: 20, rust: 19 },
  { ts: null, rust: 20 },
];
