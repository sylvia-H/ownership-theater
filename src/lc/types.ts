// LeetCode 對照區的資料格式。
// 每題一份 TS、一份 Rust，逐行對齊；一對一對應的行變灰，Rust 多出來的東西亮起來並標上類別。

import type { Verified } from '../core/page.ts';

/** Rust 多出來的東西屬於哪一類。順序就是圖例的順序。 */
export const LC_TAGS = {
  borrow: { label: '借用', hint: '&、&mut：借來用，不拿走' },
  ownership: { label: '所有權的搬移', hint: '值被拿走、交給別人，原地不能再用' },
  option: { label: 'Option 的處理', hint: '可能沒有值，要先打開才能用' },
  shared: { label: '共享擁有', hint: 'Rc、RefCell：多個擁有者、執行期才檢查借用' },
  types: { label: '型別與轉換', hint: '型別標註、as 轉換、usize 與 i32' },
} as const;

export type LcTag = keyof typeof LC_TAGS;

/**
 * 對齊後的一列。行號從 1 起算，指的是「顯示出來的解法」裡的行（不含測試用的外殼）。
 * - ts 與 rust 都有、沒有 tag：兩邊一對一對應，畫面上變灰。
 * - ts 與 rust 都有、有 tag：對應得上，但 Rust 這一行多了東西（例如多一個 &），亮起來。
 * - 只有 rust、有 tag：Rust 獨有、而且帶著概念的行，亮起來，一定要有 note。
 * - 只有 rust、沒有 tag：Rust 獨有的樣板（`impl Solution {`、它的結尾大括號、`use` 敘述），變灰。
 *   樣板不算「Rust 多出來的東西」，summary 裡的數字不把它算進去。
 * - 只有 ts：TS 獨有的行（少見），不亮。
 */
export interface LcRow {
  ts: number | null;
  rust: number | null;
  tag?: LcTag;
  /** 一句白話：Rust 這裡多的東西在做什麼、為什麼需要。40 字以內。 */
  note?: string;
}

export interface LcProblem {
  slug: string;
  /** LeetCode 題號 */
  number: number;
  /** 英文原題名，例如 Two Sum */
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  /** LeetCode 題目頁網址 */
  url: string;
  /** 頁首一句總結：這題 Rust 多出來幾行、都在講什麼。60 字以內。 */
  summary: string;
  /** 白話說明，一段一個字串，每段 80 字以內 */
  lead: string[];
  /** 顯示出來的解法（不含測試外殼） */
  ts: string;
  rust: string;
  rows: LcRow[];
  /** 這題對應網站的哪幾頁（src/pages/index.ts 的 slug），讓讀者點回去看演出 */
  related: string[];
  /** rustc 對完整程式（含測試外殼）的實測結果 */
  verified: Verified;
}

export interface LcEntry {
  slug: string;
  number: number;
  title: string;
  /** 首頁卡片上的一句話，30 字以內 */
  teaser: string;
  load: () => Promise<LcProblem>;
}
