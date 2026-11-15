import type { Verified } from '../../core/page.ts';
import { extractSolution } from '../extract.ts';
import type { LcProblem } from '../types.ts';
import { rows } from './rows.ts';
import rustSource from './solution.rs?raw';
import tsSource from './solution.ts?raw';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const problem: LcProblem = {
  slug: 'reverse-string',
  number: 344,
  title: 'Reverse String',
  difficulty: 'Easy',
  url: 'https://leetcode.com/problems/reverse-string/',
  summary: 'Rust 多出來 2 處，講的是同一件事：要原地修改，就得先借到 &mut。',
  lead: [
    '題目要求原地反轉，不能另外開陣列。TS 的陣列傳進函式本來就能改；Rust 要在簽名寫 &mut，呼叫的人也得明講把它借出去改。',
    '交換兩格時，Rust 不讓你同時拿著兩個元素的可變參考，所以用 swap 一次做完。雙指標的走法完全一樣。',
  ],
  ts: extractSolution(tsSource),
  rust: extractSolution(rustSource),
  rows,
  related: ['mut-borrow', 'shared-borrow'],
  verified,
};

export default problem;
