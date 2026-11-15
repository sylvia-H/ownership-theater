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
  slug: 'two-sum',
  number: 1,
  title: 'Two Sum',
  difficulty: 'Easy',
  url: 'https://leetcode.com/problems/two-sum/',
  summary: 'Rust 多出來 3 處：兩個型別轉換、一次打開 Option；解法本身一模一樣。',
  lead: [
    '兩邊的做法一樣：邊走邊把看過的數字記進表裡，每到一個數字就查另一半出現過沒有。',
    'Rust 多的只有幾個符號：查表時借 need 去比對、查不到的情況用 if let 處理、索引要自己轉成 i32。這題是基準，後面每題都拿它來比。',
  ],
  ts: extractSolution(tsSource),
  rust: extractSolution(rustSource),
  rows,
  related: ['shared-borrow', 'option'],
  verified,
  en,
};

export default problem;
