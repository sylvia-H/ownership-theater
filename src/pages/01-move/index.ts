import type { Page, Verified } from '../../core/page.ts';
import en from './en.ts';
import tsEn from './snippet.en.ts?raw';
import rust from './snippet.rs?raw';
import ts from './snippet.ts?raw';
import { breakIt, trace } from './trace.ts';
import verifiedJson from './verified.json';

// verified.json 由 scripts/verify-rust.mjs 產生；形狀跑掉的話這一行會在型別檢查時失敗。
const verified: Verified = verifiedJson;

const page: Page = {
  slug: 'move',
  kicker: '所有權 · Rust Book 第 4 章',
  title: 'let b = a; 之後再用 a',
  lead: [
    '在 JS 裡，b = a 只是多拉一條線，連到同一顆值。值沒有被複製，也沒有被搬走，a 和 b 兩個名字都能繼續用它。',
    '在 Rust 裡，每個值同一時間只有一個擁有者。let b = a; 是把值整顆搬給 b，a 從此不能再用。這個動作叫 move。',
  ],
  book: {
    quote: [
      'Each value in Rust has an owner.',
      'There can only be one owner at a time.',
      'When the owner goes out of scope, the value will be dropped.',
    ],
    cite: 'The Rust Programming Language §4.1 Ownership Rules',
    url: 'https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#ownership-rules',
    urlZh: 'https://rust-lang.tw/book-tw/ch04-01-what-is-ownership.html',
  },
  rust,
  ts,
  tsEn,
  en,
  trace,
  breakIt,
  verified,
};

export default page;
