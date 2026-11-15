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
  slug: 'group-anagrams',
  number: 49,
  title: 'Group Anagrams',
  difficulty: 'Medium',
  url: 'https://leetcode.com/problems/group-anagrams/',
  summary: 'Rust 多出來 5 處：字串一路用搬的，搬進 map、再整批搬出來；另外兩處是 collect 的型別標註。',
  lead: [
    '把字母排序後當成鑰匙，同一把鑰匙的字串放同一組。TS 放進 Map 的是參考，原本的陣列還在；Rust 是把字串從 strs 搬進表裡。',
    'entry 那一行看起來最不一樣：它一次找好位置並借出來，省掉 TS 的先查、再放、再拿。最後 into_values 把各組整批搬出來。',
  ],
  ts: extractSolution(tsSource),
  rust: extractSolution(rustSource),
  rows,
  related: ['move', 'mut-borrow', 'iterators'],
  verified,
};

export default problem;
