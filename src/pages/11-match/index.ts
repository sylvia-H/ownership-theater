import type { Page, Verified } from '../../core/page.ts';
import rust from './snippet.rs?raw';
import ts from './snippet.ts?raw';
import { breakIt, trace } from './trace.ts';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const page: Page = {
  slug: 'match',
  kicker: '沒有 null · Rust Book 第 6 章',
  title: 'match 要列出所有情況',
  lead: [
    'JS 的 switch 只跑你寫了的 case。漏掉一種情況不會報錯，執行時遇到就安靜地跳過，後面拿到的是 undefined。',
    'Rust 的 match 必須涵蓋所有可能。少一個分支，編譯器會直接指出漏了哪一種，程式編譯不過，不會等到執行時才發現。',
  ],
  book: {
    quote: [
      'Rust knows that we didn’t cover every possible case and even knows which pattern we forgot!',
      'Matches in Rust are exhaustive: We must exhaust every last possibility in order for the code to be valid.',
    ],
    cite: 'The Rust Programming Language §6.2 Matches Are Exhaustive',
    url: 'https://doc.rust-lang.org/book/ch06-02-match.html#matches-are-exhaustive',
    urlZh: 'https://rust-lang.tw/book-tw/ch06-02-match.html',
  },
  rust,
  ts,
  trace,
  breakIt,
  verified,
};

export default page;
