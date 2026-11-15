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
  slug: 'reverse-linked-list',
  number: 206,
  title: 'Reverse Linked List',
  difficulty: 'Easy',
  url: 'https://leetcode.com/problems/reverse-linked-list/',
  summary: 'Rust 多出來 5 處，都在回答同一個問題：這個節點現在歸誰。',
  lead: [
    '反轉串列只是把每個節點的 next 轉向。TS 裡幾個變數可以同時指著同一個節點；Rust 的 Box 規定每個節點只有一個擁有者。',
    '所以每一步都是搬：take 把下一個節點拿出來交給 curr，node 再整個搬進 prev。TS 最後那行 curr = next，Rust 不需要。',
  ],
  ts: extractSolution(tsSource),
  rust: extractSolution(rustSource),
  rows,
  related: ['move', 'option'],
  verified,
  en,
};

export default problem;
