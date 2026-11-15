import type { Verified } from '../../core/page.ts';
import en from './en.ts';
import { extractSolution } from '../extract.ts';
import type { LcProblem } from '../types.ts';
import { rows } from './rows.ts';
import rustSource from './solution.rs?raw';
import tsSource from './solution.ts?raw';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const problem: LcProblem = {
  slug: 'invert-binary-tree',
  number: 226,
  title: 'Invert Binary Tree',
  difficulty: 'Easy',
  url: 'https://leetcode.com/problems/invert-binary-tree/',
  summary: 'Rust 多出來 6 處，一半是 Rc 與 RefCell：JS 預設的共享、可改，在這裡都要寫出來。',
  lead: [
    'LeetCode 給的樹節點型別有三層：Option 可能沒有、Rc 可以共享、RefCell 可以改。TS 只要 TreeNode | null。',
    '解法還是同一個遞迴。多出來的動作是 borrow_mut 向 RefCell 借可變的權限，以及 take 把子樹拿出來交給遞迴。',
  ],
  ts: extractSolution(tsSource),
  rust: extractSolution(rustSource),
  rows,
  related: ['rc-refcell', 'rc', 'refcell'],
  verified,
  en,
};

export default problem;
