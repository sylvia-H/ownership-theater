import type { LcEntry } from './types.ts';

// LeetCode 對照區的題目，每題動態載入。順序就是閱讀順序：
// 幾乎只差語法 → 可變借用 → 集合裡的所有權 → 獨占的所有權 → 共享的所有權。
export const problems: LcEntry[] = [
  {
    slug: 'two-sum',
    number: 1,
    title: 'Two Sum',
    teaser: '基準題：解法一模一樣，只多幾個符號。',
    load: () => import('./01-two-sum/index.ts').then((m) => m.default),
  },
  {
    slug: 'reverse-string',
    number: 344,
    title: 'Reverse String',
    teaser: '原地修改：先借到 &mut 才能動手。',
    load: () => import('./02-reverse-string/index.ts').then((m) => m.default),
  },
  {
    slug: 'group-anagrams',
    number: 49,
    title: 'Group Anagrams',
    teaser: '字串是搬進 map 的，不是複製進去。',
    load: () => import('./03-group-anagrams/index.ts').then((m) => m.default),
  },
  {
    slug: 'reverse-linked-list',
    number: 206,
    title: 'Reverse Linked List',
    teaser: '每一步都要講清楚：節點現在歸誰。',
    load: () => import('./04-reverse-linked-list/index.ts').then((m) => m.default),
  },
  {
    slug: 'invert-binary-tree',
    number: 226,
    title: 'Invert Binary Tree',
    teaser: '共享、可改，在 Rust 都要寫在型別上。',
    load: () => import('./05-invert-binary-tree/index.ts').then((m) => m.default),
  },
];
