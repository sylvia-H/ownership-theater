import type { Page, Verified } from '../../core/page.ts';
import en from './en.ts';
import rust from './snippet.rs?raw';
import ts from './snippet.ts?raw';
import { breakIt, trace } from './trace.ts';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const page: Page = {
  slug: 'copy-vs-move',
  kicker: '所有權 · Rust Book 第 4 章',
  title: '整數是複製，String 是搬走',
  lead: [
    'let y = x; 和 let t = s; 寫法一模一樣，值的命運卻不同。整數這種小而大小固定的值是 Copy 型別：指定時複製出一顆新的，原變數照樣能用。',
    'String 的內容放在 heap 上，複製要花力氣，所以 Rust 不會偷偷幫你複製，而是整顆搬走。JS 其實也分兩種：數字是複製，物件是共享。',
  ],
  book: {
    quote: [
      'If a type implements the Copy trait, variables that use it do not move, but rather are trivially copied, making them still valid after assignment to another variable.',
    ],
    cite: 'The Rust Programming Language §4.1 Stack-Only Data: Copy',
    url: 'https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#stack-only-data-copy',
    urlZh: 'https://rust-lang.tw/book-tw/ch04-01-what-is-ownership.html',
  },
  rust,
  ts,
  en,
  trace,
  breakIt,
  verified,
};

export default page;
